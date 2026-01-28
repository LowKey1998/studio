'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type LegalCase = {
    id: string;
    caseNumber: string;
    title: string;
    description: string;
    status: 'Open' | 'Under Review' | 'Closed' | 'Archived';
    dateOpened: string;
};

const statusOptions: LegalCase['status'][] = ['Open', 'Under Review', 'Closed', 'Archived'];

export default function CaseManagementPage() {
    const [cases, setCases] = React.useState<LegalCase[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [caseNumber, setCaseNumber] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const casesRef = ref(db, 'legalCases');
        const unsub = onValue(casesRef, (snapshot) => {
            const data = snapshot.val() || {};
            setCases(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a, b) => new Date(b.dateOpened).getTime() - new Date(a.dateOpened).getTime()));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setCaseNumber(''); setTitle(''); setDescription('');
    };

    const handleSaveCase = async () => {
        if (!caseNumber || !title) {
            toast({ variant: 'destructive', title: 'Case number and title are required.' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'legalCases'), {
                caseNumber,
                title,
                description,
                status: 'Open',
                dateOpened: new Date().toISOString()
            });
            toast({ title: 'Case Opened' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to open case' });
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (caseId: string, status: LegalCase['status']) => {
        await update(ref(db, `legalCases/${caseId}`), { status });
        toast({ title: 'Case status updated.' });
    };
    
    const handleDelete = async (caseId: string) => {
        await remove(ref(db, `legalCases/${caseId}`));
        toast({ title: 'Case deleted.' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Case Management</CardTitle>
                    <CardDescription>Track legal cases and their statuses.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Open New Case</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Open New Legal Case</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Case Number / ID</Label><Input value={caseNumber} onChange={e => setCaseNumber(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Case Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Case Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveCase} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Case</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Case Number</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Date Opened</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         cases.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.caseNumber}</TableCell>
                                <TableCell>{item.title}</TableCell>
                                <TableCell>{format(new Date(item.dateOpened), 'PPP')}</TableCell>
                                <TableCell>
                                     <Select value={item.status} onValueChange={(value) => handleStatusChange(item.id, value as any)}>
                                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}