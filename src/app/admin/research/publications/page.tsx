'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Download } from "lucide-react";
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

type Publication = {
    id: string;
    title: string;
    authors: string;
    journal: string;
    publicationDate: string;
    fileUrl: string;
};

export default function PublicationRepositoryPage() {
    const [publications, setPublications] = React.useState<Publication[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [authors, setAuthors] = React.useState('');
    const [journal, setJournal] = React.useState('');
    const [publicationDate, setPublicationDate] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const publicationsRef = dbRef(db, 'publications');
        const unsub = onValue(publicationsRef, (snapshot) => {
            setPublications(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const resetForm = () => {
        setTitle(''); setAuthors(''); setJournal(''); setPublicationDate(''); setFile(null);
    };
    
    const handleSavePublication = async () => {
        if (!title || !authors || !publicationDate || !file) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `publications/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);

            await push(dbRef(db, 'publications'), { title, authors, journal, publicationDate, fileUrl });
            toast({ title: 'Publication Added' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add publication' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(dbRef(db, `publications/${id}`));
        toast({ title: 'Publication removed' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Publication Repository</CardTitle>
                    <CardDescription>A central repository for all research papers and publications.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Add Publication</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Publication</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Authors</Label><Input value={authors} onChange={e => setAuthors(e.target.value)} placeholder="e.g., Doe, J., Smith, A."/></div>
                            <div className="space-y-1"><Label>Journal/Conference</Label><Input value={journal} onChange={e => setJournal(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Publication Date</Label><Input type="date" value={publicationDate} onChange={e => setPublicationDate(e.target.value)} /></div>
                            <div className="space-y-1"><Label>File (PDF)</Label><Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSavePublication} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Authors</TableHead>
                            <TableHead>Journal</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         publications.map(pub => (
                            <TableRow key={pub.id}>
                                <TableCell>{pub.title}</TableCell>
                                <TableCell>{pub.authors}</TableCell>
                                <TableCell>{pub.journal}</TableCell>
                                <TableCell>{format(new Date(pub.publicationDate), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm" className="mr-2"><a href={pub.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>Download</a></Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(pub.id)}><Trash2 className="h-4"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
