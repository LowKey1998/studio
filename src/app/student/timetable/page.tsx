
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';
import { Calendar } from '@/components/ui/calendar';
import { eachDayOfInterval, format, getDay, isSameMonth, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type TimetableEntry = {
    courseId: string;
    day: string; // "Monday", "Tuesday", etc.
    startTime: string;
    endTime: string;
    venue: string;
    courseCode: string;
    courseName: string;
};

type ClassOverride = {
    originalDate: string;
    newDate?: string;
    newTime?: string;
    status: 'rescheduled' | 'cancelled';
};

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeToMinutes = (time: string) => {
    if(!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentCalendarViewPage() {
    const [allEntries, setAllEntries] = React.useState<TimetableEntry[]>([]);
    const [allOverrides, setAllOverrides] = React.useState<Record<string, Record<string, ClassOverride>>>({});
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [month, setMonth] = React.useState(new Date());

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const fetchTimetable = async () => {
            setLoading(true);
            try {
                const regsSnap = await get(ref(db, `registrations/${currentUser.uid}`));
                if (!regsSnap.exists()) {
                    setAllEntries([]); setLoading(false); return;
                }

                const enrolledCourseIds = new Set<string>();
                Object.values(regsSnap.val()).forEach((reg: any) => {
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        reg.courses.forEach((id: string) => enrolledCourseIds.add(id));
                    }
                });
                
                const [coursesSnap, timetablesSnap, overridesSnap] = await Promise.all([
                    get(ref(db, 'courses')),
                    get(ref(db, 'timetables')),
                    get(ref(db, 'classOverrides'))
                ]);

                const entries: TimetableEntry[] = [];
                if (timetablesSnap.exists() && coursesSnap.exists()) {
                    const allTimetables = timetablesSnap.val();
                    const allCourses = coursesSnap.val();
                    for (const semesterId in allTimetables) {
                        for (const courseId in allTimetables[semesterId]) {
                            if (enrolledCourseIds.has(courseId)) {
                                Object.values(allTimetables[semesterId][courseId]).forEach((entry: any) => {
                                    entries.push({
                                        ...entry,
                                        courseId,
                                        courseCode: allCourses[courseId]?.code || 'N/A',
                                        courseName: allCourses[courseId]?.name || 'Unknown',
                                    });
                                });
                            }
                        }
                    }
                }
                setAllEntries(entries);
                setAllOverrides(overridesSnap.exists() ? overridesSnap.val() : {});

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchTimetable();
    }, [currentUser]);

    const dailyClasses = React.useMemo(() => {
        const classesByDate: Record<string, TimetableEntry[]> = {};
        if (allEntries.length === 0 && Object.keys(allOverrides).length === 0) return classesByDate;

        const interval = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

        interval.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            let finalEntriesForDay: TimetableEntry[] = [];
            
            const dayOfWeek = daysOfWeek[getDay(day)];
            const recurringEntries = allEntries.filter(entry => entry.day === dayOfWeek);

            recurringEntries.forEach(entry => {
                const overrideForThisDate = allOverrides[entry.courseId]?.[dateStr];
                if (!overrideForThisDate || overrideForThisDate.status !== 'cancelled') {
                    finalEntriesForDay.push(entry);
                }
            });

            for (const courseId in allOverrides) {
                 const rescheduledToThisDay = Object.values(allOverrides[courseId] || {}).find(ov => ov.status === 'rescheduled' && ov.newDate === dateStr);
                 if (rescheduledToThisDay) {
                     const originalEntryDetails = allEntries.find(e => e.courseId === courseId);
                     if (originalEntryDetails) {
                        finalEntriesForDay = finalEntriesForDay.filter(e => e.courseId !== courseId);
                        finalEntriesForDay.push({ 
                            ...originalEntryDetails, 
                            day: format(day, 'EEEE'),
                            startTime: rescheduledToThisDay.newTime || originalEntryDetails.startTime
                        });
                     }
                 }
            }

            if (finalEntriesForDay.length > 0) {
                classesByDate[dateStr] = finalEntriesForDay.sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            }
        });
        return classesByDate;
    }, [month, allEntries, allOverrides]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">My Calendar</CardTitle>
                <CardDescription>Your monthly class schedule, including any rescheduled or cancelled classes.</CardDescription>
            </CardHeader>
            <CardContent>
                <Calendar
                    mode="single"
                    month={month}
                    onMonthChange={setMonth}
                    components={{
                        DayContent: ({ date }) => {
                             const dateStr = format(date, 'yyyy-MM-dd');
                             const classes = dailyClasses[dateStr];
                             return (
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <div className={cn("relative w-full h-full p-1 cursor-pointer hover:bg-accent/50 rounded-md", isToday(date) && "font-bold bg-accent/80")}>
                                             <span className="absolute top-1 left-1">{format(date, 'd')}</span>
                                             {classes && (
                                                <div className="absolute bottom-1 right-1 flex items-center justify-center h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full">
                                                    {classes.length}
                                                </div>
                                             )}
                                         </div>
                                    </PopoverTrigger>
                                    {classes && (
                                     <PopoverContent className="w-80">
                                        <h4 className="font-semibold mb-2">{format(date, 'PPP')}</h4>
                                        <div className="space-y-2">
                                            {classes.map((c, i) => (
                                                <Link key={i} href={`/student/courses/${c.courseId}`} passHref>
                                                    <div className="text-xs p-2 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer">
                                                        <p className="font-bold text-primary">{c.courseName}</p>
                                                        <p>{c.startTime} - {c.endTime} @ {c.venue}</p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                     </PopoverContent>
                                    )}
                                </Popover>
                             )
                        },
                         Caption: ({...props}) => {
                             const currentMonth = format(props.displayMonth, 'MMMM yyyy');
                             return (
                                <div className="flex items-center justify-between px-2 py-4">
                                    <h2 className="font-semibold text-lg">{currentMonth}</h2>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                             )
                         }
                    }}
                    className="w-full"
                />
            </CardContent>
        </Card>
    );
}
