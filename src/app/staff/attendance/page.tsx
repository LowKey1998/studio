
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, FolderKanban, Info, Hand } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, query, equalTo, orderByChild } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Course = {
    id: string;
    name: string;
    code: string;
    studentCount: number;
    lecturerId?: string;
};

type UserData = {
    name: string;
    role: 'Student' | 'Staff';
    subRoles?: string[];
}

export default function AttendancePage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
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
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
      }, []);

    const fetchLecturerCourses = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const allCoursesRef = ref(db, 'courses');
            const coursesSnapshot = await get(allCoursesRef);

            if (coursesSnapshot.exists()) {
                const coursesData = coursesSnapshot.val();
                
                // Get all registrations to count students
                const registrationsRef = ref(db, 'registrations');
                const regsSnapshot = await get(registrationsRef);
                const studentCounts: {[courseId: string]: number} = {};

                if (regsSnapshot.exists()) {
                    const allRegistrations = regsSnapshot.val();
                    for(const userId in allRegistrations) {
                        for (const semester in allRegistrations[userId]) {
                            const reg = allRegistrations[userId][semester];
                            if (reg.status === 'Completed') {
                                for(const courseId of reg.courses) {
                                    studentCounts[courseId] = (studentCounts[courseId] || 0) + 1;
                                }
                            }
                        }
                    }
                }
                
                const assignedCourses: Course[] = [];
                for(const courseId in coursesData) {
                    if (coursesData[courseId].lecturerId === currentUser.uid) {
                        assignedCourses.push({
                            id: courseId,
                            name: coursesData[courseId].name,
                            code: coursesData[courseId].code,
                            studentCount: studentCounts[courseId] || 0,
                        });
                    }
                }

                setCourses(assignedCourses.filter(c => c.name));
            } else {
                setCourses([]);
            }
        } catch (error) {
            console.error("Error fetching assigned courses:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your assigned courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);


    React.useEffect(() => {
        if (currentUser && userData?.role === 'Staff' && userData.subRoles?.includes('Lecturer')) {
            fetchLecturerCourses();
        } else if (userData) {
            // Non-lecturers don't see anything here, or redirect
            setLoading(false);
        }
    }, [currentUser, userData, fetchLecturerCourses]);
    
    if (loading) {
        return (
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
        )
    }

    if (!(userData?.role === 'Staff' && userData?.subRoles?.includes('Lecturer'))) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>
                            This page is only available to lecturers. Please navigate using the sidebar.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }


    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">My Courses</CardTitle>
                    <CardDescription>Select a course to mark attendance.</CardDescription>
                </CardHeader>
            </Card>

            {courses.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course) => (
                    <Card key={course.id} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl">
                        <CardHeader>
                            <CardTitle className="font-headline">{course.name}</CardTitle>
                            <CardDescription>{course.code}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-sm text-muted-foreground">
                                <FolderKanban className="mr-2 h-4 w-4" />
                                <span>{course.studentCount} Student(s)</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                        <Button asChild className="w-full">
                            <Link href={`/staff/attendance/${course.id}`}>
                                Mark Attendance <ChevronRight className="ml-2 h-4 w-4" />
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
                            <AlertTitle>No Courses Found</AlertTitle>
                            <AlertDescription>
                                You are not assigned to any active courses.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
