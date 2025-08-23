
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Briefcase, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Agent = {
    id: string;
    name: string;
    company: string;
    email: string;
};

export default function AgentManagementPage() {
    const [agents, setAgents] = React.useState<Agent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [company, setCompany] = React.useState('');
    const [email, setEmail] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const agentsRef = ref(db, 'admissions/agents');
        const unsub = onValue(agentsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setAgents(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setName('');
        setCompany('');
        setEmail('');
    };

    const handleSaveAgent = async () => {
        if (!name || !email) {
            toast({ variant: 'destructive', title: 'Name and email are required.' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'admissions/agents'), { name, company, email });
            toast({ title: "Agent Added" });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add agent.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAgent = async (id: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(ref(db, `admissions/agents/${id}`));
        toast({ title: "Agent removed" });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>Agent Management</CardTitle>
                    <CardDescription>Manage third-party admissions agents and track their performance.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4"/>Add Agent</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New Agent</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                           <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} required/></div>
                           <div className="space-y-1"><Label>Company (Optional)</Label><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
                           <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveAgent} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Agent</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                        : agents.length > 0 ? agents.map(agent => (
                            <TableRow key={agent.id}>
                                <TableCell>{agent.name}</TableCell>
                                <TableCell>{agent.company}</TableCell>
                                <TableCell>{agent.email}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAgent(agent.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">No agents added yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
