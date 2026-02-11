'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, User, Info, Archive } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerName: string;
    semesterId: string;
    semesterName: string;
};

type IntakeCourses = {
    intakeId: string;
    intakeName: string;
    courses: Course[];
};


export default function StudentCoursesPage() {
    const [activeIntakes, setActiveIntakes] = React.useState<IntakeCourses[]>([]);
    const [archivedIntakes, setArchivedIntakes] = React.useState<IntakeCourses[]>([]);
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
            const [registrationsSnap, semestersSnap, coursesSnap, usersSnap, intakesSnap] = await Promise.all([
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'intakes')),
            ]);

            if (!registrationsSnap.exists()) {
                setActiveIntakes([]);
                setArchivedIntakes([]);
                setLoading(false);
                return;
            }
            
            const allSemesters = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const intakesData = intakesSnap.val() || {};
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const intakeCourseMap: Record<string, Course[]> = {};
            const archivedIntakeCourseMap: Record<string, Course[]> = {};
            
            const registrationsData = registrationsSnap.val();
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                if (registration.status === 'Completed' || registration.status === 'Pending Payment') {
                    const semesterInfo = allSemesters[semesterId];
                    const intakeId = semesterInfo?.intakeId || registration.intakeId || 'Unknown';
                    const isArchived = semesterInfo?.status === 'Archived';
                    
                    const targetMap = isArchived ? archivedIntakeCourseMap : intakeCourseMap;

                    if(!targetMap[intakeId]) targetMap[intakeId] = [];
                    
                    for (const courseId of (registration.courses || [])) {
                        const courseInfo = coursesData[courseId];
                        if (courseInfo) {
                            const lecturerNames = (courseInfo.lecturerIds || [])
                                .map((id: string) => userMap.get(id))
                                .filter(Boolean)
                                .join(', ') || userMap.get(courseInfo.lecturerId) || 'N/A';

                            targetMap[intakeId].push({
                                id: courseId,
                                name: courseInfo.name,
                                code: courseInfo.code,
                                lecturerName: lecturerNames,
                                semesterId: semesterId,
                                semesterName: semesterInfo?.name || "Unknown Semester"
                            });
                        }
                    }
                }
            }

            const processMapToList = (map: Record<string, Course[]>) => {
                return Object.entries(map).map(([intakeId, courses]) => ({
                    intakeId,
                    intakeName: intakesData[intakeId]?.name || "Unknown Intake",
                    courses,
                })).sort((a,b) => b.intakeName.localeCompare(a.intakeName));
            };
            
            setActiveIntakes(processMapToList(intakeCourseMap));
            setArchivedIntakes(processMapToList(archivedIntakeCourseMap));

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
                    <CardTitle className="font-headline text-2xl">My Classes</CardTitle>
                    <CardDescription>An overview of your enrolled classes grouped by intake.</CardDescription>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                       <Skeleton key={index} className="h-48 w-full" />
                    ))}
                </div>
            ) : activeIntakes.length > 0 ? (
                 <div className="space-y-4">
                    {activeIntakes.map((intake) => (
                    <Card key={intake.intakeId} className="shadow-lg border-primary/20">
                        <CardHeader>
                            <CardTitle className="text-primary">{intake.intakeName}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {intake.courses.map((course, idx) => (
                                     <Card key={`${course.id}-${idx}`} className="flex flex-col justify-between shadow-md transition-all duration-300 hover:shadow-xl">
                                        <CardHeader>
                                            <CardTitle className="font-headline text-lg leading-tight">{course.name}</CardTitle>
                                            <CardDescription>{course.code}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="flex items-start text-sm text-muted-foreground">
                                                <User className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                                                <span className="line-clamp-2">{course.lecturerName}</span>
                                            </div>
                                        </CardContent>
                                        <CardFooter>
                                        <Button asChild className="w-full">
                                            <Link href={`/student/courses/${course.id}`}>
                                                View Course <ChevronRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
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
                                You are not enrolled in any active classes. Please complete your course registration and payment first.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}

            {archivedIntakes.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="archived-courses" className="border-none">
                        <AccordionTrigger className="hover:no-underline p-0">
                            <div className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
                                <Archive className="h-5 w-5"/>
                                Archived Courses
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4">
                             <div className="space-y-4">
                                {archivedIntakes.map((intake) => (
                                    <div key={intake.intakeId} className="space-y-4">
                                        <h3 className="font-bold text-muted-foreground">{intake.intakeName} (Archived)</h3>
                                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                            {intake.courses.map((course, idx) => (
                                                <Card key={`${course.id}-${idx}`} className="flex flex-col justify-between shadow-sm opacity-70">
                                                    <CardHeader>
                                                        <CardTitle className="font-headline text-base">{course.name}</CardTitle>
                                                        <CardDescription>{course.code}</CardDescription>
                                                    </CardHeader>
                                                    <CardFooter>
                                                    <Button asChild className="w-full" variant="secondary" size="sm">
                                                        <Link href={`/student/courses/${course.id}`}>
                                                            View Archive <ChevronRight className="ml-2 h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    </CardFooter>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
}
