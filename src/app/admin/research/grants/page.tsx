'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type GrantApplication = {
    id: string;
    title: string;
    fundingBody: string;
    submissionDate: string;
    amount: number;
    status: 'Draft' | 'Submitted' | 'Awarded' | 'Rejected';
};

const statusOptions: GrantApplication['status'][] = ['Draft', 'Submitted', 'Awarded', 'Rejected'];

export default function GrantApplicationsPage() {
    const [grants, setGrants] = React.useState<GrantApplication[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [fundingBody, setFundingBody] = React.useState('');
    const [submissionDate, setSubmissionDate] = React.useState('');
    const [amount, setAmount] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const grantsRef = ref(db, 'grantApplications');
        const unsub = onValue(grantsRef, (snapshot) => {
            setGrants(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setTitle(''); setFundingBody(''); setSubmissionDate(''); setAmount('');
    };

    const handleSaveGrant = async () => {
        if (!title || !fundingBody || !submissionDate || !amount) return;
        setSaving(true);
        try {
            await push(ref(db, 'grantApplications'), {
                title,
                fundingBody,
                submissionDate,
                amount: parseFloat(amount),
                status: 'Draft'
            });
            toast({ title: "Grant Application Logged" });
            setIsDialogOpen(false);
            resetForm();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to log grant' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleStatusChange = async (id: string, status: GrantApplication['status']) => {
        await update(ref(db, `grantApplications/${id}`), { status });
        toast({ title: 'Status updated' });
    }

    const handleDelete = async (id: string) => {
        await remove(ref(db, `grantApplications/${id}`));
        toast({ title: 'Grant record deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Grant Applications Management</CardTitle>
                    <CardDescription>Track grant applications and their statuses.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Grant Application</Button></DialogTrigger>
                     <DialogContent>
                        <DialogHeader><DialogTitle>Log New Grant Application</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Grant Title</Label><Input value={title} onChange={e=>setTitle(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Funding Body</Label><Input value={fundingBody} onChange={e=>setFundingBody(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Submission Date</Label><Input type="date" value={submissionDate} onChange={e=>setSubmissionDate(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveGrant} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                     </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Grant Title</TableHead>
                            <TableHead>Funder</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-24"/></TableCell></TableRow> :
                         grants.map(grant => (
                            <TableRow key={grant.id}>
                                <TableCell>{grant.title}</TableCell>
                                <TableCell>{grant.fundingBody}</TableCell>
                                <TableCell>{format(new Date(grant.submissionDate), 'PPP')}</TableCell>
                                <TableCell>ZMW {grant.amount.toFixed(2)}</TableCell>
                                <TableCell>
                                     <Select value={grant.status} onValueChange={(value) => handleStatusChange(grant.id, value as any)}>
                                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(grant.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
