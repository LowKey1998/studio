
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Lead = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    source: string;
    status: 'New' | 'Contacted' | 'Applied' | 'Disqualified';
};

export default function LeadsCapturePage() {
    const [leads, setLeads] = React.useState<Lead[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [source, setSource] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const leadsRef = ref(db, 'admissions/leads');
        const unsub = onValue(leadsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setLeads(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const resetForm = () => {
        setName(''); setEmail(''); setPhone(''); setSource('');
    };

    const handleSaveLead = async () => {
        if (!name || !email) {
            toast({ variant: 'destructive', title: 'Name and email are required.' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'admissions/leads'), {
                name,
                email,
                phone,
                source,
                status: 'New',
                createdAt: new Date().toISOString()
            });
            toast({ title: "Lead Added" });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add lead.' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDeleteLead = async (leadId: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(ref(db, `admissions/leads/${leadId}`));
        toast({ title: "Lead removed" });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Leads Capture</CardTitle>
                    <CardDescription>Manually add and manage prospective student leads.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Add Lead</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} required/></div>
                            <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></div>
                            <div className="space-y-1"><Label>Phone</Label><Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Lead Source</Label><Input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Facebook, Referral"/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveLead} disabled={saving}>{saving && <Loader2 className="mr-2 h-4"/>}Save Lead</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Status</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         leads.map(lead => (
                            <TableRow key={lead.id}>
                                <TableCell>{lead.name}</TableCell>
                                <TableCell>{lead.email}</TableCell>
                                <TableCell>{lead.source}</TableCell>
                                <TableCell>{lead.status}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteLead(lead.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                         ))}
                         {leads.length === 0 && !loading && <TableRow><TableCell colSpan={5} className="text-center h-24">No leads captured yet.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
