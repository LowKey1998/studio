'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
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

export default function StaffTimetablePage() {
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
        if (!currentUser?.uid) return;

        const fetchTimetable = async () => {
            setLoading(true);
            try {
                // Get all courses and filter by lecturer assignment
                const coursesRef = ref(db, 'courses');
                const coursesSnap = await get(coursesRef);
                const assignedCourseIds: string[] = [];
                if(coursesSnap.exists()) {
                    const allCourses = coursesSnap.val();
                    for(const courseId in allCourses) {
                        const courseData = allCourses[courseId];
                        const lecturerIds = courseData.lecturerIds || [];
                        const isAssigned = (Array.isArray(lecturerIds) && lecturerIds.includes(currentUser.uid)) || (courseData.lecturerId === currentUser.uid);
                        
                        if (isAssigned) {
                            assignedCourseIds.push(courseId);
                        }
                    }
                }

                if (assignedCourseIds.length === 0) {
                    setTimetable([]);
                    setLoading(false);
                    return;
                }

                // Get all timetables and filter
                const timetablesRef = ref(db, 'timetables');
                const timetablesSnap = await get(timetablesRef);
                const allEntries: TimetableEntry[] = [];
                if (timetablesSnap.exists()) {
                    const allTimetables = timetablesSnap.val();
                    const allCourses = coursesSnap.val();
                    for (const semester in allTimetables) {
                        for (const courseId in allTimetables[semester]) {
                            if (assignedCourseIds.includes(courseId)) {
                                const courseCode = allCourses[courseId].code;
                                const courseName = allCourses[courseId].name;
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
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">My Weekly Timetable</CardTitle>
                <CardDescription>Your consolidated teaching schedule for the week.</CardDescription>
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