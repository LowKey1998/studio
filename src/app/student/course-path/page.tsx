
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Route, Info, BookCopy, Download } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

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

type Semester = {
    id: string;
    name: string;
    year: number;
    semesterInYear: number;
};

type UserData = {
    programmeId: string;
    intakeId: string;
    programmeName: string;
};

export default function MyCoursePathPage() {
    const [path, setPath] = React.useState<CoursePath | null>(null);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allSemesters, setAllSemesters] = React.useState<Record<string, Semester>>({});
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
                const [userSnap, coursesSnap, coursePathsSnap, programmesSnap, semestersSnap] = await Promise.all([
                    get(ref(db, `users/${currentUser.uid}`)),
                    get(ref(db, 'courses')),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'semesters')),
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
                setAllSemesters(semestersSnap.val() || {});

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
        return Object.entries(path.semesters).map(([semId, semData]) => {
            const semesterInfo = allSemesters[semId];
            return {
                id: semId,
                year: semesterInfo?.year || 0,
                semesterInYear: semesterInfo?.semesterInYear || 0,
                courses: semData.courses,
            };
        }).sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear);
    }, [path, allSemesters]);

    const handleDownload = () => {
        if (!userData || !path) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Course Path for ${userData.programmeName}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
        let y = 40;
        semestersInOrder.forEach(semester => {
            const label = `Year ${semester.year}, Semester ${semester.semesterInYear}`;
            (doc as any).autoTable({
                head: [[label]],
                body: semester.courses.map(courseId => [allCourses[courseId]?.code, allCourses[courseId]?.name]),
                startY: y,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        });
        doc.save(`${userData.programmeName.replace(/\s+/g, '_')}_Course_Path.pdf`);
    };

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
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <CardTitle className="font-headline text-2xl">My Course Path</CardTitle>
                        <CardDescription>A complete roadmap of your curriculum for the {userData?.programmeName || 'programme'}.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleDownload}><Download className="h-4 w-4 mr-2"/> Download PDF</Button>
                </CardHeader>
            </Card>
             <Accordion type="multiple" defaultValue={semestersInOrder.map(s => s.id)} className="w-full space-y-4">
                {semestersInOrder.map(semester => {
                    const label = `Year ${semester.year}, Semester ${semester.semesterInYear}`;
                    return (
                        <AccordionItem value={semester.id} key={semester.id} className="border rounded-lg overflow-hidden">
                            <AccordionTrigger className="p-4 hover:no-underline bg-muted/50 font-bold text-lg">{label}</AccordionTrigger>
                            <AccordionContent className="p-4">
                                 <div className="border rounded-md">
                                    {semester.courses.map((courseId, index) => {
                                        const course = allCourses[courseId];
                                        if(!course) return null;
                                        return (
                                            <div key={courseId} className={`flex justify-between items-center p-3 ${index < semester.courses.length - 1 ? 'border-b' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <BookCopy className="h-4 w-4 text-muted-foreground"/>
                                                    <span>{course.name}</span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">{course.code}</span>
                                            </div>
                                        )
                                    })}
                                 </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </div>
    );
}
