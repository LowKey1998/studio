'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseCode: string;
    courseName: string;
    semesterName: string;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function RoomSchedulingPage() {
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [allRooms, setAllRooms] = React.useState<{id: string, name: string}[]>([]);
    const [roomFilter, setRoomFilter] = React.useState('all');
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const timetablesRef = ref(db, 'timetables');
        const roomsRef = ref(db, 'settings/rooms');

        const fetchDataAndListen = async () => {
            setLoading(true);
            try {
                // Initial fetch for static data
                const [coursesSnap, semestersSnap] = await Promise.all([
                    get(ref(db, 'courses')),
                    get(ref(db, 'semesters')),
                ]);

                const allCourses = coursesSnap.exists() ? coursesSnap.val() : {};
                const allSemesters = semestersSnap.exists() ? semestersSnap.val() : {};

                // Listener for timetables
                onValue(timetablesRef, (snapshot) => {
                    const allEntries: TimetableEntry[] = [];
                    if (snapshot.exists()) {
                        const allTimetables = snapshot.val();
                        for (const semesterId in allTimetables) {
                            for (const courseId in allTimetables[semesterId]) {
                                const courseCode = allCourses[courseId]?.code || 'N/A';
                                const courseName = allCourses[courseId]?.name || 'Unknown Course';
                                const semesterName = allSemesters[semesterId]?.name || 'Unknown Semester';
                                const entries = allTimetables[semesterId][courseId];
                                for (const entryId in entries) {
                                    allEntries.push({ ...entries[entryId], courseCode, courseName, semesterName });
                                }
                            }
                        }
                    }
                    setTimetable(allEntries);
                    setLoading(false);
                });

                 onValue(roomsRef, (snapshot) => {
                    if (snapshot.exists()) {
                        setAllRooms(Object.entries(snapshot.val()).map(([id, room]: [string, any]) => ({ id, name: room.name })));
                    }
                 });

            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        };

        fetchDataAndListen();
    }, []);

    const filteredTimetable = React.useMemo(() => {
        if (roomFilter === 'all') {
            return timetable;
        }
        return timetable.filter(entry => entry.venue === roomFilter);
    }, [timetable, roomFilter]);

    const timeToMinutes = (time: string) => {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Master Room Schedule</CardTitle>
                <CardDescription>A consolidated view of all scheduled classes across all rooms and semesters.</CardDescription>
                <div className="pt-4 max-w-xs">
                    <Label htmlFor="room-filter">Filter by Room</Label>
                     <Select value={roomFilter} onValueChange={setRoomFilter}>
                        <SelectTrigger id="room-filter">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Rooms</SelectItem>
                            {allRooms.map(room => (
                                <SelectItem key={room.id} value={room.name}>{room.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-px border bg-border overflow-hidden rounded-lg">
                    {daysOfWeek.map(day => (
                        <div key={day} className="bg-card">
                            <h3 className="font-semibold text-center p-2 border-b bg-muted/50">{day}</h3>
                            <div className="p-2 space-y-2 min-h-screen">
                                {loading ? (
                                    <Skeleton className="h-20 w-full" />
                                ) : (
                                    filteredTimetable
                                        .filter(entry => entry.day === day)
                                        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                                        .map((entry, index) => (
                                            <div key={index} className="p-2 rounded-md bg-primary/10 text-primary-foreground border border-primary/20">
                                                <p className="font-bold text-sm text-primary">{entry.venue}</p>
                                                <p className="text-xs text-primary/80">{entry.startTime} - {entry.endTime}</p>
                                                <p className="text-xs text-primary/80">{entry.courseCode} - {entry.courseName}</p>
                                                <p className="text-xs text-muted-foreground">{entry.semesterName}</p>
                                            </div>
                                        ))
                                )}
                                {filteredTimetable.filter(entry => entry.day === day).length === 0 && !loading && <div className="text-center text-xs text-muted-foreground pt-4">No classes</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
