
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Hand } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Course = {
    id: string;
    name: string;
    code: string;
    semester: string;
};

export default function StaffAttendancePage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchLecturerCourses = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [coursesSnap, regsSnapshot, semestersSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'registrations')),
                get(ref(db, 'semesters'))
            ]);

            const coursesData = coursesSnap.val() || {};
            const allRegistrations = regsSnapshot.exists() ? regsSnapshot.val() : {};
            const allSemesters = semestersSnap.exists() ? semestersSnap.val() : {};
            const lecturerCourses = new Map<string, Course>();

            for (const userId in allRegistrations) {
                for (const semesterId in allRegistrations[userId]) {
                    const registration = allRegistrations[userId][semesterId];
                    const semesterInfo = allSemesters[semesterId];

                    if (semesterInfo?.status !== 'Archived' && registration.courses) {
                        for (const courseId of registration.courses) {
                            const courseData = coursesData[courseId];
                            if (courseData) {
                                const lecturerIds = courseData.lecturerIds || [];
                                const isAssigned = (Array.isArray(lecturerIds) && lecturerIds.includes(currentUser.uid)) || (courseData.lecturerId === currentUser.uid);
                                
                                if (isAssigned && !lecturerCourses.has(courseId)) {
                                    lecturerCourses.set(courseId, {
                                        id: courseId,
                                        name: courseData.name,
                                        code: courseData.code,
                                        semester: semesterInfo.name || 'Active Semester',
                                    });
                                }
                            }
                        }
                    }
                }
            }
            setCourses(Array.from(lecturerCourses.values()));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your assigned courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);
    
    React.useEffect(() => {
        if(currentUser) fetchLecturerCourses();
    }, [currentUser, fetchLecturerCourses]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Mark Attendance</CardTitle>
                    <CardDescription>Select a course to mark attendance for a class session.</CardDescription>
                </CardHeader>
            </Card>
            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
                </div>
            ) : courses.length > 0 ? (
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map(course => (
                        <Card key={course.id}>
                            <CardHeader>
                                <CardTitle>{course.name}</CardTitle>
                                <CardDescription>{course.code} &middot; {course.semester}</CardDescription>
                            </CardHeader>
                            <CardFooter>
                                <Button asChild className="w-full">
                                    <Link href={`/staff/courses/${course.id}/attendance`}>
                                        <Hand className="mr-2 h-4 w-4" /> Mark Attendance
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Courses Found</AlertTitle>
                    <AlertDescription>You are not currently assigned to any active courses.</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
