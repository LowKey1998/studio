"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, UserCheck, Users, CalendarDays, Layers, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format, parseISO, startOfWeek, addWeeks, subWeeks, getDay, isToday } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

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
    isLiveSession?: boolean;
};

const calendarDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentTimetablePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: calendarDays.slice(1, 6), slots: [] });
    const [loading, setLoading] = React.useState(true);
    
    const [viewWeek, setViewWeek] = React.useState(new Date());

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

            const enrolledCourseIdsBySemester: Record<string, string[]> = {};
            const enrolledCourseIdsGlobal = new Set<string>();
            const myActiveSemesterIds = new Set<string>();

            Object.entries(regsSnap.val()).forEach(([semId, reg]: [string, any]) => {
                const semInfo = allSemesters[semId];
                if (!semInfo || semInfo.status === 'Archived') return;
                
                if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                    myActiveSemesterIds.add(semId);
                    const coursesArr = Array.isArray(reg.courses) ? reg.courses : (reg.courses ? Object.keys(reg.courses) : []);
                    enrolledCourseIdsBySemester[semId] = coursesArr;
                    coursesArr.forEach((cid: string) => enrolledCourseIdsGlobal.add(cid));
                }
            });

            if (myActiveSemesterIds.size === 0) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            const usersData = usersSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || calendarDays.slice(1, 6),
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            const rawEntries: TimetableEntry[] = [];
            for (const semesterId in tData) {
                const isMaster = semesterId === 'master';
                
                for (const cid in tData[semesterId]) {
                    // Check if student is taking this course at all
                    if (!enrolledCourseIdsGlobal.has(cid)) continue;

                    const courseInfo = cData[cid];
                    const entries = Object.values(tData[semesterId][cid]) as any[];

                    entries.forEach(entry => {
                        let shouldInclude = false;
                        
                        if (isMaster) {
                            // Master entries are baseline
                            if (courseInfo?.separateInstance) {
                                // If separate, only show if intake name matches exactly
                                shouldInclude = studentIntakeName && entry.intakeName === studentIntakeName;
                            } else {
                                // Shared session: show to anyone enrolled in any active semester for this course
                                shouldInclude = true;
                            }
                        } else {
                            // Semester-specific entries (overrides)
                            // Only show if the student is registered for THIS specific semester instance
                            shouldInclude = myActiveSemesterIds.has(semesterId) && enrolledCourseIdsBySemester[semesterId]?.includes(cid);
                        }

                        if (shouldInclude) {
                            const lecturerNames = (courseInfo.lecturerIds || [])
                                .map((uid: string) => usersData[uid]?.name)
                                .filter(Boolean)
                                .join(', ') || usersData[courseInfo.lecturerId]?.name || 'Unassigned';

                            rawEntries.push({
                                ...entry,
                                courseId: cid,
                                courseCode: courseInfo.code,
                                courseName: courseInfo.name,
                                semesterId: semesterId,
                                semesterName: allSemesters[semesterId]?.name || (isMaster ? 'Master Schedule' : 'Ad-hoc'),
                                lecturerNames,
                                studentCount: 0 
                            });
                        }
                    });
                }
            }
            setTimetable(rawEntries);
        } catch (error) {
            console.error("Timetable Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    }, [user, userProfile]);

    React.useEffect(() => {
        if (!authLoading && user && userProfile) fetchData();
    }, [user, userProfile, authLoading, fetchData]);

    const currentWeekInterval = React.useMemo(() => {
        const start = startOfWeek(viewWeek, { weekStartsOn: 1 });
        return [0, 1, 2, 3, 4, 5, 6].map(i => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [viewWeek]);

    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><CalendarDays className="h-6 w-6 text-primary"/> My Active Timetable</CardTitle>
                    <CardDescription>Your personalized schedule. Sessions vary by week based on live link approvals.</CardDescription>
                </CardHeader>
            </Card>

            <div className="flex items-center justify-between px-2 py-2 bg-primary/5 border rounded-lg shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => setViewWeek(subWeeks(viewWeek, 1))}><ChevronLeft className="h-4 w-4 mr-1"/> Prev Week</Button>
                    <div className="font-bold text-sm uppercase tracking-widest text-primary">
                        {format(currentWeekInterval[0], 'MMM dd')} - {format(currentWeekInterval[6], 'MMM dd, yyyy')}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setViewWeek(addWeeks(viewWeek, 1))}>Next Week <ChevronRight className="h-4 w-4 ml-1"/></Button>
                </div>
                <Badge variant="secondary" className="text-[10px] font-black uppercase">Cohort Schedule</Badge>
            </div>

            <Card className="shadow-lg">
                <CardContent className="overflow-x-auto pt-6">
                    {loading ? (
                        <Skeleton className="h-96 w-full" />
                    ) : !hasSlots ? (
                        <Alert variant="secondary"><Info className="h-4 w-4" /><AlertTitle>Matrix View Unavailable</AlertTitle><AlertDescription>Institutional time slots have not been defined by administration.</AlertDescription></Alert>
                    ) : timetable.length === 0 ? (
                        <Alert><Info className="h-4 w-4" /><AlertTitle>No Scheduled Classes</AlertTitle><AlertDescription>You are either not registered for an active semester or your courses haven't been scheduled yet.</AlertDescription></Alert>
                    ) : (
                        <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px] shadow-inner">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 border-b">
                                        <TableHead className="w-32 border-r font-bold text-center">DATE & DAY</TableHead>
                                        {teachingTimes.slots.map((slot, index) => (<TableHead key={index} className="text-center font-bold border-r text-xs">{slot.startTime} - {slot.endTime}</TableHead>))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentWeekInterval.map(date => {
                                        const dayName = calendarDays[getDay(date)];
                                        const isDayToday = isToday(date);
                                        const dateStr = format(date, 'yyyy-MM-dd');

                                        return (
                                            <TableRow key={date.toString()} className={cn(isDayToday && "bg-primary/5")}>
                                                <TableCell className={cn("font-bold text-xs border-r text-center", isDayToday ? "text-primary bg-primary/10" : "bg-muted/20")}>
                                                    <div className="flex flex-col">
                                                        <span className="uppercase text-[10px] opacity-70">{dayName}</span>
                                                        <span className="text-sm font-black">{format(date, 'MMM dd')}</span>
                                                    </div>
                                                </TableCell>
                                                {teachingTimes.slots.map((slot, sIdx) => {
                                                    const slotStart = timeToMinutes(slot.startTime);
                                                    const slotEnd = timeToMinutes(slot.endTime);
                                                    const sessionsInSlot = timetable.filter(e => e.day === dayName && timeToMinutes(e.startTime) >= slotStart && timeToMinutes(e.startTime) < slotEnd);

                                                    return (
                                                        <TableCell key={sIdx} className="p-2 border-r align-top min-h-[100px]">
                                                            <div className="space-y-2">
                                                                {sessionsInSlot.map((entry, eIdx) => {
                                                                    const dateRequest = (entry as any).dateRequests?.[dateStr];
                                                                    const isLiveOnThisDate = dateRequest?.status === 'Approved' || entry.isLiveSession;

                                                                    return (
                                                                        <Link 
                                                                            href={`/student/courses/${entry.courseId}`} 
                                                                            key={eIdx} 
                                                                            className={cn(
                                                                                "block p-2 rounded-md border bg-background shadow-sm hover:ring-2 hover:ring-primary transition-all",
                                                                                isLiveOnThisDate ? "border-blue-500 bg-blue-50/20 shadow-blue-100" : "border-primary/20"
                                                                            )}
                                                                        >
                                                                            <div className="flex justify-between items-start gap-1">
                                                                                <p className="font-bold text-[10px] text-primary leading-tight line-clamp-2" title={entry.courseName}>{entry.courseCode}: {entry.courseName}</p>
                                                                                {isLiveOnThisDate ? <Video className="h-3 w-3 text-blue-600" /> : <Layers className="h-3 w-3 text-primary/40" />}
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1"><MapPin className="h-2.5 w-2.5" /> {isLiveOnThisDate ? "DIGITAL ROOM" : entry.venue}</div>
                                                                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5"><UserCheck className="h-2.5 w-2.5" /> {entry.lecturerNames}</div>
                                                                            <div className="mt-2 text-[9px] font-medium opacity-70 italic">{entry.semesterName}</div>
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
