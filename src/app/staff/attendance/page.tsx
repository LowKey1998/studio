'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, Hand } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type CourseInstance = {
    uniqueId: string;
    id: string;
    name: string;
    code: string;
    semester: string;
};

export default function StaffAttendancePage() {
    const [courses, setCourses] = React.useState<CourseInstance[]>([]);
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
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [coursesSnap, semestersSnap, coursePathsSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'semesters')),
                get(ref(db, 'coursePaths'))
            ]);

            const allCourses = coursesSnap.val() || {};
            const allSemesters = semestersSnap.val() || {};
            const allCoursePaths = Object.values(coursePathsSnap.val() || {});
            const lecturerCourses = new Map<string, CourseInstance>();

            allCoursePaths.forEach((path: any) => {
                if (path.semesters) {
                    Object.entries(path.semesters).forEach(([semId, semData]: [string, any]) => {
                        const semInfo = allSemesters[semId];
                        if (semInfo?.status === 'Archived') return;

                        (semData.courses || []).forEach((cid: string) => {
                            const cData = allCourses[cid];
                            if (!cData) return;
                            const lIds = cData.lecturerIds || [];
                            const isAssigned = (Array.isArray(lIds) && lIds.includes(currentUser.uid)) || (cData.lecturerId === currentUser.uid);
                            
                            if (isAssigned) {
                                // Create a unique key for the instance
                                const uniqueId = `${cid}-${semId}`;
                                lecturerCourses.set(uniqueId, { 
                                    uniqueId,
                                    id: cid, 
                                    name: cData.name, 
                                    code: cData.code, 
                                    semester: semInfo.name 
                                });
                            }
                        });
                    });
                }
            });
            setCourses(Array.from(lecturerCourses.values()));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);
    
    React.useEffect(() => {
        if(currentUser) fetchLecturerCourses();
    }, [currentUser, fetchLecturerCourses]);

    return (
        <div className="space-y-6">
            <Card><CardHeader><CardTitle className="font-headline text-2xl">Mark Attendance</CardTitle><CardDescription>Select a course to record attendance.</CardDescription></CardHeader></Card>
            {loading ? <Skeleton className="h-48 w-full" /> : 
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {courses.map(course => (
                    <Card key={course.uniqueId}>
                        <CardHeader><CardTitle>{course.name}</CardTitle><CardDescription>{course.code} &middot; {course.semester}</CardDescription></CardHeader>
                        <CardFooter><Button asChild className="w-full"><Link href={`/staff/courses/${course.id}/attendance`}><Hand className="mr-2 h-4 w-4" /> Mark Attendance</Link></Button></CardFooter>
                    </Card>
                ))}
            </div>}
            {courses.length === 0 && !loading && <Alert><Info className="h-4 w-4" /><AlertTitle>No Courses</AlertTitle><AlertDescription>No active courses assigned.</AlertDescription></Alert>}
        </div>
    );
}
