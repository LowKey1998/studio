
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, PlusCircle, Loader2, Trash2, Download } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

type ScormPackage = {
    id: string;
    title: string;
    fileName: string;
    uploadDate: string;
    fileUrl: string;
};

export default function ScormIntegrationPage() {
    const [packages, setPackages] = React.useState<ScormPackage[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const scormRef = dbRef(db, 'scormPackages');
        const unsub = onValue(scormRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setPackages(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()));
            } else {
                setPackages([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const resetForm = () => {
        setTitle('');
        setFile(null);
    };
    
    const handleUploadPackage = async () => {
        if (!title || !file) {
            toast({ variant: 'destructive', title: 'Title and file are required.' });
            return;
        }
        if (!file.name.endsWith('.zip')) {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a .zip file.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `scormPackages/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);

            await push(dbRef(db, 'scormPackages'), {
                title,
                fileName: file.name,
                fileUrl,
                uploadDate: new Date().toISOString()
            });

            toast({ title: 'SCORM Package Uploaded' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to upload package' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This action cannot be undone.")) return;
        await remove(dbRef(db, `scormPackages/${id}`));
        toast({ title: 'Package deleted' });
    }


    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>SCORM Tools Integration</CardTitle>
                    <CardDescription>Manage and integrate SCORM-compliant learning content.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Upload Package</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload SCORM Package</DialogTitle>
                            <DialogDescription>Upload a .zip file containing your SCORM content.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Package Title</Label><Input value={title} onChange={e => setTitle(e.target.value)}/></div>
                            <div className="space-y-1"><Label>SCORM File (.zip)</Label><Input type="file" accept=".zip" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleUploadPackage} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Upload & Process</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Package Title</TableHead>
                            <TableHead>File Name</TableHead>
                            <TableHead>Date Uploaded</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         packages.map(pkg => (
                            <TableRow key={pkg.id}>
                                <TableCell>{pkg.title}</TableCell>
                                <TableCell>{pkg.fileName}</TableCell>
                                <TableCell>{format(new Date(pkg.uploadDate), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm" className="mr-2"><a href={pkg.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>Download</a></Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(pkg.id)}><Trash2 className="h-4"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {packages.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">No SCORM packages uploaded yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
