
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
    semesters: Record<number, { courses: string[] }>;
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

                setAllCourses(coursesSnap.val());

            } catch (error) {
                console.error("Error fetching course path:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    const getYearFromSemester = (semNum: number) => Math.floor((semNum - 1) / 2) + 1;
    const getSemesterInYear = (semNum: number) => (semNum - 1) % 2 + 1;

    const groupedByYear = React.useMemo(() => {
        if (!path || !path.semesters) return {};

        const grouped: Record<string, { semester: number, courses: Course[] }[]> = {};

        Object.entries(path.semesters).forEach(([semNumStr, semData]) => {
            const semNum = Number(semNumStr);
            const year = getYearFromSemester(semNum);
            const yearKey = `Year ${year}`;

            if (!grouped[yearKey]) {
                grouped[yearKey] = [];
            }

            grouped[yearKey].push({
                semester: getSemesterInYear(semNum),
                courses: semData.courses.map(courseId => allCourses[courseId]).filter(Boolean),
            });
        });

        return grouped;
    }, [path, allCourses]);

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
            <Accordion type="multiple" defaultValue={Object.keys(groupedByYear)} className="w-full space-y-4">
                {Object.entries(groupedByYear).map(([year, semesters]) => (
                    <AccordionItem value={year} key={year} className="border rounded-lg bg-card">
                        <AccordionTrigger className="text-xl font-bold px-6 py-4 hover:no-underline">
                           {year}
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 space-y-4">
                            {semesters.map(({ semester, courses }) => (
                                <div key={semester}>
                                    <h4 className="font-semibold text-lg mb-2">Semester {semester}</h4>
                                    <div className="border rounded-md">
                                        {courses.map(course => (
                                            <div key={course.id} className="flex justify-between p-3 border-b last:border-b-0">
                                                <span>{course.name}</span>
                                                <span className="text-muted-foreground">{course.code}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}

