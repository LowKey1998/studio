
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Home, PlusCircle, Trash2, Loader2, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type HostelFee = { id: string; name: string; amount: number; };

export default function HostelFeesPage() {
    const [fees, setFees] = React.useState<HostelFee[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Form state
    const [name, setName] = React.useState('');
    const [amount, setAmount] = React.useState('');

    React.useEffect(() => {
        const feeRef = ref(db, 'settings/fees/hostels');
        const unsub = onValue(feeRef, (snap) => {
            setFees(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!name || !amount) return;
        setSaving(true);
        try {
            await push(ref(db, 'settings/fees/hostels'), { name, amount: parseFloat(amount) });
            toast({ title: 'Fee added' });
            setName(''); setAmount('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `settings/fees/hostels/${id}`));
        toast({ title: 'Fee removed' });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Home className="h-6 w-6"/> Hostel Fee Management</CardTitle>
                <CardDescription>Configure standard fees for different student accommodation options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4 items-end p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-1"><Label>Hostel Name / Category</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Block A Shared"/></div>
                    <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)}/></div>
                    <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : <><PlusCircle className="mr-2 h-4 w-4"/> Add Fee</>}</Button>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Accommodation Category</TableHead>
                            <TableHead className="text-right">Amount (ZMW)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24 w-full"/></TableCell></TableRow> :
                         fees.map(f => (
                            <TableRow key={f.id}>
                                <TableCell className="font-bold">{f.name}</TableCell>
                                <TableCell className="text-right font-mono">{f.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
