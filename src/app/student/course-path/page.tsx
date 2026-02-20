'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Route, Info, BookCopy, Download, CalendarDays } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    intakeId: string;
};

type UserData = {
    programmeId: string;
    intakeId: string;
    programmeName: string;
    intakeName: string;
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
                const [userSnap, coursesSnap, coursePathsSnap, programmesSnap, semestersSnap, intakesSnap] = await Promise.all([
                    get(ref(db, `users/${currentUser.uid}`)),
                    get(ref(db, 'courses')),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'intakes')),
                ]);

                if (!userSnap.exists() || !coursesSnap.exists() || !coursePathsSnap.exists() || !programmesSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const uData = userSnap.val();
                const allIntakes = intakesSnap.val() || {};
                
                const uDataWithMeta = {
                    ...uData,
                    programmeName: programmesSnap.val()[uData.programmeId]?.name || 'Your Programme',
                    intakeName: allIntakes[uData.intakeId]?.name || 'Your Intake'
                };
                setUserData(uDataWithMeta);
                
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
        if (!path || !path.semesters || !userData) return [];
        
        return Object.entries(path.semesters).map(([semId, semData]) => {
            const semesterInfo = allSemesters[semId];
            
            // STRICT FILTER: Only include if the semester record explicitly matches the student's intake
            if (!semesterInfo || semesterInfo.intakeId !== userData.intakeId) {
                return null;
            }

            return {
                id: semId,
                name: semesterInfo.name,
                year: semesterInfo.year || 0,
                semesterInYear: semesterInfo.semesterInYear || 0,
                courses: semData.courses,
            };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear);
    }, [path, allSemesters, userData]);

    const handleDownload = () => {
        if (!userData || !path) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(`Course Path Roadmap`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Student: ${currentUser?.displayName || 'N/A'}`, 14, 30);
        doc.text(`Programme: ${userData.programmeName}`, 14, 35);
        doc.text(`Intake: ${userData.intakeName}`, 14, 40);
        doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 45);
        
        let y = 55;
        semestersInOrder.forEach(semester => {
            (doc as any).autoTable({
                head: [[semester.name]],
                body: semester.courses.map(courseId => [allCourses[courseId]?.code || 'N/A', allCourses[courseId]?.name || 'Unknown Course']),
                startY: y,
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] },
                margin: { top: 10 }
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        });
        doc.save(`CoursePath_${userData.intakeName.replace(/\s+/g, '_')}.pdf`);
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
    
    if (!path || semestersInOrder.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>My Course Path</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert className="bg-muted/50 border-dashed border-2">
                        <Route className="h-4 w-4" />
                        <AlertTitle>Roadmap Not Found</AlertTitle>
                        <AlertDescription>
                            A validated course path has not been finalized for the <strong>{userData?.intakeName}</strong> intake yet. Please consult your academic advisor.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
             <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="space-y-1">
                        <CardTitle className="font-headline text-2xl">Academic Roadmap</CardTitle>
                        <CardDescription>Your multi-year curriculum path for <strong>{userData?.programmeName}</strong>.</CardDescription>
                        <div className="flex items-center gap-2 pt-2">
                            <Badge variant="secondary" className="gap-1.5 font-bold border-primary/20 bg-primary/5 text-primary">
                                <CalendarDays className="h-3 w-3" />
                                Intake: {userData?.intakeName}
                            </Badge>
                        </div>
                    </div>
                    <Button variant="outline" onClick={handleDownload} className="shadow-sm">
                        <Download className="mr-2 h-4 w-4"/> 
                        Download PDF Roadmap
                    </Button>
                </CardHeader>
            </Card>

             <Accordion type="multiple" defaultValue={semestersInOrder.map(s => s.id)} className="w-full space-y-4">
                {semestersInOrder.map(semester => (
                    <AccordionItem value={semester.id} key={semester.id} className="border rounded-xl overflow-hidden bg-card shadow-sm">
                        <AccordionTrigger className="p-4 px-6 hover:no-underline hover:bg-muted/30 font-bold text-lg">
                            <div className="flex flex-col items-start text-left gap-1">
                                <span>{semester.name}</span>
                                <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-60">Year {semester.year}, Semester {semester.semesterInYear}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-6 pt-2">
                             <div className="border rounded-lg overflow-hidden bg-muted/10">
                                {semester.courses.map((courseId, index) => {
                                    const course = allCourses[courseId];
                                    if(!course) return null;
                                    return (
                                        <div key={courseId} className={cn(
                                            "flex justify-between items-center p-4 transition-colors hover:bg-background",
                                            index < semester.courses.length - 1 ? 'border-b' : ''
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <BookCopy className="h-4 w-4 text-primary opacity-70"/>
                                                </div>
                                                <span className="font-medium text-sm">{course.name}</span>
                                            </div>
                                            <Badge variant="outline" className="font-mono text-[10px] font-bold opacity-70">{course.code}</Badge>
                                        </div>
                                    )
                                })}
                             </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>

            <Alert className="bg-muted/50 border-0">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-[10px] font-black uppercase tracking-widest">About this path</AlertTitle>
                <AlertDescription className="text-xs italic leading-relaxed">
                    This roadmap displays the standard course progression for your cohort. Specific semester availability is subject to administrative activation during registration windows.
                </AlertDescription>
            </Alert>
        </div>
    );
}
