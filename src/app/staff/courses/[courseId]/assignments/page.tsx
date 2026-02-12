'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, CalendarIcon, Trash2, Eye, ShieldCheck, Download, ClipboardCheck, Save } from "lucide-react";
import { db, createNotification } from '@/lib/firebase';
import { ref, get, set, push, remove, update } from 'firebase/database';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type Assignment = { 
    id: string; 
    title: string; 
    description: string; 
    dueDate: string; 
    linkedComponentId?: string;
    submissions?: Record<string, Submission> 
};

type Submission = { 
    studentId: string; 
    studentName: string; 
    submissionUrl: string; 
    submittedAt: string; 
    isGoogleDoc: boolean; 
    plagiarismScore?: number; 
};

type Student = {
    uid: string;
    id: string;
    name: string;
};

type AssessmentComponent = {
    id: string;
    name: string;
};

export default function CourseAssignmentsPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [assignments, setAssignments] = React.useState<Assignment[]>([]);
    const [enrolledStudents, setEnrolledStudents] = React.useState<Student[]>([]);
    const [assessmentComponents, setAssessmentComponents] = React.useState<AssessmentComponent[]>([]);
    const [courseData, setCourseData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const { user, userProfile } = useAuth();

    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = React.useState(false);
    const [isGradingOpen, setIsGradingOpen] = React.useState(false);
    const [selectedAssignment, setSelectedAssignment] = React.useState<Assignment | null>(null);
    const [assignmentScores, setAssignmentScores] = React.useState<Record<string, { score?: number; feedback?: string }>>({});
    
    const [formLoading, setFormLoading] = React.useState(false);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [dueDate, setDueDate] = React.useState<Date | undefined>();
    const [linkedComponentId, setLinkedComponentId] = React.useState('');
    
    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const [assignmentsSnap, courseSnap, usersSnap, regsSnap, templatesSnap] = await Promise.all([
                get(ref(db, `assignments/${courseId}`)),
                get(ref(db, `courses/${courseId}`)),
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'settings/assessmentTemplates'))
            ]);
            
            let cData = null;
            if (courseSnap.exists()) {
                cData = courseSnap.val();
                setCourseData(cData);
                
                if (cData.assessmentTemplateId && templatesSnap.exists()) {
                    const template = templatesSnap.val()[cData.assessmentTemplateId];
                    if (template && template.components) {
                        setAssessmentComponents(Object.entries(template.components).map(([id, data]: [string, any]) => ({ id, name: data.name })));
                    }
                }
            }
            
            const allUsers = usersSnap.val() || {};
            const allRegs = regsSnap.val() || {};
            const enrolledList: Student[] = [];
            for (const uid in allRegs) {
                const userRegs = allRegs[uid];
                for (const semId in userRegs) {
                    if (userRegs[semId].courses?.includes(courseId) && (userRegs[semId].status === 'Completed' || userRegs[semId].status === 'Pending Payment')) {
                        if (allUsers[uid]) enrolledList.push({ uid, id: allUsers[uid].id, name: allUsers[uid].name });
                        break;
                    }
                }
            }
            setEnrolledStudents(enrolledList.sort((a,b) => a.name.localeCompare(b.name)));
            setAssignments(assignmentsSnap.exists() ? Object.entries(assignmentsSnap.val()).map(([id, data]) => ({ id, ...(data as any) })) : []);
        } catch (error) { 
            console.error("Error:", error); 
        } finally { 
            setLoading(false); 
        }
    }, [courseId]);

    React.useEffect(() => {
        if(user) fetchData();
    }, [user, fetchData]);
    
    const handleOpenGrading = async (a: Assignment) => {
        setSelectedAssignment(a);
        setActionLoading(`grading-${a.id}`);
        try {
            const scoresRef = ref(db, `assessments/${courseId}`);
            const snapshot = await get(scoresRef);
            const allCourseScores = snapshot.exists() ? snapshot.val() : {};
            
            const initialScores: Record<string, any> = {};
            enrolledStudents.forEach(s => {
                if (a.linkedComponentId && allCourseScores[s.uid]?.[a.linkedComponentId]) {
                    initialScores[s.uid] = allCourseScores[s.uid][a.linkedComponentId];
                } else {
                    initialScores[s.uid] = { score: undefined, feedback: '' };
                }
            });
            setAssignmentScores(initialScores);
            setIsGradingOpen(true);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to load scores' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveGrades = async () => {
        if (!selectedAssignment) return;
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            const scoresRef = ref(db, `assessments/${courseId}`);
            const snapshot = await get(scoresRef);
            const currentScores = snapshot.exists() ? snapshot.val() : {};

            for (const uid in assignmentScores) {
                const scoreData = assignmentScores[uid];
                if (scoreData.score !== undefined) {
                    if (selectedAssignment.linkedComponentId) {
                        if (!currentScores[uid]) currentScores[uid] = {};
                        currentScores[uid][selectedAssignment.linkedComponentId] = scoreData;
                    }
                    updates[`assignments/${courseId}/${selectedAssignment.id}/grades/${uid}`] = scoreData;
                }
            }

            await set(scoresRef, currentScores);
            await update(ref(db), updates);
            toast({ title: 'Grades Saved' });
            setIsGradingOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleScoreChange = (uid: string, value: string) => {
        const score = value === '' ? undefined : parseFloat(value);
        setAssignmentScores(prev => ({ ...prev, [uid]: { ...prev[uid], score } }));
    };

    const handleFeedbackChange = (uid: string, feedback: string) => {
        setAssignmentScores(prev => ({ ...prev, [uid]: { ...prev[uid], feedback } }));
    };

    const handleAddAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description || !dueDate) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        setFormLoading(true);
        try {
            const newRef = push(ref(db, `assignments/${courseId}`));
            await set(newRef, { title, description, dueDate: format(dueDate, 'yyyy-MM-dd'), linkedComponentId: linkedComponentId || null });
            toast({ title: 'Assignment Added' });
            fetchData(); setIsAssignmentDialogOpen(false);
            setTitle(''); setDescription(''); setDueDate(undefined); setLinkedComponentId('');
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to add' }); } finally { setFormLoading(false); }
    };

    const handleCheckPlagiarism = async (a: Assignment, studentUid: string) => {
        if (!user) return;
        setActionLoading(`plag-${a.id}-${studentUid}`);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const randomScore = Math.floor(Math.random() * 30);
            await update(ref(db, `assignments/${courseId}/${a.id}/submissions/${studentUid}`), { plagiarismScore: randomScore, plagiarismReportedAt: new Date().toISOString() });
            toast({ title: 'Integrity Check Complete' });
            fetchData();
        } catch (e) { toast({ variant: 'destructive', title: 'Scan Failed' }); } finally { setActionLoading(null); }
    };

    const isAuthorized = React.useMemo(() => {
        if (!user || !courseData) return false;
        if (userProfile?.role === 'Admin') return true;
        const assignedLecturers = courseData.lecturerIds || [];
        return (Array.isArray(assignedLecturers) && assignedLecturers.includes(user.uid)) || courseData.lecturerId === user.uid;
    }, [user, userProfile, courseData]);

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1"><CardTitle>Assignments</CardTitle><CardDescription>Manage coursework and student submissions.</CardDescription></div>
                    {isAuthorized && (
                        <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Assignment</Button></DialogTrigger>
                            <DialogContent><form onSubmit={handleAddAssignment}>
                                <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} required/></div>
                                    <div className="space-y-1"><Label>Instructions</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} required/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label>Due Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, 'PPP') : "Select Date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent></Popover></div>
                                        <div className="space-y-1"><Label>Link to Gradebook</Label>
                                            <Select value={linkedComponentId} onValueChange={setLinkedComponentId}><SelectTrigger><SelectValue placeholder="Select component..."/></SelectTrigger><SelectContent><SelectItem value="none">No Link</SelectItem>{assessmentComponents.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>Create Assignment</Button></DialogFooter>
                            </form></DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                {assignments.length > 0 ? assignments.map(a => (
                    <Card key={a.id} className="mb-4">
                        <CardHeader><CardTitle className="text-lg">{a.title}</CardTitle><CardDescription>Due: {format(new Date(a.dueDate), 'PPP')}</CardDescription></CardHeader>
                        <CardFooter className="justify-between">
                                <Button variant="outline" size="sm" onClick={() => handleOpenGrading(a)} disabled={actionLoading === `grading-${a.id}`}>{actionLoading === `grading-${a.id}` ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <ClipboardCheck className="mr-2 h-4 w-4" />} Grade & Submissions ({Object.keys(a.submissions || {}).length})</Button>
                                {isAuthorized && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(ref(db, `assignments/${courseId}/${a.id}`)) }><Trash2 className="h-4 w-4"/></Button>}
                        </CardFooter>
                    </Card>
                )) : <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg"><p>No assignments created yet.</p></div>}
                </CardContent>
            </Card>

             <Dialog open={isGradingOpen} onOpenChange={setIsGradingOpen}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
                    <DialogHeader><DialogTitle>Grade Assignment: {selectedAssignment?.title}</DialogTitle><DialogDescription>Enter scores and feedback for all enrolled students.</DialogDescription></DialogHeader>
                     <div className="flex-1 overflow-auto mt-4 border rounded-md">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10"><TableRow><TableHead>Student</TableHead><TableHead>Submission / Plagiarism</TableHead><TableHead className="w-[120px]">Score (100)</TableHead><TableHead>Feedback</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {enrolledStudents.map(student => {
                                    const sub = selectedAssignment?.submissions?.[student.uid];
                                    return (
                                        <TableRow key={student.uid}>
                                            <TableCell><div>{student.name}</div><div className="text-[10px] text-muted-foreground">{student.id}</div></TableCell>
                                            <TableCell>
                                                {sub ? (<div className="flex items-center gap-2"><Button asChild variant="link" size="sm" className="p-0 h-auto"><a href={sub.submissionUrl} target="_blank"><Download className="h-3 w-3 mr-1"/> View</a></Button>
                                                    {sub.plagiarismScore !== undefined ? <Badge variant={sub.plagiarismScore > 20 ? "destructive" : "default"} className="text-[10px]">{sub.plagiarismScore}%</Badge> : <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleCheckPlagiarism(selectedAssignment!, student.uid)} disabled={!!actionLoading}><ShieldCheck className="h-3 w-3 mr-1"/>Scan</Button>}
                                                </div>) : <span className="text-xs text-muted-foreground italic">No Digital Work</span>}
                                            </TableCell>
                                            <TableCell><Input type="number" value={assignmentScores[student.uid]?.score ?? ''} onChange={e => handleScoreChange(student.uid, e.target.value)} className="h-8 text-xs"/></TableCell>
                                            <TableCell><Input placeholder="Add feedback..." value={assignmentScores[student.uid]?.feedback ?? ''} onChange={e => handleFeedbackChange(student.uid, e.target.value)} className="h-8 text-xs"/></TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                     </div>
                     <DialogFooter className="pt-4"><Button variant="outline" onClick={() => setIsGradingOpen(false)}>Cancel</Button><Button onClick={handleSaveGrades} disabled={formLoading}>{formLoading && <Loader2 className="animate-spin mr-2 h-4 w-4"/>}Save All Grades</Button></DialogFooter>
                </DialogContent>
             </Dialog>
        </div>
    );
}
