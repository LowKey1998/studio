
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type Payable = {
    id: string;
    vendor: string;
    dueDate: string;
    amount: number;
    status: 'Paid' | 'Unpaid';
};

export default function PayablesPage() {
    const [payables, setPayables] = React.useState<Payable[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [vendor, setVendor] = React.useState('');
    const [dueDate, setDueDate] = React.useState('');
    const [amount, setAmount] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const payablesRef = ref(db, 'payables');
        const unsub = onValue(payablesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setPayables(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
            } else {
                setPayables([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setVendor(''); setDueDate(''); setAmount('');
    };

    const handleSavePayable = async () => {
        if (!vendor || !dueDate || !amount) {
            toast({ variant: 'destructive', title: 'Missing fields' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'payables'), {
                vendor, dueDate, amount: parseFloat(amount), status: 'Unpaid'
            });
            toast({ title: 'Payable Added' });
            setIsDialogOpen(false); resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add payable' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (payable: Payable) => {
        const newStatus = payable.status === 'Paid' ? 'Unpaid' : 'Paid';
        await set(ref(db, `payables/${payable.id}/status`), newStatus);
        toast({ title: `Marked as ${newStatus}` });
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `payables/${id}`));
        toast({ title: 'Payable deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Accounts Payables</CardTitle>
                    <CardDescription>Track and manage all money owed by the institution to its suppliers.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Add Payable</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Payable</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Vendor/Supplier</Label><Input value={vendor} onChange={e => setVendor(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSavePayable} disabled={saving}>{saving && <Loader2 className="mr-2 h-4"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount (ZMW)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         payables.map(item => {
                            const isOverdue = item.status === 'Unpaid' && isBefore(new Date(item.dueDate), new Date());
                            return (
                            <TableRow key={item.id}>
                                <TableCell>{item.vendor}</TableCell>
                                <TableCell>{format(new Date(item.dueDate), 'PPP')}</TableCell>
                                <TableCell><Badge variant={item.status === 'Paid' ? 'default' : (isOverdue ? 'destructive' : 'secondary')}>{isOverdue ? 'Overdue' : item.status}</Badge></TableCell>
                                <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" variant="outline" onClick={() => handleToggleStatus(item)}>{item.status === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}</Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                         )})}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
