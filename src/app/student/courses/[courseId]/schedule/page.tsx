'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

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
    const { user, loading: authLoading } = useAuth();
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchTimetable = React.useCallback(async () => {
        if (!user?.uid || !courseId) return;
        setLoading(true);
        try {
            const [regsSnap, semestersSnap, timetablesSnap, courseSnap] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'timetables')),
                get(ref(db, `courses/${courseId}`))
            ]);

            const allSemesters = semestersSnap.val() || {};
            const courseData = courseSnap.val();
            if (!courseData) { setLoading(false); return; }

            const enrolledSemesterIds = new Set<string>();
            if (regsSnap.exists()) {
                Object.entries(regsSnap.val()).forEach(([semId, reg]: [string, any]) => {
                    const semInfo = allSemesters[semId];
                    // Only consider active/open semesters
                    if (semId !== 'master' && semInfo?.status === 'Archived') return;

                    if (reg.courses && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                        if (reg.courses.includes(courseId)) {
                            enrolledSemesterIds.add(semId);
                        }
                    }
                });
            }

            const allEntries: TimetableEntry[] = [];
            if (timetablesSnap.exists()) {
                const allTimetables = timetablesSnap.val();
                for (const semesterId in allTimetables) {
                    // Skip archived branches
                    if (semesterId !== 'master' && allSemesters[semesterId]?.status === 'Archived') continue;

                    const isRegisteredForThisSemBranch = enrolledSemesterIds.has(semesterId);
                    const isRegisteredAtAll = enrolledSemesterIds.size > 0;

                    let shouldInclude = false;
                    if (courseData.separateInstance) {
                        // Separate instances MUST match the specific semester branch
                        shouldInclude = isRegisteredForThisSemBranch;
                    } else {
                        // Shared instances can be in specific branch OR master branch
                        shouldInclude = isRegisteredForThisSemBranch || (semesterId === 'master' && isRegisteredAtAll);
                    }

                    if (shouldInclude && allTimetables[semesterId][courseId]) {
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
    }, [user, courseId]);

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchTimetable();
        } else if (!authLoading && !user) {
            setLoading(false);
        }
    }, [user, authLoading, fetchTimetable]);
    
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
