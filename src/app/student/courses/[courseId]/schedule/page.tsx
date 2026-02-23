'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileCheck, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    intakeName?: string;
    examDate?: string;
    examTime?: string;
    examVenue?: string;
};

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function CourseSchedulePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const { user, userProfile, loading: authLoading } = useAuth();
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchTimetable = React.useCallback(async () => {
        if (!user?.uid || !userProfile || !courseId) return;
        setLoading(true);
        try {
            const [regsSnap, semestersSnap, timetablesSnap, courseSnap, intakesSnap] = await Promise.all([
                get(ref(db, `registrations/${user.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'timetables')),
                get(ref(db, `courses/${courseId}`)),
                get(ref(db, 'intakes'))
            ]);

            const allSemesters = semestersSnap.val() || {};
            const courseData = courseSnap.val();
            const allIntakes = intakesSnap.val() || {};
            const studentIntakeName = userProfile.intakeId ? allIntakes[userProfile.intakeId]?.name : null;

            if (!courseData) { setLoading(false); return; }

            const enrolledSemesterIds = new Set<string>();
            if (regsSnap.exists()) {
                Object.entries(regsSnap.val()).forEach(([semId, reg]: [string, any]) => {
                    const semInfo = allSemesters[semId];
                    if (semId !== 'master' && semInfo?.status === 'Archived') return;

                    if (reg.courses && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                        const coursesArr = Array.isArray(reg.courses) ? reg.courses : (reg.courses ? Object.keys(reg.courses) : []);
                        if (coursesArr.includes(courseId)) {
                            enrolledSemesterIds.add(semId);
                        }
                    }
                });
            }

            const allEntries: TimetableEntry[] = [];
            if (timetablesSnap.exists()) {
                const allTimetables = timetablesSnap.val();
                for (const semesterId in allTimetables) {
                    if (semesterId !== 'master' && allSemesters[semesterId]?.status === 'Archived') continue;

                    const isRegisteredForThisBranch = enrolledSemesterIds.has(semesterId);
                    const isRegisteredAtAll = enrolledSemesterIds.size > 0;

                    if (allTimetables[semesterId][courseId]) {
                        const entries = Object.values(allTimetables[semesterId][courseId]) as any[];
                        entries.forEach(entry => {
                            let shouldInclude = false;
                            
                            if (semesterId === 'master') {
                                if (courseData.separateInstance) {
                                    shouldInclude = studentIntakeName && entry.intakeName === studentIntakeName;
                                } else {
                                    shouldInclude = isRegisteredAtAll;
                                }
                            } else {
                                shouldInclude = isRegisteredForThisBranch;
                            }

                            if (shouldInclude) {
                                allEntries.push({ ...entry });
                            }
                        });
                    }
                }
            }
            setTimetable(allEntries);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [user, userProfile, courseId]);

    React.useEffect(() => {
        if (!authLoading && user && userProfile) {
            fetchTimetable();
        } else if (!authLoading && !user) {
            setLoading(false);
        }
    }, [user, userProfile, authLoading, fetchTimetable]);
    
    const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const examInfo = timetable.find(e => !!e.examDate);

    return (
        <div className="space-y-6">
            {examInfo && (
                <Alert className="bg-red-50 border-2 border-red-200 shadow-lg animate-in fade-in zoom-in duration-500">
                    <FileCheck className="h-5 w-5 text-red-600" />
                    <AlertTitle className="font-black uppercase tracking-widest text-red-800">Official Examination Schedule</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                        <div className="space-y-2">
                            <p className="text-lg font-black text-red-700">{format(parseISO(examInfo.examDate!), 'PPPP')}</p>
                            <div className="flex flex-wrap gap-4 text-sm font-bold text-red-600/80">
                                {examInfo.examTime && (
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4" />
                                        <span>Start Time: {examInfo.examTime}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4" />
                                    <span>Venue: {examInfo.examVenue || 'TBA'}</span>
                                </div>
                            </div>
                        </div>
                        <Badge variant="destructive" className="w-fit h-10 px-6 font-black uppercase tracking-widest shadow-md">Examination</Badge>
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Weekly Schedule</CardTitle>
                    <CardDescription>Your regular weekly class rotation.</CardDescription>
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
                                                    <p className="text-sm text-primary/80 font-bold">{entry.startTime} - {entry.endTime}</p>
                                                    <p className="text-xs font-semibold text-primary/70 mt-1 flex items-center gap-1"><MapPin className="h-3 w-3"/> {entry.venue}</p>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}