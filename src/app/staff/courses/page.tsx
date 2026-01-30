
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, BookOpen, User, Info, Archive, Users } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Course = {
    id: string;
    name: string;
    code: string;
    studentCount: number;
    semester: string;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

type Semester = {
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
};

type UserData = {
    role: 'Staff';
    subRoles?: string[];
};

export default function StaffCoursesPage() {
    const [activeCourses, setActiveCourses] = React.useState<Course[]>([]);
    const [archivedCourses, setArchivedCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
                setUserData(snapshot.val());
            }
          }
          setLoading(false);
        });
        return () => unsubscribe();
      }, []);

    const fetchLecturerCourses = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [coursesSnap, coursePathsSnap, semestersSnap, regsSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'semesters')),
                get(ref(db, 'registrations'))
            ]);

            if (!coursesSnap.exists() || !coursePathsSnap.exists() || !semestersSnap.exists()) {
                setActiveCourses([]);
                setArchivedCourses([]);
                setLoading(false);
                return;
            }

            const allCourses = coursesSnap.val();
            const allCoursePaths: CoursePath[] = Object.values(coursePathsSnap.val());
            const allSemesters = semestersSnap.val();
            const allRegistrations = regsSnap.val() || {};

            // 1. Get student counts for all courses
            const studentCounts: { [courseId: string]: number } = {};
            for (const userId in allRegistrations) {
                for (const semesterId in allRegistrations[userId]) {
                    const reg = allRegistrations[userId][semesterId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        for (const courseId of reg.courses) {
                            studentCounts[courseId] = (studentCounts[courseId] || 0) + 1;
                        }
                    }
                }
            }

            // 2. Find all courses taught by the current lecturer
            const myCourseIds = new Set<string>();
            for (const courseId in allCourses) {
                const courseData = allCourses[courseId];
                if (courseData.lecturerIds && Array.isArray(courseData.lecturerIds) && courseData.lecturerIds.includes(currentUser.uid)) {
                    myCourseIds.add(courseId);
                }
            }

            // 3. Find which semesters these courses are in, via course paths
            const newActiveCourses: Course[] = [];
            const newArchivedCourses: Course[] = [];
            const processedEntries = new Set<string>(); // To avoid duplicates like "course1-semester1"

            allCoursePaths.forEach(path => {
                if (path.semesters) {
                    Object.entries(path.semesters).forEach(([semesterId, semesterData]) => {
                        const semesterInfo = allSemesters[semesterId];
                        if (!semesterInfo) return; // Skip if semester details not found

                        semesterData.courses.forEach(courseId => {
                            if (myCourseIds.has(courseId)) {
                                const uniqueKey = `${courseId}-${semesterId}`;
                                if (!processedEntries.has(uniqueKey)) {
                                    const courseEntry: Course = {
                                        id: courseId,
                                        name: allCourses[courseId].name,
                                        code: allCourses[courseId].code,
                                        studentCount: studentCounts[courseId] || 0,
                                        semester: semesterInfo.name,
                                    };

                                    if (semesterInfo.status !== 'Archived') {
                                        newActiveCourses.push(courseEntry);
                                    } else {
                                        newArchivedCourses.push(courseEntry);
                                    }
                                    processedEntries.add(uniqueKey);
                                }
                            }
                        });
                    });
                }
            });

            setActiveCourses(newActiveCourses.sort((a,b) => a.name.localeCompare(b.name)));
            setArchivedCourses(newArchivedCourses.sort((a,b) => a.name.localeCompare(b.name)));


        } catch (error) {
            console.error("Error fetching assigned courses:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your assigned courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);

    React.useEffect(() => {
        if (currentUser) {
            fetchLecturerCourses();
        }
    }, [currentUser, fetchLecturerCourses]);
    
    if (loading) {
        return (
            <div className="space-y-6">
                 <Card className="shadow-lg border-0">
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                </Card>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Card key={index} className="shadow-md">
                            <CardHeader><Skeleton className="h-6 w-2/3" /></CardHeader>
                            <CardContent><Skeleton className="h-5 w-1/2" /></CardContent>
                            <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    const lecturerHasCourses = activeCourses.length > 0 || archivedCourses.length > 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">My Assigned Courses</CardTitle>
                    <CardDescription>An overview of the courses you are teaching. Select a course to manage it.</CardDescription>
                </CardHeader>
            </Card>

            {activeCourses.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeCourses.map((course) => (
                    <Card key={`${course.id}-${course.semester}`} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline">{course.name}</CardTitle>
                            <CardDescription>{course.code} &middot; <span className="font-medium">{course.semester}</span></CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Users className="mr-2 h-4 w-4" />
                                <span>{course.studentCount} Enrolled Student(s)</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                        <Button asChild className="w-full">
                            <Link href={`/staff/courses/${course.id}`}>
                                Manage Course <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        </CardFooter>
                    </Card>
                    ))}
                </div>
            ) : (
                 !lecturerHasCourses &&
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Active Courses Found</AlertTitle>
                            <AlertDescription>
                                You are not currently assigned to any active courses.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}

            {archivedCourses.length > 0 && (
                 <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="archived-courses">
                        <AccordionTrigger>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <Archive className="h-5 w-5"/>
                                Archived Courses
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-4">
                                {archivedCourses.map((course) => (
                                <Card key={`${course.id}-${course.semester}`} className="flex flex-col justify-between shadow-lg opacity-70">
                                    <CardHeader>
                                        <CardTitle className="font-headline">{course.name}</CardTitle>
                                        <CardDescription>{course.code} &middot; <span className="font-medium">{course.semester}</span></CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <User className="mr-2 h-4 w-4" />
                                            <span>{course.studentCount} Student(s)</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                    <Button asChild className="w-full" variant="secondary">
                                        <Link href={`/staff/courses/${course.id}`}>
                                            View Course <ChevronRight className="ml-2 h-4 w-4" />
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
