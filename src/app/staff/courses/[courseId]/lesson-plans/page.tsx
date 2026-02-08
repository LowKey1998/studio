
'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Route } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, get, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

type LessonPlanItem = { id: string; title: string; description: string; week: number; };

export default function LessonPlansPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [lessonPlan, setLessonPlan] = React.useState<LessonPlanItem[]>([]);
    const [courseData, setCourseData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const { user, userProfile } = useAuth();

    const [isPathDialogOpen, setIsPathDialogOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [pathWeek, setPathWeek] = React.useState<number>(1);
    
    const { toast } = useToast();

    const fetchData = React.useCallback(async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const [pathSnap, courseSnap] = await Promise.all([
                get(ref(db, `lessonPlans/${courseId}`)),
                get(ref(db, `courses/${courseId}`))
            ]);
            
            if (courseSnap.exists()) {
                setCourseData(courseSnap.val());
            }
            
            const pathItems = pathSnap.exists() ? Object.entries(pathSnap.val()).map(([id, data]) => ({ id, ...(data as any) })) : [];
            setLessonPlan(pathItems);
            setPathWeek(pathItems.length + 1);
        } catch (error) { 
            console.error("Error fetching lesson plan:", error); 
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
        setPathWeek(lessonPlan.length + 1);
    };
    
    const handleAddPathItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !pathWeek) { 
            toast({ variant: 'destructive', title: 'Missing Fields' }); 
            return; 
        }
        setFormLoading(true);
        try {
            const newRef = push(ref(db, `lessonPlans/${courseId}`));
            await set(newRef, { title, description, week: pathWeek });
            toast({ title: 'Lesson Plan Module Added' });
            fetchData(); 
            resetForms(); 
            setIsPathDialogOpen(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Failed to add', description: error.message }); 
        } finally { 
            setFormLoading(false); 
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            await remove(ref(db, `lessonPlans/${courseId}/${id}`));
            toast({ title: "Item deleted successfully." });
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

    if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <CardTitle>Lesson Plan</CardTitle>
                    <CardDescription>Structure the course content and activities by week.</CardDescription>
                </div>
                 {isAuthorized && (
                    <Dialog open={isPathDialogOpen} onOpenChange={(o) => { setIsPathDialogOpen(o); if(!o) resetForms(); }}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add Module</Button></DialogTrigger>
                        <DialogContent><form onSubmit={handleAddPathItem}>
                            <DialogHeader><DialogTitle>New Lesson Module</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <Label>Title</Label>
                                    <Input placeholder="Module Title" value={title} onChange={e => setTitle(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                    <Label>Week Number</Label>
                                    <Input type="number" placeholder="Week Number" value={pathWeek} onChange={e => setPathWeek(Number(e.target.value))} required />
                                </div>
                                <div className="space-y-1">
                                    <Label>Description</Label>
                                    <Textarea placeholder="Topics, activities, readings..." value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={formLoading}>
                                    {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Add Module'}
                                </Button>
                            </DialogFooter>
                        </form></DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
               {lessonPlan.length > 0 ? [...lessonPlan].sort((a,b) => a.week - b.week).map(p => (
                   <Card key={p.id} className="mb-4">
                       <CardHeader className="flex flex-row items-center justify-between">
                           <CardTitle className="text-lg">Week {p.week}: {p.title}</CardTitle>
                           {isAuthorized && (
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                           )}
                       </CardHeader>
                       {p.description && (
                           <CardContent>
                               <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.description}</p>
                           </CardContent>
                       )}
                   </Card>
               )) : (
                    <Alert>
                        <Route className="h-4 w-4" />
                        <AlertTitle>No Lesson Plan Defined</AlertTitle>
                        <AlertDescription>The lesson plan has not been set up for this course yet.</AlertDescription>
                    </Alert>
               )}
            </CardContent>
        </Card>
    );
}
