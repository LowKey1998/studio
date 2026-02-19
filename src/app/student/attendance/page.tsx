'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Hand, CheckCircle, XCircle, Clock, CalendarDays } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Badge } from '@/components/ui/badge';

type Course = {
    id: string;
    name: string;
    code: string;
};

type AttendanceSummary = {
    course: Course;
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
}

export default function StudentAttendancePage() {
    const [attendanceSummaries, setAttendanceSummaries] = React.useState<AttendanceSummary[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [academicStanding, setAcademicStanding] = React.useState<string>('');
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
      }, []);

    const fetchAttendanceData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [usersSnap, regsSnap, coursesSnap, attendanceSnap, calendarSnap, semestersSnap, intakesSnap] = await Promise.all([
                get(ref(db, `users/${currentUser.uid}`)),
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'courses')),
                get(ref(db, 'attendance')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes'))
            ]);

            if (!usersSnap.exists()) throw new Error("Profile not found");
            const userProfile = usersSnap.val();
            const intakeId = userProfile.intakeId;
            const allIntakes = intakesSnap.val() || {};
            const intakeName = intakeId ? allIntakes[intakeId]?.name : null;

            if (!intakeName || !calendarSnap.exists()) {
                setAttendanceSummaries([]);
                setLoading(false);
                return;
            }

            // 1. Calculate Current Standing
            const intakeStartStr = parseIntakeDate(intakeName);
            const calSettings = calendarSnap.val();
            let matchingSemesterId: string | null = null;

            if (intakeStartStr) {
                const state = calculateAcademicState(
                    intakeStartStr, 
                    new Date(), 
                    calSettings.standardCycles, 
                    Object.values(calSettings.anomalies || {})
                );
                setAcademicStanding(`Year ${state.year}, Sem ${state.semester}`);

                // 2. Find matching Semester Record
                const allSemesters = semestersSnap.val() || {};
                const matchingSemesterEntry = Object.entries(allSemesters).find(([_, s]: [string, any]) => {
                    return s.intakeId === intakeId && 
                           s.year === state.year && 
                           s.semesterInYear === state.semester;
                });
                matchingSemesterId = matchingSemesterEntry ? matchingSemesterEntry[0] : null;
            }

            if (!matchingSemesterId || !regsSnap.exists()) {
                setAttendanceSummaries([]);
                setLoading(false);
                return;
            }

            // 3. Filter to Current Semester Enrollment only
            const currentReg = regsSnap.val()[matchingSemesterId];
            if (!currentReg || (currentReg.status !== 'Completed' && currentReg.status !== 'Pending Payment')) {
                setAttendanceSummaries([]);
                setLoading(false);
                return;
            }

            const currentCourseIds = Array.isArray(currentReg.courses) ? currentReg.courses : Object.keys(currentReg.courses || {});
            const summaries: AttendanceSummary[] = [];
            const allCourses = coursesSnap.val() || {};
            const allAttendance = attendanceSnap.val() || {};
            
            for (const courseId of currentCourseIds) {
                const courseAttendance = allAttendance[courseId];
                let present = 0, absent = 0, late = 0;
                let totalLectures = 0;
                
                if (courseAttendance) {
                    Object.values(courseAttendance).forEach((dailyRecord: any) => {
                        const status = dailyRecord[currentUser.uid];
                        if (status) {
                            totalLectures++;
                            if (status === 'Present') present++;
                            else if (status === 'Absent') absent++;
                            else if (status === 'Late') late++;
                            else if (status === 'Excused Absence') present++; // Count as present for percentage
                        }
                    });
                }
                const percentage = totalLectures > 0 ? ((present + late) / totalLectures) * 100 : -1;
                
                summaries.push({
                    course: {
                        id: courseId,
                        name: allCourses[courseId]?.name || "Unknown Course",
                        code: allCourses[courseId]?.code || "N/A"
                    },
                    present, absent, late, total: totalLectures, percentage
                });
            }
            setAttendanceSummaries(summaries);

        } catch (error) {
            console.error("Error fetching attendance data:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your attendance data." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);


    React.useEffect(() => {
        if (currentUser) {
            fetchAttendanceData();
        }
    }, [currentUser, fetchAttendanceData]);
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl">My Attendance</CardTitle>
                            <CardDescription>Track your reliability for classes in your current academic phase.</CardDescription>
                        </div>
                        {academicStanding && (
                            <Badge variant="secondary" className="w-fit gap-2 h-10 px-4 text-sm font-bold border-primary/20 bg-primary/5">
                                <CalendarDays className="h-4 w-4" />
                                Standing: {academicStanding}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Card key={index} className="shadow-md">
                            <CardHeader><Skeleton className="h-6 w-2/3" /></CardHeader>
                            <CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-5 w-1/2" /></CardContent>
                            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                        </Card>
                    ))}
                </div>
            ) : attendanceSummaries.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {attendanceSummaries.map((summary) => (
                    <Card key={summary.course.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-all border-t-2 border-t-primary/10">
                        <CardHeader>
                            <CardTitle className="font-headline text-lg leading-tight">{summary.course.name}</CardTitle>
                            <CardDescription className="font-bold text-primary/80 font-mono">{summary.course.code}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {summary.percentage >= 0 ? (
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Attendance Rate</span>
                                        <span className="font-black text-xl">{summary.percentage.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={summary.percentage} className="h-2" />
                                </div>
                            ) : (
                                <div className="text-center text-xs text-muted-foreground py-4 bg-muted/20 rounded-md border border-dashed">
                                    No classes marked yet for this session.
                                </div>
                            )}
                             <div className="flex justify-around text-[10px] font-bold uppercase tracking-tighter pt-2 opacity-70">
                                <div className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" />Present: {summary.present}</div>
                                <div className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />Absent: {summary.absent}</div>
                                <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-orange-500" />Late: {summary.late}</div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t">
                            <Button asChild className="w-full shadow-sm" variant="ghost">
                                <Link href={`/student/attendance/${summary.course.id}`}>
                                    View Detailed Log <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed border-2 bg-muted/10">
                    <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
                        <Hand className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <AlertTitle className="font-bold text-lg">No Active Attendance Data</AlertTitle>
                        <AlertDescription className="max-w-xs mx-auto">
                            We couldn't find any attendance records for your current Year/Semester standing. Ensure you have a confirmed registration for this period.
                        </AlertDescription>
                        <Button variant="outline" asChild className="mt-6">
                            <Link href="/student/registration">Go to Registration</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
