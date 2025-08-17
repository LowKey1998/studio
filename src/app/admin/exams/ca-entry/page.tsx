
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
}

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerId: string;
    assessmentTemplateId?: string;
};

type AssessmentComponent = {
    id: string;
    name: string;
    weight: number;
}

type AssessmentScore = {
    score?: number;
    feedback?: string;
}

type AssessmentScores = Record<string, AssessmentScore>; // componentId -> score
type AllScores = Record<string, AssessmentScores>; // studentUid -> scores

export default function CAEntryPage() {
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [students, setStudents] = React.useState<Student[]>([]);
    const [scores, setScores] = React.useState<AllScores>({});
    
    const [templateComponents, setTemplateComponents] = React.useState<AssessmentComponent[]>([]);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Fetch semesters
    React.useEffect(() => {
        const semestersRef = ref(db, 'semesters');
        const unsub = onValue(semestersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived');
                setSemesters(list.sort((a,b) => b.name.localeCompare(a.name)));
                if(list.length > 0 && !selectedSemester) setSelectedSemester(list[0].id);
            }
             setLoading(false);
        });
        return () => unsub();
    }, [selectedSemester]);

    // Fetch courses for selected semester
    React.useEffect(() => {
        if (!selectedSemester) return;
        setLoading(true);
        const fetchCourses = async () => {
            const regsSnap = await get(ref(db, 'registrations'));
            const coursesSnap = await get(ref(db, 'courses'));
            if (!regsSnap.exists() || !coursesSnap.exists()) {
                setCourses([]); setLoading(false); return;
            }
            const allCourses = coursesSnap.val();
            
            const coursesInSemester = new Set<string>();
            Object.values(regsSnap.val()).forEach((userRegs: any) => {
                 if (userRegs[selectedSemester]) {
                    userRegs[selectedSemester].courses.forEach((cid: string) => coursesInSemester.add(cid));
                }
            });
            
            setCourses(Array.from(coursesInSemester).map(cid => ({ id: cid, ...allCourses[cid] })).sort((a, b) => a.name.localeCompare(b.name)));
            setLoading(false);
        };
        fetchCourses();
    }, [selectedSemester]);

    // Fetch students, template, and scores for selected course
    React.useEffect(() => {
        if (!selectedCourseId) {
            setStudents([]); setScores({}); setTemplateComponents([]); return;
        }
        setLoading(true);
        const fetchData = async () => {
            try {
                const course = courses.find(c => c.id === selectedCourseId);
                if (!course) throw new Error("Course data not found");
                
                // Fetch Assessment Template
                if (course.assessmentTemplateId) {
                    const templateSnap = await get(ref(db, `settings/assessmentTemplates/${course.assessmentTemplateId}`));
                    if(templateSnap.exists()) {
                        const templateData = templateSnap.val();
                        setTemplateComponents(templateData.components ? Object.entries(templateData.components).map(([id, comp]: [string, any]) => ({ id, ...comp })) : []);
                    } else { setTemplateComponents([]); }
                } else { setTemplateComponents([]); }

                // Fetch Enrolled Students
                const allUsersSnapshot = await get(ref(db, 'users'));
                const allUsers = allUsersSnapshot.val();
                const registrationsSnapshot = await get(ref(db, 'registrations'));
                const enrolledStudentUids: string[] = [];

                if (registrationsSnapshot.exists()) {
                    const allRegistrations = registrationsSnapshot.val();
                    for (const userId in allRegistrations) {
                         const semesterReg = allRegistrations[userId][selectedSemester];
                        if (semesterReg && semesterReg.courses.includes(selectedCourseId) && (semesterReg.status === 'Completed' || semesterReg.status === 'Pending Payment')) {
                            enrolledStudentUids.push(userId);
                        }
                    }
                }
                const studentList: Student[] = enrolledStudentUids.map(uid => ({
                    uid, id: allUsers[uid]?.id || 'N/A', name: allUsers[uid]?.name || 'Unknown',
                })).sort((a, b) => a.name.localeCompare(b.name));
                setStudents(studentList);

                // Fetch existing scores
                const scoresRef = ref(db, `assessments/${selectedCourseId}`);
                const scoresSnapshot = await get(scoresRef);
                setScores(scoresSnapshot.exists() ? scoresSnapshot.val() : {});

            } catch (error: any) {
                toast({ variant: 'destructive', title: "Error", description: "Could not fetch data for this course." });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedCourseId, selectedSemester, toast, courses]);

    const handleScoreChange = (studentUid: string, componentId: string, value: string) => {
        const numericValue = value === '' ? undefined : Number(value);
        if (numericValue !== undefined && (isNaN(numericValue) || numericValue < 0 || numericValue > 100)) {
            toast({ variant: 'destructive', title: "Invalid Score", description: "Score must be between 0 and 100." });
            return;
        }
        setScores(prev => ({
            ...prev,
            [studentUid]: { ...(prev[studentUid] || {}), [componentId]: { ...(prev[studentUid]?.[componentId] || {}), score: numericValue } },
        }));
    };
    
     const handleFeedbackChange = (studentUid: string, componentId: string, feedback: string) => {
        setScores(prev => ({
            ...prev,
            [studentUid]: { ...(prev[studentUid] || {}), [componentId]: { ...(prev[studentUid]?.[componentId] || {}), feedback: feedback } },
        }));
    };

    const handleSaveScores = async () => {
        if (!selectedCourseId) return;
        setSaving(true);
        try {
            const scoresRef = ref(db, `assessments/${selectedCourseId}`);
            await set(scoresRef, scores);
            toast({ title: "Scores Saved", description: "Continuous assessment scores have been updated." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Continuous Assessment Entry</CardTitle>
                <CardDescription>Select a semester and course to enter student scores. All scores are out of 100.</CardDescription>
                <div className="grid md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-1">
                        <Label>Semester</Label>
                        <Select value={selectedSemester} onValueChange={setSelectedSemester}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{semesters.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Course</Label>
                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId}><SelectTrigger><SelectValue placeholder="Select course..."/></SelectTrigger><SelectContent>{courses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? ( <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : selectedCourseId && templateComponents.length > 0 && students.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead className="min-w-[150px]">Student Name</TableHead><TableHead className="min-w-[100px]">Student ID</TableHead>{templateComponents.map(col => <TableHead key={col.id}>{col.name} ({col.weight}%)</TableHead>)}</TableRow></TableHeader>
                            <TableBody>
                                {students.map((student) => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell>{student.id}</TableCell>
                                        {templateComponents.map(col => (
                                            <TableCell key={col.id}>
                                                <div className="flex items-center gap-2">
                                                <Input type="number" min="0" max="100" className="w-20" value={scores[student.uid]?.[col.id]?.score ?? ''} onChange={(e) => handleScoreChange(student.uid, col.id, e.target.value)} placeholder="-"/>
                                                <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MessageSquare className="h-4 w-4" /></Button></PopoverTrigger>
                                                    <PopoverContent><div className="grid gap-4"><div className="space-y-2"><h4 className="font-medium leading-none">Feedback</h4><p className="text-sm text-muted-foreground">Provide feedback for {student.name} on {col.name}.</p></div><div className="grid gap-2"><Textarea value={scores[student.uid]?.[col.id]?.feedback ?? ''} onChange={(e) => handleFeedbackChange(student.uid, col.id, e.target.value)} /></div></div></PopoverContent>
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
                    <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Data to Display</AlertTitle><AlertDescription>
                        {selectedCourseId ? 'No students are enrolled, or no assessment template is assigned to this course. Please check course settings.' : 'Please select a semester and course to begin.'}
                    </AlertDescription></Alert>
                )}
            </CardContent>
            {students.length > 0 && templateComponents.length > 0 && (
                <CardFooter className="flex justify-end border-t pt-6">
                    <Button onClick={handleSaveScores} disabled={saving || loading}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save All Scores'}</Button>
                </CardFooter>
            )}
        </Card>
    );
}
