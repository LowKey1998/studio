
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type Donation = {
    id: string;
    donor: string;
    date: string;
    amount: number;
};

export default function DonorFundTrackingPage() {
    const [donations, setDonations] = React.useState<Donation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [donorName, setDonorName] = React.useState('');
    const [donationDate, setDonationDate] = React.useState('');
    const [donationAmount, setDonationAmount] = React.useState('');

    const { toast } = useToast();
    
    React.useEffect(() => {
        const donationsRef = ref(db, 'donations');
        const unsub = onValue(donationsRef, (snapshot) => {
            setDonations(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setDonorName(''); setDonationDate(''); setDonationAmount('');
    };

    const handleSaveDonation = async () => {
        if (!donorName || !donationDate || !donationAmount) {
            toast({ variant: 'destructive', title: 'Missing fields' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'donations'), { donor: donorName, date: donationDate, amount: parseFloat(donationAmount) });
            toast({ title: 'Donation Recorded' });
            setIsDialogOpen(false); resetForm();
        } catch(e) {
            toast({ variant: 'destructive', title: 'Failed to record donation' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `donations/${id}`));
        toast({ title: 'Donation record deleted' });
    }

    const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Donor Fund Tracking</CardTitle>
                    <CardDescription>Manage and report on funds received from donors.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Add Donation</Button></DialogTrigger>
                     <DialogContent>
                        <DialogHeader><DialogTitle>New Donation</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Donor Name</Label><Input value={donorName} onChange={e=>setDonorName(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Date Received</Label><Input type="date" value={donationDate} onChange={e=>setDonationDate(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={donationAmount} onChange={e=>setDonationAmount(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveDonation} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                     </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Donor</TableHead>
                            <TableHead>Date Received</TableHead>
                            <TableHead className="text-right">Amount (ZMW)</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         donations.map(donor => (
                            <TableRow key={donor.id}>
                                <TableCell>{donor.donor}</TableCell>
                                <TableCell>{format(new Date(donor.date), 'PPP')}</TableCell>
                                <TableCell className="text-right">{donor.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(donor.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="justify-end font-bold text-lg">
                Total Donations: ZMW {totalDonations.toFixed(2)}
            </CardFooter>
        </Card>
    );
}
