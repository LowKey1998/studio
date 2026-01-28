'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type ResearchProject = {
    id: string;
    title: string;
    leadResearcherName: string;
    budget?: number;
    spent?: number;
};

export default function BudgetTrackingPage() {
    const [projects, setProjects] = React.useState<ResearchProject[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingProject, setEditingProject] = React.useState<ResearchProject | null>(null);
    const [newBudget, setNewBudget] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'researchProjects');
        const unsubscribe = onValue(projectsRef, (snapshot) => {
            setProjects(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id], budget: snapshot.val()[id].budget || 0, spent: snapshot.val()[id].spent || 0 })) : []);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleOpenDialog = (project: ResearchProject) => {
        setEditingProject(project);
        setNewBudget(String(project.budget || ''));
        setIsDialogOpen(true);
    };
    
    const handleSaveBudget = async () => {
        if (!editingProject) return;
        try {
            await update(ref(db, `researchProjects/${editingProject.id}`), { budget: parseFloat(newBudget) });
            toast({ title: 'Budget Updated' });
            setIsDialogOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Research Budget Tracking</CardTitle>
                <CardDescription>Monitor budgets and spending for research projects.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Researcher</TableHead>
                            <TableHead className="w-[250px]">Budget Usage</TableHead>
                            <TableHead className="text-right">Budget (ZMW)</TableHead>
                            <TableHead className="text-right">Spent (ZMW)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-24"/></TableCell></TableRow> :
                         projects.map(p => {
                             const usage = p.budget && p.budget > 0 ? (p.spent! / p.budget!) * 100 : 0;
                             return (
                                <TableRow key={p.id}>
                                    <TableCell>{p.title}</TableCell>
                                    <TableCell>{p.leadResearcherName}</TableCell>
                                    <TableCell><Progress value={usage} /></TableCell>
                                    <TableCell className="text-right">{p.budget?.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{p.spent?.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(p)}><Pencil className="h-4 w-4"/></Button>
                                    </TableCell>
                                </TableRow>
                             )
                         })}
                    </TableBody>
                </Table>
            </CardContent>
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Set Budget for {editingProject?.title}</DialogTitle></DialogHeader>
                    <div className="py-4"><Label>Budget Amount (ZMW)</Label><Input type="number" value={newBudget} onChange={e => setNewBudget(e.target.value)} /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveBudget}>Set Budget</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
