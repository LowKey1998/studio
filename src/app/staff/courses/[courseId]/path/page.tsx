
'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Route } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, get, set, push, remove, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type CoursePathItem = { id: string; title: string; description: string; week: number; };
type UserData = { role: 'Student' | 'Staff'; subRoles?: string[]; };

export default function CoursePathPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [coursePath, setCoursePath] = React.useState<CoursePathItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    const [isPathDialogOpen, setIsPathDialogOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [pathWeek, setPathWeek] = React.useState<number>(1);
    
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
            const pathRef = ref(db, `coursePaths/${courseId}`);
            const pathSnapshot = await get(pathRef);
            const pathItems = pathSnapshot.exists() ? Object.entries(pathSnapshot.val()).map(([id, data]) => ({ id, ...(data as any) })) : [];
            setCoursePath(pathItems);
            setPathWeek(pathItems.length + 1);
        } catch (error) { console.error("Error fetching course path:", error); } 
        finally { setLoading(false); }
    }, [courseId]);

    React.useEffect(() => {
        if(currentUser) fetchData();
    }, [currentUser, fetchData]);
    
    const resetForms = () => {
        setTitle(''); setDescription(''); setPathWeek(coursePath.length + 1);
    };
    
    const handleAddPathItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !pathWeek) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        setFormLoading(true);
        try {
            const newRef = push(ref(db, `coursePaths/${courseId}`));
            await set(newRef, { title, description, week: pathWeek });
            toast({ title: 'Course Path Item Added' });
            fetchData(); resetForms(); setIsPathDialogOpen(false);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to add', description: error.message }); }
        finally { setFormLoading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            await remove(ref(db, `coursePaths/${courseId}/${id}`));
            toast({ title: "Item deleted successfully." });
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
                    <CardTitle>Course Path</CardTitle>
                    <CardDescription>Structure the course syllabus by week.</CardDescription>
                </div>
                 {isLecturer && (
                    <Dialog open={isPathDialogOpen} onOpenChange={(o) => { setIsPathDialogOpen(o); if(!o) resetForms(); }}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Module</Button></DialogTrigger>
                        <DialogContent><form onSubmit={handleAddPathItem}>
                            <DialogHeader><DialogTitle>New Course Module</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required />
                                <Input type="number" placeholder="Week Number" value={pathWeek} onChange={e => setPathWeek(Number(e.target.value))} required />
                                <Textarea placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add'}</Button></DialogFooter>
                        </form></DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
               {coursePath.length > 0 ? [...coursePath].sort((a,b) => a.week - b.week).map(p => (
                   <Card key={p.id} className="mb-4">
                       <CardHeader>
                           <CardTitle>Week {p.week}: {p.title}</CardTitle>
                       </CardHeader>
                       {p.description && <CardContent><p className="whitespace-pre-wrap text-muted-foreground">{p.description}</p></CardContent>}
                       <CardFooter className="justify-end">
                           <Button variant="destructive" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4"/></Button>
                       </CardFooter>
                   </Card>
               )) : <Alert><Route className="h-4 w-4" /><AlertTitle>No Course Path Defined</AlertTitle><AlertDescription>The syllabus has not been set up for this course yet.</AlertDescription></Alert>}
            </CardContent>
        </Card>
    );
}
