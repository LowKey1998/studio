'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, BookOpen, User, Info, Archive, Hand } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerName: string;
};

type SemesterCourses = {
    semesterId: string;
    semesterName: string;
    courses: Course[];
    attendancePercentage: number;
};

type UserData = {
    role: 'Student' | 'Staff';
};

export default function StudentSemesterOverviewPage() {
    const [activeSemesters, setActiveSemesters] = React.useState<SemesterCourses[]>([]);
    const [archivedSemesters, setArchivedSemesters] = React.useState<SemesterCourses[]>([]);
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

    const fetchEnrolledCourses = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [registrationsSnap, semestersSnap, coursesSnap, usersSnap, attendanceSnap] = await Promise.all([
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'attendance'))
            ]);

            if (!registrationsSnap.exists()) {
                setActiveSemesters([]);
                setArchivedSemesters([]);
                setLoading(false);
                return;
            }
            
            const allSemesters = semestersSnap.exists() ? semestersSnap.val() : {};
            const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
            const usersData = usersSnap.exists() ? usersSnap.val() : {};
            const allAttendance = attendanceSnap.exists() ? attendanceSnap.val() : {};
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const semesterCourseMap: Record<string, Course[]> = {};
            const registrationsData = registrationsSnap.val();
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                if (registration.status === 'Completed') {
                    if(!semesterCourseMap[semesterId]) semesterCourseMap[semesterId] = [];
                    for (const courseId of registration.courses) {
                        const courseInfo = coursesData[courseId];
                        if (courseInfo) {
                            semesterCourseMap[semesterId].push({
                                id: courseId,
                                name: courseInfo.name,
                                code: courseInfo.code,
                                lecturerName: userMap.get(courseInfo.lecturerId) || 'N/A',
                            });
                        }
                    }
                }
            }

            const newActiveSemesters: SemesterCourses[] = [];
            const newArchivedSemesters: SemesterCourses[] = [];

            for (const semesterId in semesterCourseMap) {
                const semesterInfo = allSemesters[semesterId];
                const courses = semesterCourseMap[semesterId];

                // Calculate attendance
                let totalPresent = 0;
                let totalMarked = 0;
                courses.forEach(course => {
                    const courseAttendance = allAttendance[course.id];
                    if (courseAttendance) {
                        Object.values(courseAttendance).forEach((dailyRecord: any) => {
                             const status = dailyRecord[currentUser.uid];
                             if(status) {
                                 totalMarked++;
                                 if (status === 'Present' || status === 'Late' || status === 'Excused Absence') {
                                     totalPresent++;
                                 }
                             }
                        });
                    }
                });
                const attendancePercentage = totalMarked > 0 ? (totalPresent / totalMarked) * 100 : 100;

                const semesterData = {
                    semesterId: semesterId,
                    semesterName: semesterInfo?.name || "Unknown Semester",
                    courses,
                    attendancePercentage
                };

                if(semesterInfo && semesterInfo.status !== 'Archived') {
                    newActiveSemesters.push(semesterData);
                } else {
                    newArchivedSemesters.push(semesterData);
                }
            }
            
            setActiveSemesters(newActiveSemesters.sort((a,b) => b.semesterName.localeCompare(a.semesterName)));
            setArchivedSemesters(newArchivedSemesters.sort((a,b) => b.semesterName.localeCompare(a.semesterName)));

        } catch (error) {
            console.error("Error fetching enrolled courses:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your enrolled courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);


    React.useEffect(() => {
        if (currentUser) {
            fetchEnrolledCourses();
        }
    }, [currentUser, fetchEnrolledCourses]);
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">My Semester Overview</CardTitle>
                    <CardDescription>An overview of your currently enrolled classes.</CardDescription>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Card key={index} className="shadow-md">
                            <CardHeader>
                                <Skeleton className="h-6 w-2/3" />
                                <Skeleton className="h-4 w-1/3" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-5 w-1/2" />
                            </CardContent>
                            <CardFooter>
                                <Skeleton className="h-10 w-full" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : activeSemesters.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeSemesters.map((semester) => (
                    <Card key={semester.semesterId} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline">{semester.semesterName}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center text-sm text-muted-foreground">
                                <BookOpen className="mr-2 h-4 w-4" />
                                <span>{semester.courses.length} Course(s)</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex items-center text-muted-foreground"><Hand className="mr-2 h-4 w-4" /> <span>Overall Attendance</span></div>
                                    <span className="font-bold">{semester.attendancePercentage.toFixed(0)}%</span>
                                </div>
                                <Progress value={semester.attendancePercentage} />
                            </div>
                        </CardContent>
                        <CardFooter>
                        <Button asChild className="w-full">
                            <Link href={`/student/semester/${semester.semesterId}`}>
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
                            <AlertTitle>No Classes Found</AlertTitle>
                            <AlertDescription>
                                You are not enrolled in any classes. Please complete your course registration and payment first.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}

            {archivedSemesters.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="archived-courses">
                        <AccordionTrigger>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <Archive className="h-5 w-5"/>
                                Archived Semesters
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-4">
                                {archivedSemesters.map((semester) => (
                                <Card key={semester.semesterId} className="flex flex-col justify-between shadow-lg opacity-70">
                                    <CardHeader>
                                        <CardTitle className="font-headline">{semester.semesterName}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            <span>{semester.courses.length} Course(s)</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                    <Button asChild className="w-full" variant="secondary">
                                        <Link href={`/student/semester/${semester.semesterId}`}>
                                            View Details <ChevronRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                    </CardFooter>
                                </Card>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
}
