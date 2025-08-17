
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
import { Badge } from '@/components/ui/badge';

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
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle>Leads Capture</CardTitle>
                    <CardDescription>Manually add and manage prospective student leads.</CardDescription>
                </div>
                 <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
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
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteLead(lead.id)} disabled>
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
