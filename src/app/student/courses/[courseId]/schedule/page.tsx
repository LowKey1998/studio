
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useParams } from 'next/navigation';

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function CourseSchedulePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser || !courseId) return;

        const fetchTimetable = async () => {
            setLoading(true);
            try {
                const timetablesRef = ref(db, 'timetables');
                const timetablesSnap = await get(timetablesRef);
                const allEntries: TimetableEntry[] = [];
                if (timetablesSnap.exists()) {
                    const allTimetables = timetablesSnap.val();
                    for (const semesterId in allTimetables) {
                        if (allTimetables[semesterId][courseId]) {
                            const entries = allTimetables[semesterId][courseId];
                            for (const entryId in entries) {
                                allEntries.push({ ...entries[entryId] });
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

        fetchTimetable();
    }, [currentUser, courseId]);
    
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Weekly Schedule</CardTitle>
                <CardDescription>Your weekly class schedule for this course.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-px border bg-border overflow-hidden rounded-lg">
                    {daysOfWeek.map(day => (
                        <div key={day} className="bg-card">
                            <h3 className="font-semibold text-center p-2 border-b bg-muted/50">{day}</h3>
                            <div className="p-2 space-y-2 min-h-48">
                                {loading ? (
                                    <Skeleton className="h-20 w-full" />
                                ) : (
                                    timetable
                                        .filter(entry => entry.day === day)
                                        .sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                                        .map((entry, index) => (
                                            <div key={index} className="p-2 rounded-md bg-primary/10 text-primary-foreground border border-primary/20">
                                                <p className="text-sm text-primary/80">{entry.startTime} - {entry.endTime}</p>
                                                <p className="text-sm font-semibold text-primary">{entry.venue}</p>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
