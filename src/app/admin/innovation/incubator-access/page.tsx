
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, KeyRound, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, set, get, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type Project = {
    id: string;
    title: string;
    submittedByName: string;
    incubatorStatus?: 'Pending' | 'Active' | 'Graduated' | 'Rejected';
};

export default function IncubatorAccessPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedProjectId, setSelectedProjectId] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            const approvedProjects: Project[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const id in data) {
                    if (data[id].status === 'Approved') {
                        approvedProjects.push({ id, ...data[id], incubatorStatus: data[id].incubatorStatus || 'Pending' });
                    }
                }
            }
            setProjects(approvedProjects);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleGrantAccess = async () => {
        if (!selectedProjectId) return;
        setSaving(true);
        try {
            await update(ref(db, `innovationProjects/${selectedProjectId}`), { incubatorStatus: 'Active' });
            toast({ title: 'Access Granted' });
            setIsDialogOpen(false);
            setSelectedProjectId('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to grant access' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleStatusChange = async (projectId: string, status: Project['incubatorStatus']) => {
        await update(ref(db, `innovationProjects/${projectId}`), { incubatorStatus: status });
        toast({title: 'Incubator status updated.'});
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Innovation Incubator Access</CardTitle>
                    <CardDescription>Manage student and project access to the incubator program.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4"/> Grant Access</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Grant Incubator Access</DialogTitle></DialogHeader>
                        <div className="py-4">
                            <Label>Select Project</Label>
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                <SelectTrigger><SelectValue placeholder="Select an approved project..." /></SelectTrigger>
                                <SelectContent>
                                    {projects.filter(p => p.incubatorStatus === 'Pending' || p.incubatorStatus === 'Rejected').map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleGrantAccess} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Grant Access</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.filter(p => p.incubatorStatus !== 'Pending' && p.incubatorStatus !== 'Rejected').map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.title}</TableCell>
                                <TableCell>{item.submittedByName}</TableCell>
                                <TableCell>
                                    <Select value={item.incubatorStatus} onValueChange={(val) => handleStatusChange(item.id, val as any)}>
                                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Graduated">Graduated</SelectItem>
                                            <SelectItem value="Rejected">Rejected</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
