
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Project = {
    id: string;
    title: string;
    submittedByName: string;
    matchedInvestorId?: string;
};

type Investor = {
    id: string;
    name: string;
    contact: string;
};


export default function InvestorMatchingPage() {
    const [projects, setProjects] = React.useState<Project[]>([]);
    const [investors, setInvestors] = React.useState<Investor[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [investorName, setInvestorName] = React.useState('');
    const [investorContact, setInvestorContact] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const projectsRef = ref(db, 'innovationProjects');
        const unsubProjects = onValue(projectsRef, (snapshot) => {
             const approvedProjects: Project[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                for (const id in data) {
                    if (data[id].status === 'Approved') {
                        approvedProjects.push({ id, ...data[id] });
                    }
                }
            }
            setProjects(approvedProjects);
             setLoading(false);
        });

        const investorsRef = ref(db, 'investors');
        const unsubInvestors = onValue(investorsRef, (snapshot) => {
            setInvestors(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });

        return () => {
            unsubProjects();
            unsubInvestors();
        };
    }, []);

    const handleAssignInvestor = async (projectId: string, investorId: string) => {
        await update(ref(db, `innovationProjects/${projectId}`), { matchedInvestorId: investorId });
        toast({ title: 'Investor Matched' });
    };

    const handleAddInvestor = async () => {
        if (!investorName) return;
        setSaving(true);
        try {
            await push(ref(db, 'investors'), { name: investorName, contact: investorContact });
            toast({ title: 'Investor Added' });
            setIsDialogOpen(false);
            setInvestorName('');
            setInvestorContact('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add investor' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Investor Matching Tools</CardTitle>
                    <CardDescription>Connect promising student projects with potential investors.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Add Investor</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Investor</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Investor/Firm Name</Label><Input value={investorName} onChange={e => setInvestorName(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Contact (Email/Phone)</Label><Input value={investorContact} onChange={e => setInvestorContact(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleAddInvestor} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                 </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project / Startup</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Match with Investor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow> :
                        projects.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.title}</TableCell>
                                <TableCell>{p.submittedByName}</TableCell>
                                <TableCell>
                                    <Select value={p.matchedInvestorId} onValueChange={(val) => handleAssignInvestor(p.id, val)}>
                                        <SelectTrigger className="w-[280px]"><SelectValue placeholder="Match an investor..."/></SelectTrigger>
                                        <SelectContent>
                                            {investors.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
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
