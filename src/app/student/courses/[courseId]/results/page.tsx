
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useParams } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

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
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser || !courseId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const scoresRef = ref(db, `assessments/${courseId}/${currentUser.uid}`);
                const scoresSnapshot = await get(scoresRef);
                if (scoresSnapshot.exists()) {
                    setScores(scoresSnapshot.val());
                } else {
                    setScores(null);
                }
            } catch (error: any) {
                console.error("Error fetching scores:", error);
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch your results." });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId, currentUser, toast]);

    const hasResults = scores && Object.values(scores).some(v => v?.score !== undefined);

    return (
        <Card>
            <CardHeader>
                <CardTitle>My Results & Feedback</CardTitle>
                <CardDescription>View your scores and feedback from your lecturer for this course.</CardDescription>
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
