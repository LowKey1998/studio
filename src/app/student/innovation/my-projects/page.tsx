
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Lightbulb, PlusCircle, Loader2 } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, serverTimestamp, query, orderByChild, equalTo } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

type Project = {
    id: string;
    title: string;
    description: string;
    status: 'Pending Review' | 'Approved' | 'Rejected';
    submittedById: string;
    submittedByName: string;
};

export default function MyProjectsPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<{ name: string } | null>(null);

    // Form state
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, snapshot => setUserData(snapshot.val()));

                const projectsQuery = query(ref(db, 'innovationProjects'), orderByChild('submittedById'), equalTo(user.uid));
                onValue(projectsQuery, (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        setProjects(Object.keys(data).map(id => ({ id, ...data[id] })));
                    } else {
                        setProjects([]);
                    }
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setTitle('');
        setDescription('');
    };

    const handleSubmitProject = async () => {
        if (!title.trim() || !currentUser || !userData) {
            toast({ variant: 'destructive', title: 'Title is required' });
            return;
        }
        setFormLoading(true);
        try {
            const newProjectRef = push(ref(db, 'innovationProjects'));
            await set(newProjectRef, {
                title,
                description,
                status: 'Pending Review',
                submittedById: currentUser.uid,
                submittedByName: userData.name,
                submittedAt: serverTimestamp(),
            });
            toast({ title: 'Project Submitted!', description: 'Your project is now awaiting review.' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline text-2xl">My Innovation Projects</CardTitle>
                    <CardDescription>Track the status of your submitted innovation projects.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Submit New Project</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Submit New Project</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1"><Label htmlFor="proj-title">Project Title</Label><Input id="proj-title" value={title} onChange={e => setTitle(e.target.value)} /></div>
                            <div className="space-y-1"><Label htmlFor="proj-desc">Project Description</Label><Textarea id="proj-desc" value={description} onChange={e => setDescription(e.target.value)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSubmitProject} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4"/>}Submit</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-48" /> : projects.length > 0 ? (
                     <div className="space-y-4">
                        {projects.map(project => (
                            <Card key={project.id}>
                                <CardHeader className="flex-row justify-between items-center">
                                    <CardTitle className="text-lg">{project.title}</CardTitle>
                                    <Badge variant={project.status === 'Approved' ? 'default' : 'secondary'}>{project.status}</Badge>
                                </CardHeader>
                                {project.description && <CardContent><p className="text-sm text-muted-foreground">{project.description}</p></CardContent>}
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 text-muted-foreground">
                        <Lightbulb className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Projects Yet</h3>
                        <p className="mt-2 text-sm">You haven't submitted any innovation projects.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
