"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, UserCheck, Users, Layers } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { parseIntakeDate } from '@/lib/semester-utils';

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

export default function StaffTimetablePage() {
    const [mergedTimetable, setMergedTimetable] = React.useState<MergedEntry[]>([]);
    const [teachingTimes, setTeachingTimes] = React.useState<{ days: string[], slots: TimeSlot[] }>({ days: defaultDays, slots: [] });
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [coursesSnap, timetablesSnap, settingsSnap, usersSnap, regsSnap, semestersSnap, intakesSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes'))
            ]);

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const regsData = regsSnap.val() || {};
            const sData = semestersSnap.val() || {};
            const iData = intakesSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || defaultDays,
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            // Calculate student counts per [semId][courseId]
            const counts: Record<string, Record<string, number>> = {};
            for (const userId in regsData) {
                for (const semId in regsData[userId]) {
                    const reg = regsData[userId][semId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (!counts[semId]) counts[semId] = {};
                        const coursesArr = Array.isArray(reg.courses) ? reg.courses : (reg.courses ? Object.keys(reg.courses) : []);
                        coursesArr.forEach((cid: string) => {
                            counts[semId][cid] = (counts[semId][cid] || 0) + 1;
                        });
                    }
                }
            }

            const myCourseIds = new Set<string>();
            Object.entries(cData).forEach(([id, c]: [string, any]) => {
                const lIds = c.lecturerIds || [];
                if ((Array.isArray(lIds) && lIds.includes(currentUser.uid)) || (c.lecturerId === currentUser.uid)) {
                    myCourseIds.add(id);
                }
            });

            // Flatten all my sessions
            const rawEntries: TimetableEntry[] = [];
            for (const semId in tData) {
                const semInfo = sData[semId] || { name: semId === 'master' ? 'Master Schedule' : 'Manual Entry' };
                for (const cId in tData[semId]) {
                    if (myCourseIds.has(cId)) {
                        const courseInfo = cData[cId];
                        const lecturerNames = (courseInfo.lecturerIds || [])
                            .map((uid: string) => usersData[uid]?.name)
                            .filter(Boolean)
                            .join(', ') || usersData[courseInfo.lecturerId]?.name || 'Unassigned';

                        Object.values(tData[semId][cId]).forEach((entry: any) => {
                            rawEntries.push({
                                ...entry,
                                courseId: cId,
                                courseCode: courseInfo.code,
                                courseName: courseInfo.name,
                                semesterId: semId,
                                semesterName: semInfo.name,
                                lecturerNames,
                                intakeName: entry.intakeName || iData[semInfo.intakeId]?.name || 'N/A'
                            });
                        });
                    }
                }
            }

            // Merge shared sessions and calculate correct student counts
            const mergedMap = new Map<string, MergedEntry>();
            rawEntries.forEach(entry => {
                const course = cData[entry.courseId];
                const key = course?.separateInstance 
                    ? `${entry.courseId}-${entry.day}-${entry.startTime}-${entry.venue}-${entry.semesterId}`
                    : `${entry.courseId}-${entry.day}-${entry.startTime}-${entry.venue}`;

                if (!mergedMap.has(key)) {
                    mergedMap.set(key, {
                        key,
                        entry,
                        totalStudents: 0,
                        participants: []
                    });
                }

                const merged = mergedMap.get(key)!;
                const sem = sData[entry.semesterId];
                const standing = sem ? `Y${sem.year}S${sem.semesterInYear}` : 'N/A';
                
                // Get correct count for this specific entry
                let count = 0;
                if (entry.semesterId !== 'master') {
                    count = counts[entry.semesterId]?.[entry.courseId] || 0;
                } else {
                    // For master entries, if separate, count only matching intake. If shared, count all active.
                    if (course?.separateInstance) {
                        const matchingIntakeId = Object.keys(iData).find(id => iData[id].name === entry.intakeName);
                        Object.keys(sData).forEach(sId => {
                            if (sData[sId].intakeId === matchingIntakeId && sData[sId].status !== 'Archived') {
                                count += counts[sId]?.[entry.courseId] || 0;
                            }
                        });
                    } else {
                        Object.keys(sData).forEach(sId => {
                            if (sData[sId].status !== 'Archived') {
                                count += counts[sId]?.[entry.courseId] || 0;
                            }
                        });
                    }
                }

                if (!merged.participants.find(p => p.name === entry.intakeName && p.standing === standing)) {
                    merged.participants.push({ name: entry.intakeName, standing, count });
                    merged.totalStudents += count;
                }
            });

            setMergedTimetable(Array.from(mergedMap.values()));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const displayDays = teachingTimes.days.length > 0 ? teachingTimes.days : defaultDays;
    const hasSlots = teachingTimes.slots.length > 0;

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">My Teaching Schedule</CardTitle>
                <CardDescription>Your weekly recurring classes across all active semesters. Click a class to manage it.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                {loading ? (
                    <Skeleton className="h-96 w-full" />
                ) : !hasSlots ? (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Matrix View Unavailable</AlertTitle>
                        <AlertDescription>The administration has not yet defined the institutional time slots required for the matrix view.</AlertDescription>
                    </Alert>
                ) : (
                    <div className="border rounded-lg overflow-hidden bg-muted/10 min-w-[800px]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-32 border-r font-bold text-center">DAY</TableHead>
                                    {teachingTimes.slots.map((slot, index) => (
                                        <TableHead key={slot.id || index} className="text-center font-bold border-r">
                                            <span className="text-xs">{slot.startTime} - {slot.endTime}</span>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayDays.map(dayName => (
                                    <TableRow key={dayName}>
                                        <TableCell className="font-bold text-xs uppercase tracking-wider text-center border-r bg-muted/20">{dayName}</TableCell>
                                        {teachingTimes.slots.map((slot, sIdx) => {
                                            const slotStart = timeToMinutes(slot.startTime);
                                            const slotEnd = timeToMinutes(slot.endTime);
                                            const sessionsInSlot = mergedTimetable.filter(m => 
                                                m.entry.day === dayName && 
                                                timeToMinutes(m.entry.startTime) >= slotStart && 
                                                timeToMinutes(m.entry.startTime) < slotEnd
                                            );

                                            return (
                                                <TableCell key={`${dayName}-${slot.id || sIdx}`} className="p-2 border-r align-top min-h-[100px]">
                                                    <div className="space-y-2">
                                                        {sessionsInSlot.map((m, eIdx) => (
                                                            <Link 
                                                                href={`/staff/courses/${m.entry.courseId}`}
                                                                key={eIdx} 
                                                                className="block p-2 rounded-md border bg-background border-primary/20 shadow-sm hover:ring-2 hover:ring-primary transition-all group"
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <p className="font-bold text-[10px] text-primary leading-tight group-hover:underline">{m.entry.courseCode}: {m.entry.courseName}</p>
                                                                    {m.participants.length > 1 && <Layers className="h-3 w-3 text-primary/40" />}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                                                                    <MapPin className="h-2.5 w-2.5" /> {m.entry.venue}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 mt-1">
                                                                    <Users className="h-2.5 w-2.5" /> {m.totalStudents} Students
                                                                </div>
                                                                <div className="mt-2 flex flex-wrap gap-1 border-t pt-1">
                                                                    {m.participants.map((p, pIdx) => (
                                                                        <Badge key={pIdx} variant="secondary" className="text-[8px] h-4 px-1">
                                                                            {p.name} ({p.standing}): {p.count}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
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
    );
}
