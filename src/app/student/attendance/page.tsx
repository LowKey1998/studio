
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Hand, CheckCircle, XCircle, Clock } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

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
            const registrationsSnapshot = await get(ref(db, `registrations/${currentUser.uid}`));
            if (!registrationsSnapshot.exists()) {
                setAttendanceSummaries([]);
                setLoading(false);
                return;
            }
            
            const allCourseIds = new Set<string>();
            Object.values(registrationsSnapshot.val()).forEach((reg: any) => {
                if (reg.status === 'Completed') {
                     reg.courses.forEach((id: string) => allCourseIds.add(id));
                }
            });
            
            if (allCourseIds.size === 0) {
                 setAttendanceSummaries([]);
                 setLoading(false);
                 return;
            }

            const [coursesSnapshot, attendanceSnapshot] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'attendance'))
            ]);

            const summaries: AttendanceSummary[] = [];
            const allCourses = coursesSnapshot.val() || {};
            const allAttendance = attendanceSnapshot.val() || {};
            
            for (const courseId of Array.from(allCourseIds)) {
                const courseAttendance = allAttendance[courseId];
                let present = 0, absent = 0, late = 0;
                let totalLectures = 0;
                
                if (courseAttendance) {
                    totalLectures = Object.keys(courseAttendance).length;
                    Object.values(courseAttendance).forEach((dailyRecord: any) => {
                        const status = dailyRecord[currentUser.uid];
                        if (status === 'Present') present++;
                        else if (status === 'Absent') absent++;
                        else if (status === 'Late') late++;
                    });
                }
                const totalMarked = present + absent + late;
                const percentage = totalMarked > 0 ? ((present + late) / totalMarked) * 100 : -1; // Use -1 to indicate no records for this student
                
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
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">My Attendance</CardTitle>
                    <CardDescription>An overview of your attendance record for each course.</CardDescription>
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
                    <Card key={summary.course.id} className="flex flex-col justify-between shadow-lg">
                        <CardHeader>
                            <CardTitle className="font-headline">{summary.course.name}</CardTitle>
                            <CardDescription>{summary.course.code}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {summary.percentage >= 0 ? (
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-sm font-medium text-muted-foreground">Attendance Rate</span>
                                        <span className="font-bold text-lg">{summary.percentage.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={summary.percentage} />
                                </div>
                            ) : (
                                <div className="text-center text-sm text-muted-foreground py-2">
                                    No attendance marked as yet.
                                </div>
                            )}
                             <div className="flex justify-around text-xs text-muted-foreground pt-2">
                                <div className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" />Present: {summary.present}</div>
                                <div className="flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />Absent: {summary.absent}</div>
                                <div className="flex items-center gap-1"><Clock className="h-3 w-3 text-orange-500" />Late: {summary.late}</div>
                            </div>
                        </CardContent>
                        <CardFooter>
                        <Button asChild className="w-full">
                            <Link href={`/student/attendance/${summary.course.id}`}>
                                View Details <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        </CardFooter>
                    </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Attendance Records</AlertTitle>
                            <AlertDescription>
                                No attendance has been marked for your courses yet, or you are not fully enrolled in any courses.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
