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
    semesterId: string;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

export default function StaffCoursesPage() {
    const [activeCourses, setActiveCourses] = React.useState<Course[]>([]);
    const [archivedCourses, setArchivedCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
      }, []);

    const fetchLecturerCourses = React.useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [coursesSnap, coursePathsSnap, semestersSnap, regsSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'semesters')),
                get(ref(db, 'registrations'))
            ]);

            const allCourses = coursesSnap.val() || {};
            const allCoursePaths: CoursePath[] = Object.values(coursePathsSnap.val() || {});
            const allSemesters = semestersSnap.val() || {};
            const allRegistrations = regsSnap.val() || {};

            const studentCounts: { [semesterId: string]: { [courseId: string]: number } } = {};
            for (const userId in allRegistrations) {
                for (const semesterId in allRegistrations[userId]) {
                    const reg = allRegistrations[userId][semesterId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (reg.courses) {
                            if (!studentCounts[semesterId]) studentCounts[semesterId] = {};
                            for (const courseId of reg.courses) {
                                studentCounts[semesterId][courseId] = (studentCounts[semesterId][courseId] || 0) + 1;
                            }
                        }
                    }
                }
            }

            const newActiveCourses: Course[] = [];
            const newArchivedCourses: Course[] = [];
            const processedEntries = new Set<string>();

            allCoursePaths.forEach(path => {
                if (path.semesters) {
                    Object.entries(path.semesters).forEach(([semesterId, semesterData]) => {
                        const semesterInfo = allSemesters[semesterId];
                        if (!semesterInfo) return;

                        (semesterData.courses || []).forEach(courseId => {
                            const courseData = allCourses[courseId];
                            if (!courseData) return;

                            const lecturerIds = courseData.lecturerIds || [];
                            const isAssigned = (Array.isArray(lecturerIds) && lecturerIds.includes(currentUser.uid)) || (courseData.lecturerId === currentUser.uid);

                            if (isAssigned) {
                                const uniqueKey = `${courseId}-${semesterId}`;
                                if (!processedEntries.has(uniqueKey)) {
                                    const entry: Course = {
                                        id: courseId,
                                        name: courseData.name,
                                        code: courseData.code,
                                        studentCount: studentCounts[semesterId]?.[courseId] || 0,
                                        semester: semesterInfo.name,
                                        semesterId: semesterId
                                    };
                                    if (semesterInfo.status !== 'Archived') newActiveCourses.push(entry);
                                    else newArchivedCourses.push(entry);
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
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);

    React.useEffect(() => {
        if (currentUser) fetchLecturerCourses();
    }, [currentUser, fetchLecturerCourses]);
    
    if (loading) return <div className="space-y-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader><CardTitle className="font-headline text-2xl">My Courses</CardTitle><CardDescription>Select a course to manage assignments, attendance, and grades.</CardDescription></CardHeader>
            </Card>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeCourses.map((course) => (
                    <Card key={`${course.id}-${course.semesterId}`} className="flex flex-col justify-between shadow-lg">
                        <CardHeader><CardTitle className="text-lg">{course.name}</CardTitle><CardDescription>{course.code} &middot; {course.semester}</CardDescription></CardHeader>
                        <CardContent><div className="flex items-center text-sm text-muted-foreground"><Users className="mr-2 h-4 w-4" />{course.studentCount} Students</div></CardContent>
                        <CardFooter><Button asChild className="w-full"><Link href={`/staff/courses/${course.id}`}>Manage <ChevronRight className="ml-2 h-4 w-4" /></Link></Button></CardFooter>
                    </Card>
                ))}
            </div>
            {activeCourses.length === 0 && <Alert><Info className="h-4 w-4"/><AlertTitle>No Courses</AlertTitle><AlertDescription>You are not assigned to any active courses.</AlertDescription></Alert>}
        </div>
    );
}
