'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ResearchProject = {
    id: string;
    title: string;
    leadResearcherId: string;
    leadResearcherName: string;
    department: string;
    status: 'Active' | 'Completed' | 'Archived';
    registrationDate: string;
};

type User = {
    uid: string;
    name: string;
}

export default function ResearchRegistrationPage() {
    const [projects, setProjects] = React.useState<ResearchProject[]>([]);
    const [users, setUsers] = React.useState<User[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [leadResearcherId, setLeadResearcherId] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'researchProjects');
        const usersRef = ref(db, 'users');

        const unsubProjects = onValue(projectsRef, (snapshot) => {
            setProjects(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });

        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                setUsers(Object.keys(usersData).map(uid => ({ uid, name: usersData[uid].name })));
            }
        });

        return () => {
            unsubProjects();
            unsubUsers();
        };
    }, []);
    
    const resetForm = () => {
        setTitle('');
        setDepartment('');
        setLeadResearcherId('');
    };

    const handleSaveProject = async () => {
        if (!title || !department || !leadResearcherId) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const leadResearcherName = users.find(u => u.uid === leadResearcherId)?.name;
            await push(ref(db, 'researchProjects'), {
                title,
                department,
                leadResearcherId,
                leadResearcherName,
                status: 'Active',
                registrationDate: new Date().toISOString()
            });
            toast({ title: 'Research Project Registered' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save project', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this project?")) return;
        await remove(ref(db, `researchProjects/${id}`));
        toast({ title: 'Project deleted' });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Research Project Registration</CardTitle>
                    <CardDescription>Register new research projects undertaken by students or staff.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Register Project</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Register New Research Project</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Project Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Department</Label><Input value={department} onChange={e => setDepartment(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Lead Researcher</Label>
                                <Select value={leadResearcherId} onValueChange={setLeadResearcherId}>
                                    <SelectTrigger><SelectValue placeholder="Select a student or staff member..."/></SelectTrigger>
                                    <SelectContent>{users.map(user => <SelectItem key={user.uid} value={user.uid}>{user.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveProject} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Project</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Lead Researcher</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Date Registered</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.map(project => (
                            <TableRow key={project.id}>
                                <TableCell>{project.title}</TableCell>
                                <TableCell>{project.leadResearcherName}</TableCell>
                                <TableCell>{project.department}</TableCell>
                                <TableCell>{format(new Date(project.registrationDate), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {projects.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">No projects registered yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
