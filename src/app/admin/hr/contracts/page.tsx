
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, FileText, Download } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Contract = {
    id: string;
    staffId: string;
    staffName: string;
    dateSigned: string;
    terms: string;
    fileUrl: string;
};

type StaffMember = {
    uid: string;
    name: string;
};

export default function StaffContractsPage() {
    const [contracts, setContracts] = React.useState<Contract[]>([]);
    const [staff, setStaff] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedStaff, setSelectedStaff] = React.useState('');
    const [dateSigned, setDateSigned] = React.useState('');
    const [terms, setTerms] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const contractsRef = ref(db, 'staffContracts');
        const unsubContracts = onValue(contractsRef, (snapshot) => {
            setContracts(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setStaff(Object.keys(data).filter(uid => data[uid].role === 'Staff').map(uid => ({ uid, name: data[uid].name })));
            }
        });

        return () => {
            unsubContracts();
            unsubUsers();
        };
    }, []);

    const resetForm = () => {
        setSelectedStaff(''); setDateSigned(''); setTerms(''); setFile(null);
    };

    const handleSaveContract = async () => {
        if (!selectedStaff || !dateSigned || !file) {
            toast({ variant: 'destructive', title: 'Staff, date, and file are required.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `contracts/staff/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);
            
            const staffMember = staff.find(s => s.uid === selectedStaff);

            await push(ref(db, 'staffContracts'), {
                staffId: selectedStaff,
                staffName: staffMember?.name || 'Unknown',
                dateSigned,
                terms,
                fileUrl
            });
            toast({ title: 'Contract Uploaded' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to upload contract' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This action is permanent.")) return;
        await remove(ref(db, `staffContracts/${id}`));
        toast({ title: 'Contract deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Staff Contracts</CardTitle>
                    <CardDescription>Upload and manage employment contracts for staff members.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Add Contract</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Staff Contract</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                             <div className="space-y-1">
                                <Label>Staff Member</Label>
                                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                                    <SelectTrigger><SelectValue placeholder="Select staff..."/></SelectTrigger>
                                    <SelectContent>{staff.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label>Date Signed</Label><Input type="date" value={dateSigned} onChange={e => setDateSigned(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Terms of Service / Notes</Label><Textarea value={terms} onChange={e => setTerms(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Contract File (PDF)</Label><Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveContract} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Staff Member</TableHead><TableHead>Date Signed</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow> :
                         contracts.map(c => (
                            <TableRow key={c.id}>
                                <TableCell>{c.staffName}</TableCell>
                                <TableCell>{format(new Date(c.dateSigned), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm" className="mr-2"><a href={c.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>Download</a></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
