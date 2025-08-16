
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Route, Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

type UserData = {
    programmeId: string;
    intakeId: string;
    programmeName: string;
};

export default function MyCoursePathPage() {
    const [path, setPath] = React.useState<CoursePath | null>(null);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

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

    React.useEffect(() => {
        if (!currentUser) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const [userSnap, coursesSnap, coursePathsSnap, programmesSnap] = await Promise.all([
                    get(ref(db, `users/${currentUser.uid}`)),
                    get(ref(db, 'courses')),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'programmes')),
                ]);

                if (!userSnap.exists() || !coursesSnap.exists() || !coursePathsSnap.exists() || !programmesSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const uData = userSnap.val();
                const uDataWithProgName = {
                    ...uData,
                    programmeName: programmesSnap.val()[uData.programmeId]?.name || 'Your Programme'
                };
                setUserData(uDataWithProgName);
                
                const allCoursePaths: CoursePath[] = Object.values(coursePathsSnap.val());
                const userPath = allCoursePaths.find(p => p.intakeId === uData.intakeId && p.programmeId === uData.programmeId);
                setPath(userPath || null);

                setAllCourses(coursesSnap.val() || {});

            } catch (error) {
                console.error("Error fetching course path:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    const semestersInOrder = React.useMemo(() => {
        if (!path || !path.semesters) return [];
        return Object.entries(path.semesters).sort(([semNumA], [semNumB]) => Number(semNumA) - Number(semNumB));
    }, [path]);


    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }
    
    if (!path) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>My Course Path</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <Route className="h-4 w-4" />
                        <AlertTitle>Course Path Not Available</AlertTitle>
                        <AlertDescription>
                            A course path has not yet been defined for your programme and intake. Please check back later.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">My Course Path</CardTitle>
                    <CardDescription>A complete roadmap of your curriculum for the {userData?.programmeName || 'programme'}.</CardDescription>
                </CardHeader>
            </Card>
            <div className="space-y-4">
                {semestersInOrder.map(([semNum, semData]) => (
                    <Card key={semNum}>
                        <CardHeader>
                            <CardTitle>Semester {semNum}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="border rounded-md">
                                {semData.courses.map((courseId, index) => {
                                    const course = allCourses[courseId];
                                    if(!course) return null;
                                    return (
                                        <div key={courseId} className={`flex justify-between p-3 ${index < semData.courses.length - 1 ? 'border-b' : ''}`}>
                                            <span>{course.name}</span>
                                            <span className="text-muted-foreground">{course.code}</span>
                                        </div>
                                    )
                                })}
                             </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
