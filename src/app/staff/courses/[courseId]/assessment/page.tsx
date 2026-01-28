
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertCircle, MessageSquare } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useParams } from 'next/navigation';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
};

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

type AllScores = Record<string, AssessmentScores>; // studentUid -> scores

const assessmentColumns: { key: keyof AssessmentScores, label: string }[] = [
    { key: 'assignment1', label: 'Assignment 1' },
    { key: 'quiz1', label: 'Quiz 1' },
    { key: 'midterm', label: 'Midterm' },
    { key: 'finalExam', label: 'Final Exam' },
];

export default function CourseAssessmentPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [students, setStudents] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser || !courseId) return;
        setLoading(true);
        try {
            // Fetch Enrolled Students
            const allUsersSnapshot = await get(ref(db, 'users'));
            const allUsers = allUsersSnapshot.val();
            const registrationsSnapshot = await get(ref(db, 'registrations'));
            const enrolledStudentUids: string[] = [];

            if (registrationsSnapshot.exists()) {
                const allRegistrations = registrationsSnapshot.val();
                for (const userId in allRegistrations) {
                    for (const semester in allRegistrations[userId]) {
                        const reg = allRegistrations[userId][semester];
                        if (reg.courses.includes(courseId) && reg.status === 'Completed') {
                            enrolledStudentUids.push(userId);
                        }
                    }
                }
            }

            const studentList: Student[] = enrolledStudentUids.map(uid => ({
                uid,
                id: allUsers[uid]?.id || 'N/A',
                name: allUsers[uid]?.name || 'Unknown',
            })).sort((a, b) => a.name.localeCompare(b.name));
            setStudents(studentList);

            // Fetch existing scores
            const scoresRef = ref(db, `assessments/${courseId}`);
            const scoresSnapshot = await get(scoresRef);
            if (scoresSnapshot.exists()) {
                setScores(scoresSnapshot.val());
            } else {
                setScores({});
            }

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not fetch data." });
        } finally {
            setLoading(false);
        }
    }, [courseId, currentUser, toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleScoreChange = (studentUid: string, field: keyof AssessmentScores, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (isNaN(numericValue) || numericValue < 0 || numericValue > 100)) {
            toast({ variant: 'destructive', title: "Invalid Score", description: "Score must be between 0 and 100." });
            return;
        }

        setScores(prev => ({
            ...prev,
            [studentUid]: {
                ...prev[studentUid],
                [field]: {
                    ...prev[studentUid]?.[field],
                    score: numericValue
                }
            },
        }));
    };

    const handleFeedbackChange = (studentUid: string, field: keyof AssessmentScores, feedback: string) => {
        setScores(prev => ({
            ...prev,
            [studentUid]: {
                ...prev[studentUid],
                [field]: {
                    ...prev[studentUid]?.[field],
                    feedback: feedback
                }
            }
        }));
    }

    const handleSaveScores = async () => {
        if (!courseId) return;
        setSaving(true);
        try {
            const scoresRef = ref(db, `assessments/${courseId}`);
            await set(scoresRef, scores);
            toast({ title: "Scores Saved", description: "Continuous assessment scores have been updated." });
        } catch (error: any) {
            console.error("Error saving scores:", error);
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Continuous Assessment</CardTitle>
                <CardDescription>Enter and manage student scores for this course. All scores are out of 100.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : students.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[150px]">Student Name</TableHead>
                                    <TableHead className="min-w-[100px]">Student ID</TableHead>
                                    {assessmentColumns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell>{student.id}</TableCell>
                                        {assessmentColumns.map(col => (
                                            <TableCell key={col.key}>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="w-20"
                                                        value={scores[student.uid]?.[col.key]?.score ?? ''}
                                                        onChange={(e) => handleScoreChange(student.uid, col.key, e.target.value)}
                                                        placeholder="-"
                                                    />
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                <MessageSquare className="h-4 w-4" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent>
                                                            <div className="grid gap-4">
                                                                <div className="space-y-2">
                                                                    <h4 className="font-medium leading-none">Feedback</h4>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Provide feedback for {student.name} on {col.label}.
                                                                    </p>
                                                                </div>
                                                                <div className="grid gap-2">
                                                                    <Textarea 
                                                                        value={scores[student.uid]?.[col.key]?.feedback ?? ''}
                                                                        onChange={(e) => handleFeedbackChange(student.uid, col.key, e.target.value)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Students Enrolled</AlertTitle>
                        <AlertDescription>
                            There are no students with completed registrations for this course yet.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            {students.length > 0 && (
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button onClick={handleSaveScores} disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save All Scores
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
