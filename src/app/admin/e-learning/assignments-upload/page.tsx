
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, PlusCircle, Trash2, CalendarIcon, Eye } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Course = { id: string; name: string; code: string; };
type Assignment = { id: string; title: string; description: string; dueDate: string; submissions?: Record<string, Submission> };
type Submission = { studentId: string; studentName: string; submissionUrl: string; submittedAt: string; };

export default function AssignmentsUploadPage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [assignments, setAssignments] = React.useState<Assignment[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [dueDate, setDueDate] = React.useState<Date>();
    
    const [isSubmissionsOpen, setIsSubmissionsOpen] = React.useState(false);
    const [viewingSubmissions, setViewingSubmissions] = React.useState<Submission[]>([]);

    const { toast } = useToast();

    React.useEffect(() => {
        const coursesRef = ref(db, 'courses');
        const unsub = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setCourses(Object.keys(data).map(id => ({ id, ...data[id] })));
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    React.useEffect(() => {
        if (!selectedCourse) {
            setAssignments([]);
            return;
        }
        const assignmentsRef = ref(db, `assignments/${selectedCourse}`);
        const unsub = onValue(assignmentsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setAssignments(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setAssignments([]);
            }
        });
        return () => unsub();
    }, [selectedCourse]);

    const handleCreateAssignment = async () => {
        if (!selectedCourse || !title || !description || !dueDate) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setSaving(true);
        try {
            const newAssignmentRef = push(ref(db, `assignments/${selectedCourse}`));
            await set(newAssignmentRef, { title, description, dueDate: format(dueDate, 'yyyy-MM-dd'), status: 'Pending' });
            toast({ title: 'Assignment Created' });
            setTitle('');
            setDescription('');
            setDueDate(undefined);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to create assignment', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (assignmentId: string) => {
        if(!window.confirm("Are you sure? This will delete the assignment and all student submissions.")) return;
        await remove(ref(db, `assignments/${selectedCourse}/${assignmentId}`));
        toast({title: "Assignment deleted"});
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Assignments Upload & Management</CardTitle>
                <CardDescription>Create assignment dropboxes and manage student submissions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                        <SelectTrigger><SelectValue placeholder="Select a course..." /></SelectTrigger>
                        <SelectContent>
                            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {selectedCourse && (
                    <Card>
                        <CardHeader>
                            <CardTitle>New Assignment</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
                             <div className="space-y-1"><Label>Description / Instructions</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                             <div className="space-y-1"><Label>Due Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4"/>{dueDate ? format(dueDate, 'PPP') : "Select due date"}</Button></PopoverTrigger>
                                    <PopoverContent><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus/></PopoverContent>
                                </Popover>
                             </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleCreateAssignment} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />} Create Assignment
                            </Button>
                        </CardFooter>
                    </Card>
                )}
                 {selectedCourse && (
                    <div className="p-4 border rounded-lg space-y-4">
                         <h3 className="font-semibold">Existing Assignments</h3>
                         <div className="space-y-2">
                            {assignments.map(a => (
                                <div key={a.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div>
                                        <p className="font-medium">{a.title}</p>
                                        <p className="text-sm text-muted-foreground">Due: {format(new Date(a.dueDate), 'PPP')}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => { setViewingSubmissions(Object.values(a.submissions || {})); setIsSubmissionsOpen(true); }} >
                                            <Eye className="mr-2 h-4 w-4" /> View Submissions ({Object.keys(a.submissions || {}).length})
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                </div>
                            ))}
                            {assignments.length === 0 && <p className="text-sm text-muted-foreground">No assignments found for this course.</p>}
                         </div>
                    </div>
                )}
            </CardContent>

             <Dialog open={isSubmissionsOpen} onOpenChange={setIsSubmissionsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Submissions</DialogTitle>
                    </DialogHeader>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Submitted At</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {viewingSubmissions.length > 0 ? viewingSubmissions.map(sub => (
                                <TableRow key={sub.studentId}>
                                    <TableCell>{sub.studentName}</TableCell>
                                    <TableCell>{format(new Date(sub.submittedAt), 'PPP p')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="secondary" size="sm">
                                            <a href={sub.submissionUrl} target="_blank" rel="noopener noreferrer">View Document</a>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No submissions yet.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </DialogContent>
             </Dialog>
        </Card>
    );
}
