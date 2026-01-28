'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Download } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

type Contract = {
    id: string;
    title: string;
    party: string;
    type: string;
    reviewDate: string;
    fileUrl: string;
};

export default function ContractRepositoryPage() {
    const [contracts, setContracts] = React.useState<Contract[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [party, setParty] = React.useState('');
    const [type, setType] = React.useState('');
    const [reviewDate, setReviewDate] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const contractsRef = dbRef(db, 'contracts');
        const unsub = onValue(contractsRef, (snapshot) => {
            setContracts(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setTitle(''); setParty(''); setType(''); setReviewDate(''); setFile(null);
    };

    const handleSaveContract = async () => {
        if (!title || !party || !file) {
            toast({ variant: 'destructive', title: 'Title, Party, and File are required.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `contracts/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);

            await push(dbRef(db, 'contracts'), { title, party, type, reviewDate, fileUrl });
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
        await remove(dbRef(db, `contracts/${id}`));
        toast({ title: 'Contract deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Contract Repository</CardTitle>
                    <CardDescription>Store and manage all institutional contracts.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Upload Contract</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Upload New Contract</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Contract Title</Label><Input value={title} onChange={e => setTitle(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Counter-Party</Label><Input value={party} onChange={e => setParty(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Contract Type</Label><Input value={type} onChange={e => setType(e.target.value)} placeholder="e.g., Vendor, Employment, Lease"/></div>
                            <div className="space-y-1"><Label>Next Review Date</Label><Input type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)}/></div>
                            <div className="space-y-1"><Label>File (PDF)</Label><Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
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
                    <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Counter-Party</TableHead><TableHead>Type</TableHead><TableHead>Review Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         contracts.map(c => (
                            <TableRow key={c.id}>
                                <TableCell>{c.title}</TableCell>
                                <TableCell>{c.party}</TableCell>
                                <TableCell>{c.type}</TableCell>
                                <TableCell>{c.reviewDate ? format(new Date(c.reviewDate), 'PPP') : 'N/A'}</TableCell>
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