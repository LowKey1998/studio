'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

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
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const timetablesRef = ref(db, 'timetables');
        const coursesRef = ref(db, 'courses');
        const semestersRef = ref(db, 'semesters');

        const fetchData = async () => {
            setLoading(true);
            try {
                const [timetablesSnap, coursesSnap, semestersSnap] = await Promise.all([
                    onValue(timetablesRef, () => {}),
                    get(coursesRef),
                    get(semestersRef),
                ]);

                const allEntries: TimetableEntry[] = [];
                if (timetablesSnap.snapshot.exists() && coursesSnap.exists() && semestersSnap.exists()) {
                    const allTimetables = timetablesSnap.snapshot.val();
                    const allCourses = coursesSnap.val();
                    const allSemesters = semestersSnap.val();

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
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = onValue(timetablesRef, () => {
            fetchData();
        });
        
        return () => unsubscribe();
    }, []);

    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Master Room Schedule</CardTitle>
                <CardDescription>A consolidated view of all scheduled classes across all rooms and semesters.</CardDescription>
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
                                    timetable
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
                                {timetable.filter(entry => entry.day === day).length === 0 && !loading && <div className="text-center text-xs text-muted-foreground pt-4">No classes</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
