
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseCode: string;
    courseName: string;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function StudentTimetablePage() {
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
        if (!currentUser) return;

        const fetchTimetable = async () => {
            setLoading(true);
            try {
                // Get student's enrolled courses
                const regsRef = ref(db, `registrations/${currentUser.uid}`);
                const regsSnap = await get(regsRef);
                const enrolledCourseIds = new Set<string>();
                if (regsSnap.exists()) {
                    const regsData = regsSnap.val();
                    for (const semester in regsData) {
                        if (regsData[semester].status === 'Completed') {
                            regsData[semester].courses.forEach((id: string) => enrolledCourseIds.add(id));
                        }
                    }
                }
                
                if (enrolledCourseIds.size === 0) {
                    setTimetable([]);
                    setLoading(false);
                    return;
                }

                // Get all timetables and filter
                const [coursesSnap, timetablesSnap] = await Promise.all([
                    get(ref(db, 'courses')),
                    get(ref(db, 'timetables'))
                ]);
                
                const allEntries: TimetableEntry[] = [];
                if (timetablesSnap.exists() && coursesSnap.exists()) {
                    const allTimetables = timetablesSnap.val();
                    const allCourses = coursesSnap.val();

                    for (const semester in allTimetables) {
                        for (const courseId in allTimetables[semester]) {
                            if (enrolledCourseIds.has(courseId)) {
                                const courseCode = allCourses[courseId]?.code || 'N/A';
                                const courseName = allCourses[courseId]?.name || 'Unknown Course';
                                const entries = allTimetables[semester][courseId];
                                for (const entryId in entries) {
                                    allEntries.push({ ...entries[entryId], courseCode, courseName });
                                }
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
    }, [currentUser]);
    
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">My Weekly Timetable</CardTitle>
                <CardDescription>Your consolidated class schedule for the week.</CardDescription>
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
                                                <p className="font-bold text-sm text-primary">{entry.courseName}</p>
                                                <p className="text-xs text-primary/80">{entry.courseCode}</p>
                                                <p className="text-xs text-primary/80">{entry.startTime} - {entry.endTime}</p>
                                                <p className="text-xs text-primary/80">Venue: {entry.venue}</p>
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

