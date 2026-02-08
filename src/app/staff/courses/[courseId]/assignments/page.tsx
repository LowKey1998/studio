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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

type Assignment = { id: string; title: string; description: string; dueDate: string; submissions?: Record<string, Submission> };
type Submission = { studentId: string; studentName: string; submissionUrl: string; submittedAt: string; };

export default function CourseAssignmentsPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [assignments, setAssignments] = React.useState<Assignment[]>([]);
    const [courseData, setCourseData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const { user, userProfile } = useAuth();

    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = React.useState(false);
    const [isSubmissionsOpen, setIsSubmissionsOpen] = React.useState(false);
    const [viewingSubmissions, setViewingSubmissions] = React.useState<Submission[]>([]);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [dueDate, setDueDate] = React.useState<Date | undefined>();
    
    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const [assignmentsSnap, courseSnap] = await Promise.all([
                get(ref(db, `assignments/${courseId}`)),
                get(ref(db, `courses/${courseId}`))
            ]);
            
            if (courseSnap.exists()) {
                setCourseData(courseSnap.val());
            }
            
            setAssignments(assignmentsSnap.exists() ? Object.entries(assignmentsSnap.val()).map(([id, data]) => ({ id, ...(data as any) })) : []);
        } catch (error) { 
            console.error("Error fetching assignments:", error); 
        } finally { 
            setLoading(false); 
        }
    }, [courseId]);

    React.useEffect(() => {
        if(user) fetchData();
    }, [user, fetchData]);
    
    const resetForms = () => {
        setTitle(''); 
        setDescription(''); 
        setDueDate(undefined);
    };
    
    const handleAddAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description || !dueDate) { 
            toast({ variant: 'destructive', title: 'Missing Fields' }); 
            return; 
        }
        setFormLoading(true);
        try {
            const newRef = push(ref(db, `assignments/${courseId}`));
            await set(newRef, { title, description, dueDate: format(dueDate, 'yyyy-MM-dd') });
            toast({ title: 'Assignment Added' });
            fetchData(); 
            resetForms(); 
            setIsAssignmentDialogOpen(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to add', description: error.message }); 
        } finally { 
            setFormLoading(false); 
        }
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
    
    const isAuthorized = React.useMemo(() => {
        if (!user || !courseData) return false;
        if (userProfile?.role === 'Admin') return true;
        const assignedLecturers = courseData.lecturerIds || [];
        return Array.isArray(assignedLecturers) && assignedLecturers.includes(user.uid);
    }, [user, userProfile, courseData]);

    if (loading) return <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <CardTitle>Assignments</CardTitle>
                    <CardDescription>Create and manage assignments for this course.</CardDescription>
                </div>
                 {isAuthorized && (
                    <Dialog open={isAssignmentDialogOpen} onOpenChange={(o) => { setIsAssignmentDialogOpen(o); if(!o) resetForms(); }}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Assignment</Button></DialogTrigger>
                        <DialogContent><form onSubmit={handleAddAssignment}>
                            <DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <Label>Title</Label>
                                    <Input placeholder="Assignment Title" value={title} onChange={e => setTitle(e.target.value)} required/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Instructions</Label>
                                    <Textarea placeholder="Describe the assignment and requirements..." value={description} onChange={e => setDescription(e.target.value)} required/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Due Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dueDate ? format(dueDate, 'PPP') : "Select Due Date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={formLoading}>
                                    {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add Assignment'}
                                </Button>
                            </DialogFooter>
                        </form></DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
               {assignments.length > 0 ? assignments.sort((a,b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map(a => (
                   <Card key={a.id} className="mb-4">
                       <CardHeader>
                           <CardTitle className="text-lg">{a.title}</CardTitle>
                           <CardDescription>Due: {format(new Date(a.dueDate), 'PPP')}</CardDescription>
                       </CardHeader>
                       <CardContent><p className="whitespace-pre-wrap text-sm">{a.description}</p></CardContent>
                       <CardFooter className="justify-between">
                            <Button variant="outline" size="sm" onClick={() => { setViewingSubmissions(Object.values(a.submissions || {})); setIsSubmissionsOpen(true); }} >
                                <Eye className="mr-2 h-4 w-4" /> View Submissions ({Object.keys(a.submissions || {}).length})
                            </Button>
                            {isAuthorized && (
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(a.id)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            )}
                       </CardFooter>
                    </Card>
               )) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <p>No assignments created yet.</p>
                    </div>
               )}
            </CardContent>

             <Dialog open={isSubmissionsOpen} onOpenChange={setIsSubmissionsOpen}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Student Submissions</DialogTitle>
                    </DialogHeader>
                     <div className="flex-1 overflow-auto mt-4">
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
                                                <a href={sub.submissionUrl} target="_blank" rel="noopener noreferrer">View Submission</a>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No submissions yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                     </div>
                </DialogContent>
             </Dialog>
        </Card>
    );
}