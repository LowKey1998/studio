"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, UserCheck, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

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
    lecturerNames: string;
    studentCount: number;
};

const defaultDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StaffTimetablePage() {
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
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
            const [coursesSnap, timetablesSnap, settingsSnap, usersSnap, regsSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/teachingTimes')),
                get(ref(db, 'users')),
                get(ref(db, 'registrations'))
            ]);

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const regsData = regsSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || defaultDays,
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            // Calculate student counts
            const counts: Record<string, Record<string, number>> = {};
            for (const userId in regsData) {
                for (const semId in regsData[userId]) {
                    const reg = regsData[userId][semId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (!counts[semId]) counts[semId] = {};
                        (reg.courses || []).forEach((cid: string) => {
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

            const entries: TimetableEntry[] = [];
            for (const semId in tData) {
                for (const cId in tData[semId]) {
                    if (myCourseIds.has(cId)) {
                        const courseInfo = cData[cId];
                        const lecturerNames = (courseInfo.lecturerIds || [])
                            .map((uid: string) => usersData[uid]?.name)
                            .filter(Boolean)
                            .join(', ') || usersData[courseInfo.lecturerId]?.name || 'Unassigned';

                        const studentCount = counts[semId]?.[cId] || 0;

                        Object.values(tData[semId][cId]).forEach((entry: any) => {
                            entries.push({
                                ...entry,
                                courseId: cId,
                                courseCode: courseInfo.code,
                                courseName: courseInfo.name,
                                lecturerNames,
                                studentCount
                            });
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
                                            const sessionsInSlot = timetable.filter(e => 
                                                e.day === dayName && 
                                                timeToMinutes(e.startTime) >= slotStart && 
                                                timeToMinutes(e.startTime) < slotEnd
                                            );

                                            return (
                                                <TableCell key={`${dayName}-${slot.id || sIdx}`} className="p-2 border-r align-top min-h-[100px]">
                                                    <div className="space-y-2">
                                                        {sessionsInSlot.map((entry, eIdx) => (
                                                            <Link 
                                                                href={`/staff/courses/${entry.courseId}`}
                                                                key={eIdx} 
                                                                className="block p-2 rounded-md border bg-background border-primary/20 shadow-sm hover:ring-2 hover:ring-primary transition-all group"
                                                            >
                                                                <p className="font-bold text-[10px] text-primary leading-tight group-hover:underline">{entry.courseCode}: {entry.courseName}</p>
                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                                                                    <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-0.5">
                                                                    <UserCheck className="h-2.5 w-2.5" /> {entry.lecturerNames}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 mt-1">
                                                                    <Users className="h-2.5 w-2.5" /> {entry.studentCount} Students
                                                                </div>
                                                                <p className="text-[9px] font-medium mt-0.5">{entry.startTime} - {entry.endTime}</p>
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
