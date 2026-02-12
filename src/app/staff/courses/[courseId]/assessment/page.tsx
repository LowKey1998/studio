
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
import { useParams, useSearchParams } from 'next/navigation';
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

type AllScores = Record<string, Record<string, AssessmentScore>>; // studentUid -> componentId -> score

export default function CourseAssessmentPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const courseId = params.courseId as string;
    const semesterIdFilter = searchParams.get('semesterId');
    
    const [students, setStudents] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    const [templateComponents, setTemplateComponents] = React.useState<any[]>([]);
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
            const courseSnap = await get(ref(db, `courses/${courseId}`));
            const courseData = courseSnap.exists() ? courseSnap.val() : null;
            if (!courseData) throw new Error("Course not found");

            // Load assessment template
            if (courseData.assessmentTemplateId) {
                const templateSnap = await get(ref(db, `settings/assessmentTemplates/${courseData.assessmentTemplateId}`));
                if (templateSnap.exists()) {
                    setTemplateComponents(Object.entries(templateSnap.val().components).map(([id, c]: [string, any]) => ({ id, ...c })));
                }
            }

            // Fetch Enrolled Students for this instance
            const allUsersSnapshot = await get(ref(db, 'users'));
            const allUsers = allUsersSnapshot.val();
            const registrationsSnapshot = await get(ref(db, 'registrations'));
            const enrolledStudentUids: string[] = [];

            if (registrationsSnapshot.exists()) {
                const allRegistrations = registrationsSnapshot.val();
                for (const userId in allRegistrations) {
                    const userRegs = allRegistrations[userId];
                    const semesterIdsToCheck = (courseData.separateInstance && semesterIdFilter) ? [semesterIdFilter] : Object.keys(userRegs);

                    for (const semId of semesterIdsToCheck) {
                        const reg = userRegs[semId];
                        if (!reg) continue;
                        if (reg.courses?.includes(courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                            enrolledStudentUids.push(userId);
                            break;
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
    }, [courseId, semesterIdFilter, currentUser, toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleScoreChange = (studentUid: string, componentId: string, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (isNaN(numericValue) || numericValue < 0 || numericValue > 100)) {
            return;
        }

        setScores(prev => ({
            ...prev,
            [studentUid]: {
                ...(prev[studentUid] || {}),
                [componentId]: {
                    ...(prev[studentUid]?.[componentId] || {}),
                    score: numericValue
                }
            },
        }));
    };

    const handleFeedbackChange = (studentUid: string, componentId: string, feedback: string) => {
        setScores(prev => ({
            ...prev,
            [studentUid]: {
                ...(prev[studentUid] || {}),
                [componentId]: {
                    ...(prev[studentUid]?.[componentId] || {}),
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
            toast({ title: "Scores Saved", description: "Gradebook updated for this instance." });
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
                <CardTitle>Instance Assessment</CardTitle>
                <CardDescription>
                    {semesterIdFilter ? "Grading students enrolled in this specific group." : "Enter and manage student scores for this course."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : students.length > 0 && templateComponents.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[150px]">Student Name</TableHead>
                                    <TableHead className="min-w-[100px]">Student ID</TableHead>
                                    {templateComponents.map(col => <TableHead key={col.id}>{col.name} ({col.weight}%)</TableHead>)}
                                    <TableHead>Final Exam</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell>{student.id}</TableCell>
                                        {templateComponents.map(col => (
                                            <TableCell key={col.id}>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        className="w-20 h-8 text-xs"
                                                        value={scores[student.uid]?.[col.id]?.score ?? ''}
                                                        onChange={(e) => handleScoreChange(student.uid, col.id, e.target.value)}
                                                        placeholder="-"
                                                    />
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                <MessageSquare className="h-3 w-3" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent>
                                                            <div className="grid gap-2">
                                                                <Label className="text-xs font-bold uppercase">Feedback: {col.name}</Label>
                                                                <Textarea 
                                                                    className="text-xs"
                                                                    value={scores[student.uid]?.[col.id]?.feedback ?? ''}
                                                                    onChange={(e) => handleFeedbackChange(student.uid, col.id, e.target.value)}
                                                                />
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </TableCell>
                                        ))}
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="w-20 h-8 text-xs font-bold" 
                                                value={scores[student.uid]?.finalExam?.score ?? ''} 
                                                onChange={(e) => handleScoreChange(student.uid, 'finalExam', e.target.value)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{templateComponents.length === 0 ? "Template Required" : "No Students"}</AlertTitle>
                        <AlertDescription>
                            {templateComponents.length === 0 
                                ? "This course requires an Assessment Template to be assigned by an Admin before grades can be entered." 
                                : "There are no students with completed registrations for this specific class group yet."}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            {students.length > 0 && templateComponents.length > 0 && (
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
