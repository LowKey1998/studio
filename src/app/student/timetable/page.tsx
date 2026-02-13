"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, UserCheck, Users, CalendarDays, Layers } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { isWithinInterval, parseISO } from 'date-fns';

type TimeSlot = {
    id: string;
    startTime: string;
    endTime: string;
};

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    semesterId: string;
    semesterName: string;
    lecturerNames: string;
    studentCount: number;
    intakeName: string;
};

type MergedEntry = {
    key: string;
    entry: TimetableEntry;
    totalStudents: number;
    participants: { name: string; standing: string; count: number }[];
};

const defaultDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentTimetablePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: defaultDays, slots: [] });
    const [loading, setLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        if (!user?.uid || !userProfile) return;
        setLoading(true);
        try {
            const [regsSnap, coursesSnap, timetablesSnap, settingsSnap, usersSnap, semestersSnap, intakesSnap] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'users')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes'))
            ]);

            if (!regsSnap.exists()) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            const allSemesters = semestersSnap.val() || {};
            const allIntakes = intakesSnap.val() || {};
            const studentIntakeName = userProfile.intakeId ? allIntakes[userProfile.intakeId]?.name : null;

            const activeSemesterIds = new Set<string>();
            const enrolledCourseIds = new Set<string>();

            Object.entries(regsSnap.val()).forEach(([semId, reg]: [string, any]) => {
                const semInfo = allSemesters[semId];
                if (!semInfo || semInfo.status === 'Archived') return;
                
                activeSemesterIds.add(semId);
                if (reg.courses) {
                    const coursesArr = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses);
                    coursesArr.forEach((cid: string) => enrolledCourseIds.add(cid));
                }
            });

            if (activeSemesterIds.size === 0) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            const usersData = usersSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || defaultDays,
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            // Calculate student counts for display
            const allRegsSnap = await get(ref(db, 'registrations'));
            const allRegs = allRegsSnap.val() || {};
            const counts: Record<string, Record<string, number>> = {};
            for (const uId in allRegs) {
                for (const sId in allRegs[uId]) {
                    const reg = allRegs[uId][sId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (!counts[sId]) counts[sId] = {};
                        const cArr = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses || {});
                        cArr.forEach((cid: string) => { counts[sId][cid] = (counts[sId][cid] || 0) + 1; });
                    }
                }
            }

            const entries: TimetableEntry[] = [];
            for (const semId in tData) {
                const isMaster = semId === 'master';
                // Only show from active semesters or master
                if (!activeSemesterIds.has(semId) && !isMaster) continue;

                for (const cId in tData[semId]) {
                    // Only show courses the student is actually taking
                    if (enrolledCourseIds.has(cId)) {
                        const courseInfo = cData[cId];
                        const lecturerNames = (courseInfo.lecturerIds || [])
                            .map((uid: string) => usersData[uid]?.name)
                            .filter(Boolean)
                            .join(', ') || usersData[courseInfo.lecturerId]?.name || 'Unassigned';

                        Object.values(tData[semId][cId]).forEach((entry: any) => {
                            // If it's from master, only show if it matches the student's intake (for separate instances)
                            // or if it's a shared session.
                            let shouldInclude = true;
                            if (isMaster && courseInfo.separateInstance) {
                                shouldInclude = studentIntakeName && entry.intakeName === studentIntakeName;
                            } else if (isMaster && !courseInfo.separateInstance) {
                                // Shared session from master - always include if enrolled
                                shouldInclude = true;
                            } else if (!isMaster) {
                                // Semester-specific entry - include if it's the student's semester
                                shouldInclude = activeSemesterIds.has(semId);
                            }

                            if (shouldInclude) {
                                entries.push({
                                    ...entry,
                                    courseId: cId,
                                    courseCode: courseInfo.code,
                                    courseName: courseInfo.name,
                                    semesterId: semId,
                                    semesterName: allSemesters[semId]?.name || (isMaster ? 'Master Schedule' : 'Ad-hoc'),
                                    lecturerNames,
                                    studentCount: counts[semId]?.[cId] || 0
                                });
                            }
                        });
                    }
                }
            }
            setTimetable(entries);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [user, userProfile]);

    React.useEffect(() => {
        if (!authLoading && user && userProfile) fetchData();
    }, [user, userProfile, authLoading, fetchData]);

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : defaultDays;
    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><CalendarDays className="text-primary"/> My Active Timetable</CardTitle>
                    <CardDescription>Your personalized schedule for current active semesters based on your registrations.</CardDescription>
                </CardHeader>
            </Card>

            <Card className="shadow-lg">
                <CardContent className="overflow-x-auto pt-6">
                    {loading ? (
                        <Skeleton className="h-96 w-full" />
                    ) : !hasSlots ? (
                        <Alert variant="secondary"><Info className="h-4 w-4" /><AlertTitle>Matrix View Unavailable</AlertTitle><AlertDescription>Institutional time slots have not been defined by administration.</AlertDescription></Alert>
                    ) : timetable.length === 0 ? (
                        <Alert><Info className="h-4 w-4" /><AlertTitle>No Scheduled Classes</AlertTitle><AlertDescription>You are either not registered for an active semester or your courses haven't been scheduled yet.</AlertDescription></Alert>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (<TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayDays.map(dayName => (
                                        <TableRow key={dayName}>
                                            <TableCell className="font-bold text-xs uppercase tracking-wider text-center border-r bg-muted/20">{dayName}</TableCell>
                                            {teachingTimes.slots.map((slot, sIdx) => {
                                                const slotStart = timeToMinutes(slot.startTime);
                                                const slotEnd = timeToMinutes(slot.endTime);
                                                const sessionsInSlot = timetable.filter(e => e.day === dayName && timeToMinutes(e.startTime) >= slotStart && timeToMinutes(e.startTime) < slotEnd);

                                                return (
                                                    <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                        <div className="space-y-2">
                                                            {sessionsInSlot.map((entry, eIdx) => (
                                                                <Link href={`/student/courses/${entry.courseId}`} key={eIdx} className="block p-2 rounded-md border bg-background border-primary/20 shadow-sm hover:ring-2 hover:ring-primary transition-all">
                                                                    <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2">{entry.courseCode}: {entry.courseName}</p>
                                                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2.5 w-2.5" /> {entry.venue}</div>
                                                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5"><UserCheck className="h-2.5 w-2.5" /> {entry.lecturerNames}</div>
                                                                    <div className="mt-2 text-[9px] font-medium opacity-70 italic">{entry.semesterName}</div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
