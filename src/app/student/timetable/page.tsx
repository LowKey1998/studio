
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    courseCode: string;
    courseName: string;
    semesterId: string;
};

const defaultDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentTimetablePage() {
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
            const [regsSnap, coursesSnap, timetablesSnap, settingsSnap] = await Promise.all([
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'courses')),
                get(ref(db, 'timetables')),
                get(ref(db, 'settings/teachingTimes'))
            ]);

            if (!regsSnap.exists()) {
                setTimetable([]);
                setLoading(false);
                return;
            }

            // Map enrolled course IDs to their specific registration semesterId
            const enrolledCourseSemesters = new Map<string, Set<string>>(); // courseId -> Set of semesterIds
            Object.entries(regsSnap.val()).forEach(([semId, reg]: [string, any]) => {
                if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                    (reg.courses || []).forEach((cid: string) => {
                        if (!enrolledCourseSemesters.has(cid)) enrolledCourseSemesters.set(cid, new Set());
                        enrolledCourseSemesters.get(cid)!.add(semId);
                    });
                }
            });

            const cData = coursesSnap.val() || {};
            const tData = timetablesSnap.val() || {};
            const settingsData = settingsSnap.val() || {};

            setTeachingTimes({
                days: settingsData.days || defaultDays,
                slots: (settingsData.slots || []).sort((a: TimeSlot, b: TimeSlot) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            });

            const entries: TimetableEntry[] = [];
            // Iterate through semesters in the timetable
            for (const semId in tData) {
                // Iterate through courses in that semester's timetable
                for (const cId in tData[semId]) {
                    // Check if the student is registered for this specific course in this specific semester
                    if (enrolledCourseSemesters.get(cId)?.has(semId)) {
                        const courseInfo = cData[cId];
                        if (courseInfo) {
                            Object.values(tData[semId][cId]).forEach((entry: any) => {
                                entries.push({
                                    ...entry,
                                    courseCode: courseInfo.code,
                                    courseName: courseInfo.name,
                                    semesterId: semId
                                });
                            });
                        }
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
                <CardTitle className="font-headline text-2xl">My Weekly Timetable</CardTitle>
                <CardDescription>Your weekly class schedule based on your current enrolled courses.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                {loading ? (
                    <Skeleton className="h-96 w-full" />
                ) : !hasSlots ? (
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Matrix View Unavailable</AlertTitle>
                        <AlertDescription>The administration has not yet published the standard teaching time slots.</AlertDescription>
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
                                                            <div key={eIdx} className="p-2 rounded-md border bg-background border-primary/20 shadow-sm">
                                                                <p className="font-bold text-[10px] text-primary leading-tight">{entry.courseCode}: {entry.courseName}</p>
                                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1">
                                                                    <MapPin className="h-2.5 w-2.5" /> {entry.venue}
                                                                </div>
                                                                <p className="text-[9px] font-medium mt-0.5">{entry.startTime} - {entry.endTime}</p>
                                                            </div>
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
