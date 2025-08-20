
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, Flag, Loader2 } from "lucide-react";
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, onValue, push, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useParams } from 'next/navigation';
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

type AssessmentScores = {
    assignment1?: AssessmentScore;
    quiz1?: AssessmentScore;
    midterm?: AssessmentScore;
    finalExam?: AssessmentScore;
};

type UserData = {
    id: string; // STU-001
    name: string;
}

type CourseData = {
    name: string;
    code: string;
}

const assessmentColumns: { key: keyof AssessmentScores, label: string }[] = [
    { key: 'assignment1', label: 'Assignment 1' },
    { key: 'quiz1', label: 'Quiz 1' },
    { key: 'midterm', label: 'Midterm' },
    { key: 'finalExam', label: 'Final Exam' },
];

export default function StudentResultsPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [scores, setScores] = React.useState<AssessmentScores | null>(null);
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
                const [scoresSnapshot, courseSnapshot] = await Promise.all([
                    get(ref(db, `assessments/${courseId}/${currentUser.uid}`)),
                    get(ref(db, `courses/${courseId}`))
                ]);
                
                setScores(scoresSnapshot.exists() ? scoresSnapshot.val() : null);
                setCourseData(courseSnapshot.exists() ? courseSnapshot.val() : null);

            } catch (error: any) {
                console.error("Error fetching scores:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch your results." });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId, currentUser, toast]);
    
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

            const registrarIds = await getRegistrarIds();
            const notificationPromises = registrarIds.map(id => 
                createNotification(
                    id, 
                    `${userData.name} submitted a grade appeal for ${courseData.code}.`,
                    '/admin/exams/student-appeals'
                )
            );
            await Promise.all(notificationPromises);
            
            toast({ title: 'Appeal Submitted', description: 'Your appeal has been sent for review.'});
            setIsAppealDialogOpen(false);
            setAppealReason('');
            setAppealingAssessment('');

        } catch (error) {
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setFormLoading(false);
        }
    }

    const hasResults = scores && Object.values(scores).some(v => v?.score !== undefined);

    return (
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                    <CardTitle>My Results & Feedback</CardTitle>
                    <CardDescription>View your scores and feedback from your lecturer for this course.</CardDescription>
                </div>
                 <Dialog open={isAppealDialogOpen} onOpenChange={setIsAppealDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="secondary" disabled={!hasResults}><Flag className="mr-2 h-4 w-4"/>Submit Grade Appeal</Button>
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
                                        {assessmentColumns
                                            .filter(col => scores?.[col.key]?.score !== undefined)
                                            .map(col => <SelectItem key={col.key} value={col.label}>{col.label}</SelectItem>)
                                        }
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
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : hasResults ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Assessment</TableHead>
                                <TableHead className="text-center">Score</TableHead>
                                <TableHead className="text-right">Feedback</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assessmentColumns.map(col => {
                                const result = scores?.[col.key];
                                if (!result || result.score === undefined) return null;

                                return (
                                    <Collapsible asChild key={col.key}>
                                        <>
                                            <TableRow>
                                                <TableCell className="font-medium">{col.label}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={result.score >= 50 ? "default" : "destructive"}>{result.score} / 100</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {result.feedback ? (
                                                        <CollapsibleTrigger asChild>
                                                            <Button variant="ghost" size="sm">
                                                                View <ChevronDown className="h-4 w-4" />
                                                            </Button>
                                                        </CollapsibleTrigger>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No feedback</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {result.feedback && (
                                                <CollapsibleContent asChild>
                                                    <tr className="bg-muted/50 hover:bg-muted/50">
                                                        <TableCell colSpan={3} className="p-4">
                                                            <p className="text-sm whitespace-pre-wrap">{result.feedback}</p>
                                                        </TableCell>
                                                    </tr>
                                                </CollapsibleContent>
                                            )}
                                        </>
                                    </Collapsible>
                                );
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Results Available</AlertTitle>
                        <AlertDescription>
                            Your lecturer has not posted any results for this course yet.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}

