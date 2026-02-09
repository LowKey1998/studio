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

export default function StaffTimetablePage() {
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    React.useEffect(() => {
        if (!currentUser?.uid) return;

        const fetchTimetable = async () => {
            setLoading(true);
            try {
                const coursesRef = ref(db, 'courses');
                const coursesSnap = await get(coursesRef);
                const myCourseIds = new Set<string>();
                if(coursesSnap.exists()) {
                    Object.entries(coursesSnap.val()).forEach(([id, c]: [string, any]) => {
                        const lIds = c.lecturerIds || [];
                        if((Array.isArray(lIds) && lIds.includes(currentUser.uid)) || (c.lecturerId === currentUser.uid)) {
                            myCourseIds.add(id);
                        }
                    });
                }

                const timetablesRef = ref(db, 'timetables');
                const timetablesSnap = await get(timetablesRef);
                const allEntries: TimetableEntry[] = [];
                if (timetablesSnap.exists()) {
                    const allT = timetablesSnap.val();
                    const allC = coursesSnap.val();
                    for (const semId in allT) {
                        for (const cId in allT[semId]) {
                            if (myCourseIds.has(cId)) {
                                Object.values(allT[semId][cId]).forEach((entry: any) => {
                                    allEntries.push({ ...entry, courseCode: allC[cId].code, courseName: allC[cId].name });
                                });
                            }
                        }
                    }
                }
                setTimetable(allEntries);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchTimetable();
    }, [currentUser]);
    
    return (
        <Card>
            <CardHeader><CardTitle className="font-headline text-2xl">My Timetable</CardTitle><CardDescription>Your weekly teaching schedule.</CardDescription></CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-px border bg-border overflow-hidden rounded-lg">
                    {daysOfWeek.map(day => (
                        <div key={day} className="bg-card min-h-48">
                            <h3 className="font-semibold text-center p-2 border-b bg-muted/50">{day}</h3>
                            <div className="p-2 space-y-2">
                                {loading ? <Skeleton className="h-20 w-full" /> :
                                timetable.filter(e => e.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map((e, i) => (
                                    <div key={i} className="p-2 text-xs rounded-md bg-primary/10 border border-primary/20">
                                        <p className="font-bold text-primary">{e.courseName}</p>
                                        <p>{e.startTime} - {e.endTime}</p>
                                        <p>Venue: {e.venue}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
