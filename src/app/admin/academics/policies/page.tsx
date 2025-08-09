
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Download, FileText, BookUser, Calendar } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, set, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Resource = {
    id: string;
    title: string;
    description: string;
    type: string;
    fileUrl: string;
};

const resourceTypes = [
    { value: 'handbook', label: 'Student Handbook', icon: <BookUser className="h-8 w-8 text-primary" /> },
    { value: 'policy', label: 'Academic Policy', icon: <FileText className="h-8 w-8 text-primary" /> },
    { value: 'calendar', label: 'Academic Calendar', icon: <Calendar className="h-8 w-8 text-primary" /> },
    { value: 'other', label: 'Other Document', icon: <FileText className="h-8 w-8 text-primary" /> },
];

export default function AcademicPoliciesPage() {
    const [resources, setResources] = React.useState<Resource[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [type, setType] = React.useState('policy');
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const resourcesRef = dbRef(db, 'generalResources');
        const unsub = onValue(resourcesRef, (snapshot) => {
            setResources(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setTitle(''); setDescription(''); setType('policy'); setFile(null);
    };

    const handleSaveResource = async () => {
        if (!title || !file) {
            toast({ variant: 'destructive', title: 'Title and file are required.' });
            return;
        }
        setSaving(true);
        try {
            const fileStorageRef = storageRef(storage, `generalResources/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileStorageRef, file);
            const fileUrl = await getDownloadURL(snapshot.ref);

            await push(dbRef(db, 'generalResources'), { title, description, type, fileUrl });
            toast({ title: 'Resource Uploaded' });
            setIsDialogOpen(false); resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to upload resource' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await remove(dbRef(db, `generalResources/${id}`));
        toast({ title: 'Resource deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Academic Policies Upload</CardTitle>
                    <CardDescription>Upload and manage important documents like policies and handbooks.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Upload Document</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New General Resource</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Type</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>{resourceTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label>File (PDF)</Label><Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveResource} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-48" /> : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {resources.map(res => (
                        <Card key={res.id}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">{resourceTypes.find(t=>t.value===res.type)?.icon} {res.title}</CardTitle>
                                <CardDescription>{res.description}</CardDescription>
                            </CardHeader>
                            <CardFooter className="flex justify-between">
                                <Button asChild variant="outline" size="sm"><a href={res.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>Download</a></Button>
                                <Button variant="destructive" size="icon" onClick={() => handleDelete(res.id)}><Trash2 className="h-4"/></Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                )}
            </CardContent>
        </Card>
    );
}
