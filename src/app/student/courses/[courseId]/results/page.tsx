'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, Flag, Loader2, ClipboardCheck, Info } from "lucide-react";
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, onValue, push, serverTimestamp, set } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useParams, useSearchParams } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type AssessmentScore = {
    score?: number;
    feedback?: string;
}

type UserData = {
    id: string; // STU-001
    name: string;
}

type CourseData = {
    name: string;
    code: string;
}

type AssessmentComponent = {
    id: string;
    name: string;
    weight: number;
}

export default function StudentResultsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const courseId = params.courseId as string;
    const semesterIdFilter = searchParams.get('semesterId');
    
    const [scores, setScores] = React.useState<Record<string, AssessmentScore> | null>(null);
    const [templateComponents, setTemplateComponents] = React.useState<AssessmentComponent[]>([]);
    const [isPublished, setIsPublished] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [courseData, setCourseData] = React.useState<CourseData | null>(null);
    const { toast } = useToast();

    // Appeal Dialog State
    const [isAppealDialogOpen, setIsAppealDialogOpen] = React.useState(false);
    const [appealingAssessment, setAppealingAssessment] = React.useState('');
    const [appealReason, setAppealReason] = React.useState('');
    const [formLoading, setFormLoading] = React.useState(false);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, snapshot => setUserData(snapshot.val()));
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser || !courseId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [courseSnap, publishedSnap] = await Promise.all([
                    get(ref(db, `courses/${courseId}`)),
                    semesterIdFilter ? get(ref(db, `resultsPublished/${semesterIdFilter}/${courseId}`)) : Promise.resolve({ exists: () => false, val: () => false } as any)
                ]);

                const cData = courseSnap.val();
                setCourseData(cData);
                setIsPublished(publishedSnap.exists() ? publishedSnap.val() : false);

                if (cData?.assessmentTemplateId) {
                    const templateSnap = await get(ref(db, `settings/assessmentTemplates/${cData.assessmentTemplateId}`));
                    if (templateSnap.exists()) {
                        setTemplateComponents(Object.entries(templateSnap.val().components).map(([id, c]: [string, any]) => ({ id, ...c })));
                    }
                }

                // Fetch scores from semester-specific path if available, otherwise fallback
                const path = semesterIdFilter ? `assessments/${semesterIdFilter}/${courseId}/${currentUser.uid}` : `assessments/${courseId}/${currentUser.uid}`;
                const scoresSnap = await get(ref(db, path));
                
                if (scoresSnap.exists()) {
                    setScores(scoresSnap.val());
                } else {
                    // Legacy fallback
                    const legacySnap = await get(ref(db, `assessments/${courseId}/${currentUser.uid}`));
                    setScores(legacySnap.exists() ? legacySnap.val() : null);
                }

            } catch (error: any) {
                console.error("Error fetching scores:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch your results." });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId, currentUser, semesterIdFilter, toast]);
    
    const handleSubmitAppeal = async () => {
        if(!appealingAssessment || !appealReason.trim() || !currentUser || !userData || !courseData){
            toast({ variant: 'destructive', title: 'Please fill out all fields.'});
            return;
        }
        setFormLoading(true);
        try {
            const newAppealRef = push(ref(db, 'appeals'));
            await set(newAppealRef, {
                studentId: currentUser.uid,
                studentName: userData.name,
                studentSystemId: userData.id,
                courseId: courseId,
                courseName: courseData.name,
                courseCode: courseData.code,
                assessment: appealingAssessment,
                reason: appealReason,
                status: 'Pending',
                dateSubmitted: new Date().toISOString()
            });

            try {
                const registrarIds = await getRegistrarIds();
                if (registrarIds.length > 0) {
                    await createNotification(
                        registrarIds, 
                        `${userData.name} submitted a grade appeal for ${courseData.code}.`,
                        '/admin/exams/student-appeals'
                    );
                }
            } catch (notifError) {
                console.warn("Notification dispatch failed, but appeal was saved successfully:", notifError);
            }
            
            toast({ title: 'Appeal Submitted', description: 'Your appeal has been sent for review.'});
            setIsAppealDialogOpen(false);
            setAppealReason('');
            setAppealingAssessment('');

        } catch (error: any) {
            console.error("Appeal Submission Error:", error);
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message || 'An error occurred while saving your appeal.' });
        } finally {
            setFormLoading(false);
        }
    }

    const hasAnyScore = scores && Object.values(scores).some(v => v?.score !== undefined);

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-1/3"/><Skeleton className="h-64 w-full"/></div>;

    return (
        <Card className="shadow-lg">
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-headline">My Academic Performance</CardTitle>
                        {isPublished ? (
                            <Badge className="bg-green-600 text-white border-green-700">Official Results</Badge>
                        ) : (
                            <Badge variant="secondary">Provisional / Unofficial</Badge>
                        )}
                    </div>
                    <CardDescription>Track your progress across continuous assessment components and final examinations.</CardDescription>
                </div>
                 <Dialog open={isAppealDialogOpen} onOpenChange={setIsAppealDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" disabled={!hasAnyScore} className="font-bold">
                            <Flag className="mr-2 h-4 w-4"/>
                            Appeal a Grade
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Submit Grade Appeal</DialogTitle>
                            <DialogDescription>
                                If you believe there has been an error in your grading, please submit your appeal here.
                            </DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="space-y-1">
                                <Label htmlFor="assessment-select">Assessment to Appeal</Label>
                                <Select value={appealingAssessment} onValueChange={setAppealingAssessment}>
                                    <SelectTrigger id="assessment-select">
                                        <SelectValue placeholder="Select an assessment..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templateComponents
                                            .filter(col => scores?.[col.id]?.score !== undefined)
                                            .map(col => <SelectItem key={col.id} value={col.name}>{col.name}</SelectItem>)
                                        }
                                        {scores?.finalExam?.score !== undefined && (
                                            <SelectItem value="Final Exam">Final Exam</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="reason">Reason for Appeal</Label>
                                <Textarea id="reason" placeholder="Please provide a clear and concise reason for your appeal..." value={appealReason} onChange={e => setAppealReason(e.target.value)} rows={5}/>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSubmitAppeal} disabled={formLoading}>{formLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Submit Appeal'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {hasAnyScore ? (
                    <div className="rounded-md border overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Assessment Component</TableHead>
                                    <TableHead className="text-center">Weight</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templateComponents.map(comp => {
                                    const result = scores?.[comp.id];
                                    return (
                                        <Collapsible asChild key={comp.id}>
                                            <>
                                                <TableRow className="group">
                                                    <TableCell className="font-bold">{comp.name}</TableCell>
                                                    <TableCell className="text-center text-xs text-muted-foreground">{comp.weight}%</TableCell>
                                                    <TableCell className="text-center">
                                                        {result?.score !== undefined ? (
                                                            <Badge variant={result.score >= 50 ? "default" : "destructive"} className="font-mono min-w-[60px] justify-center">
                                                                {result.score}%
                                                            </Badge>
                                                        ) : <span className="text-xs text-muted-foreground italic">Not Graded</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {result?.feedback ? (
                                                            <CollapsibleTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="h-8">
                                                                    Feedback <ChevronDown className="h-4 w-4 ml-1" />
                                                                </Button>
                                                            </CollapsibleTrigger>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground uppercase font-black">No Notes</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                                {result?.feedback && (
                                                    <CollapsibleContent asChild>
                                                        <tr className="bg-primary/5 hover:bg-primary/5">
                                                            <TableCell colSpan={4} className="p-4 border-l-4 border-l-primary">
                                                                <div className="flex items-start gap-2">
                                                                    <Info className="h-4 w-4 text-primary mt-0.5" />
                                                                    <p className="text-sm italic leading-relaxed">{result.feedback}</p>
                                                                </div>
                                                            </TableCell>
                                                        </tr>
                                                    </CollapsibleContent>
                                                )}
                                            </>
                                        </Collapsible>
                                    );
                                })}
                                
                                {scores?.finalExam?.score !== undefined && (
                                    <TableRow className="bg-muted/20 border-t-2">
                                        <TableCell className="font-black text-primary">FINAL EXAMINATION</TableCell>
                                        <TableCell className="text-center text-xs font-bold">60%</TableCell>
                                        <TableCell className="text-center">
                                            <Badge className="bg-primary text-white font-mono min-w-[60px] justify-center text-sm shadow-md">
                                                {scores.finalExam.score}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isPublished ? (
                                                <Badge variant="outline" className="text-[10px] uppercase font-black border-green-600 text-green-600">Finalized</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] uppercase font-black">Provisional</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="py-20 text-center text-muted-foreground bg-muted/10 border-2 border-dashed rounded-xl">
                        <ClipboardCheck className="mx-auto h-12 w-12 opacity-20 mb-4" />
                        <h3 className="text-lg font-bold">No Results Found</h3>
                        <p className="text-sm max-w-xs mx-auto">Results will appear here as your lecturer posts grades for CA components and examinations.</p>
                    </div>
                )}
            </CardContent>
            {hasAnyScore && !isPublished && (
                <CardFooter>
                    <Alert className="bg-muted/50 border-0">
                        <Info className="h-4 w-4" />
                        <AlertTitle className="text-xs font-bold uppercase tracking-widest">Provisional Notice</AlertTitle>
                        <AlertDescription className="text-xs italic leading-relaxed">
                            Scores shown are provisional and subject to verification by the Board of Examiners. Official results will be marked with a green badge once published by the Registrar.
                        </AlertDescription>
                    </Alert>
                </CardFooter>
            )}
        </Card>
    );
}
