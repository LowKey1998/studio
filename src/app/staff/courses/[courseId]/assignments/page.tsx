
'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, CalendarIcon, Trash2, Eye } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, get, set, push, remove, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Assignment = { id: string; title: string; description: string; dueDate: string; submissions?: Record<string, Submission> };
type Submission = { studentId: string; studentName: string; submissionUrl: string; submittedAt: string; };
type UserData = { role: 'Student' | 'Staff'; subRoles?: string[]; };

export default function CourseAssignmentsPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [assignments, setAssignments] = React.useState<Assignment[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = React.useState(false);
    const [isSubmissionsOpen, setIsSubmissionsOpen] = React.useState(false);
    const [viewingSubmissions, setViewingSubmissions] = React.useState<Submission[]>([]);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [dueDate, setDueDate] = React.useState<Date | undefined>();
    
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) setUserData(snapshot.val());
            });
          }
        });
        return () => unsubscribe();
    }, []);
    
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const assignmentsRef = ref(db, `assignments/${courseId}`);
            const assignmentsSnapshot = await get(assignmentsRef);
            setAssignments(assignmentsSnapshot.exists() ? Object.entries(assignmentsSnapshot.val()).map(([id, data]) => ({ id, ...(data as any) })) : []);
        } catch (error) { console.error("Error fetching assignments:", error); } 
        finally { setLoading(false); }
    }, [courseId]);

    React.useEffect(() => {
        if(currentUser) fetchData();
    }, [currentUser, fetchData]);
    
    const resetForms = () => {
        setTitle(''); setDescription(''); setDueDate(undefined);
    };
    
    const handleAddAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description || !dueDate) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        setFormLoading(true);
        try {
            const newRef = push(ref(db, `assignments/${courseId}`));
            await set(newRef, { title, description, dueDate: format(dueDate, 'yyyy-MM-dd') });
            toast({ title: 'Assignment Added' });
            fetchData(); resetForms(); setIsAssignmentDialogOpen(false);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to add', description: error.message }); } 
        finally { setFormLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this assignment?")) return;
        try {
            await remove(ref(db, `assignments/${courseId}/${id}`));
            toast({ title: "Assignment deleted successfully." });
            fetchData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        }
    };
    
    const isLecturer = userData?.role === 'Staff' && userData?.subRoles?.includes('Lecturer');

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Assignments</CardTitle>
                    <CardDescription>Create and manage assignments for this course.</CardDescription>
                </div>
                 {isLecturer && (
                    <Dialog open={isAssignmentDialogOpen} onOpenChange={(o) => { setIsAssignmentDialogOpen(o); if(!o) resetForms(); }}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Assignment</Button></DialogTrigger>
                        <DialogContent><form onSubmit={handleAddAssignment}>
                            <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required/>
                                <Textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required/>
                                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, 'PPP') : "Select Due Date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent></Popover>
                            </div>
                            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add'}</Button></DialogFooter>
                        </form></DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
               {assignments.length > 0 ? assignments.sort((a,b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map(a => (
                   <Card key={a.id} className="mb-4">
                       <CardHeader>
                           <CardTitle>{a.title}</CardTitle>
                           <CardDescription>Due: {format(new Date(a.dueDate), 'PPP')}</CardDescription>
                       </CardHeader>
                       <CardContent><p className="whitespace-pre-wrap">{a.description}</p></CardContent>
                       <CardFooter className="justify-between">
                            <Button variant="outline" onClick={() => { setViewingSubmissions(Object.values(a.submissions || {})); setIsSubmissionsOpen(true); }} >
                                <Eye className="mr-2 h-4 w-4" /> View Submissions ({Object.keys(a.submissions || {}).length})
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4"/></Button>
                       </CardFooter>
                    </Card>
               )) : <p className="text-muted-foreground text-center py-8">No assignments created yet.</p>}
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

