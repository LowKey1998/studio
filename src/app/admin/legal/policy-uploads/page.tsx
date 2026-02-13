
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Download, FileUp, Check as CheckIcon } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

type Policy = {
    id: string;
    title: string;
    category: string;
    uploadDate: string;
    fileUrl: string;
};

export default function PolicyUploadsPage() {
    const [policies, setPolicies] = React.useState<Policy[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [category, setCategory] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const policiesRef = dbRef(db, 'policies');
        const unsub = onValue(policiesRef, (snapshot) => {
            setPolicies(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setTitle(''); setCategory(''); setFile(null);
    };

    const handleSavePolicy = async () => {
        if (!title || !category || !file) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `policies/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);

            await push(dbRef(db, 'policies'), { title, category, fileUrl, uploadDate: new Date().toISOString() });
            toast({ title: 'Policy Uploaded' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to upload policy' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(dbRef(db, `policies/${id}`));
        toast({ title: 'Policy deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Legal Policy Uploads</CardTitle>
                    <CardDescription>Manage official institutional and legal policies. Accepts Office and PDF formats.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Upload Policy</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Upload New Policy</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Policy Title</Label><Input value={title} onChange={e => setTitle(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Category</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Compliance, HR, Safety"/></div>
                            <div className="space-y-1">
                                <Label>File (PDF, Word, Excel, PPT, Text)</Label>
                                <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSavePolicy} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckIcon className="mr-2 h-4 w-4"/>}
                                Save Policy
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Title</TableHead> <TableHead>Category</TableHead><TableHead>Upload Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         policies.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.title}</TableCell>
                                <TableCell>{p.category}</TableCell>
                                <TableCell>{format(new Date(p.uploadDate), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm" className="mr-2"><a href={p.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4"/>Download</a></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
