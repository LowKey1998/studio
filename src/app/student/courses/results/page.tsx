
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ClipboardCheck, Info, BookOpen, GraduationCap, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type CourseResult = {
    courseId: string;
    courseCode: string;
    courseName: string;
    caMark: number | null;
    examScore: number | null;
    finalMark: number | null;
    grade: string;
    isPublished: boolean;
};

type SemesterResults = {
    semesterId: string;
    semesterName: string;
    year: number;
    semesterInYear: number;
    results: CourseResult[];
};

export default function MyResultsPage() {
    const [semesterGroups, setSemesterGroups] = React.useState<SemesterResults[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [regsSnap, semestersSnap, coursesSnap, assessmentsSnap, publishedSnap, programmesSnap, templatesSnap] = await Promise.all([
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'assessments')),
                get(ref(db, 'resultsPublished')),
                get(ref(db, 'programmes')),
                get(ref(db, 'settings/assessmentTemplates'))
            ]);

            if (!regsSnap.exists()) {
                setSemesterGroups([]);
                setLoading(false);
                return;
            }

            const regs = regsSnap.val();
            const allSemesters = semestersSnap.val() || {};
            const allCourses = coursesSnap.val() || {};
            const allAssessments = assessmentsSnap.val() || {};
            const allPublished = publishedSnap.val() || {};
            const allProgrammes = programmesSnap.val() || {};
            const allTemplates = templatesSnap.val() || {};

            const userProfileSnap = await get(ref(db, `users/${currentUser.uid}`));
            const userProfile = userProfileSnap.val();
            const programmeId = userProfile?.programmeId;
            const gradingScale = programmeId ? Object.values(allProgrammes[programmeId]?.gradingScale || {}) : [];

            const groups: SemesterResults[] = [];

            for (const semId in regs) {
                const reg = regs[semId];
                const semInfo = allSemesters[semId];
                if (!semInfo) continue;

                // Include results even if status isn't 'Completed' yet if results exist
                // But normally we only show for completed/pending payment
                if (reg.status !== 'Completed' && reg.status !== 'Pending Payment') continue;

                const courseResults: CourseResult[] = [];
                const courseIds = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses || {});

                for (const cid of courseIds) {
                    const course = allCourses[cid];
                    if (!course) continue;

                    const scores = allAssessments[semId]?.[cid]?.[currentUser.uid] || {};
                    const isPublished = !!allPublished[semId]?.[cid];
                    
                    const template = course.assessmentTemplateId ? allTemplates[course.assessmentTemplateId] : null;
                    let caMark: number | null = null;
                    
                    if (template && template.components) {
                        let totalWeighted = 0;
                        let totalWeight = 0;
                        Object.entries(template.components).forEach(([compId, comp]: [string, any]) => {
                            const scoreData = scores[compId];
                            if (scoreData?.score !== undefined) {
                                totalWeighted += scoreData.score * (comp.weight / 100);
                                totalWeight += comp.weight;
                            }
                        });
                        if (totalWeight > 0) {
                            caMark = (totalWeighted / totalWeight) * 100;
                        }
                    }

                    const examScore = scores.finalExam?.score ?? null;
                    let finalMark: number | null = null;
                    let grade = 'N/A';

                    if (caMark !== null && examScore !== null) {
                        finalMark = (caMark * 0.4) + (examScore * 0.6);
                        const match = (gradingScale as any[]).find(g => finalMark! >= g.minScore && finalMark! <= g.maxScore);
                        grade = match ? match.grade : 'F';
                    }

                    courseResults.push({
                        courseId: cid,
                        courseCode: course.code,
                        courseName: course.name,
                        caMark,
                        examScore,
                        finalMark,
                        grade,
                        isPublished
                    });
                }

                if(courseResults.length > 0) {
                    groups.push({
                        semesterId: semId,
                        semesterName: semInfo.name,
                        year: semInfo.year,
                        semesterInYear: semInfo.semesterInYear,
                        results: courseResults
                    });
                }
            }

            setSemesterGroups(groups.sort((a,b) => b.year - a.year || b.semesterInYear - a.semesterInYear));

        } catch (error) {
            console.error("Error fetching results:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    React.useEffect(() => {
        if (currentUser) fetchData();
    }, [currentUser, fetchData]);

    if (loading) return (
        <div className="space-y-6">
            <Skeleton className="h-12 w-1/3" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-6 w-6 text-primary" />
                        <CardTitle className="font-headline text-2xl">My Academic Results</CardTitle>
                    </div>
                    <CardDescription>A complete historical overview of your grades across all semesters.</CardDescription>
                </CardHeader>
            </Card>

            {semesterGroups.length > 0 ? (
                <Accordion type="multiple" defaultValue={semesterGroups.map(g => g.semesterId)} className="space-y-4">
                    {semesterGroups.map((group) => (
                        <AccordionItem value={group.semesterId} key={group.semesterId} className="border rounded-lg bg-card overflow-hidden">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="text-left">
                                        <p className="font-bold text-lg">{group.semesterName}</p>
                                        <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Year {group.year}, Semester {group.semesterInYear}</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-0">Course</TableHead>
                                            <TableHead className="text-center">CA (40%)</TableHead>
                                            <TableHead className="text-center">Exam (60%)</TableHead>
                                            <TableHead className="text-center">Final Mark</TableHead>
                                            <TableHead className="text-right">Grade</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.results.map((res) => (
                                            <TableRow key={res.courseId} className="group hover:bg-muted/20">
                                                <TableCell className="pl-0 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm">{res.courseCode}</span>
                                                        <span className="text-xs text-muted-foreground line-clamp-1">{res.courseName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-medium">
                                                    {res.caMark !== null ? (
                                                        <span className={cn(res.caMark < 50 && "text-destructive")}>
                                                            {res.caMark.toFixed(1)}%
                                                        </span>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {res.isPublished ? (
                                                        res.examScore !== null ? (
                                                            <span className="font-medium">{res.examScore.toFixed(1)}%</span>
                                                        ) : '-'
                                                    ) : (
                                                        <Badge variant="secondary" className="text-[9px] uppercase font-black tracking-tighter bg-muted/50">Provisional</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {res.isPublished ? (
                                                        res.finalMark !== null ? (
                                                            <Badge className={cn(res.finalMark >= 50 ? "bg-primary" : "bg-destructive")}>
                                                                {res.finalMark.toFixed(1)}%
                                                            </Badge>
                                                        ) : '-'
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">Awaiting Publication</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {res.isPublished ? (
                                                        <span className={cn("font-black text-xl", res.grade === 'F' ? "text-destructive" : "text-primary")}>
                                                            {res.grade}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground">TBA</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : (
                <div className="py-20 text-center text-muted-foreground bg-muted/10 rounded-xl border-2 border-dashed">
                    <ClipboardCheck className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <h3 className="text-lg font-bold">No Records Found</h3>
                    <p className="text-sm max-w-xs mx-auto">Once your lecturers grade your work and the exam office publishes the results, they will appear here grouped by semester.</p>
                </div>
            )}

            <Alert className="bg-muted/50 border-0">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-[10px] font-black uppercase tracking-widest">Publication Policy</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                    Continuous Assessment (CA) marks are visible as soon as they are recorded. However, Final Exam marks and Letter Grades are provisional until officially published by the Board of Examiners for the entire cohort.
                </AlertDescription>
            </Alert>
        </div>
    );
}
