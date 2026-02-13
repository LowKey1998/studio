'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2, Download, FileText, BookUser, Calendar, ShieldCheck, FileUp, Check } from "lucide-react";
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, onValue, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Resource = {
    id: string;
    title: string;
    description: string;
    type: string;
    fileUrl: string;
};

const resourceTypes = [
    { value: 'handbook', label: 'Student Handbook', icon: <BookUser className="h-5 w-5 text-primary" /> },
    { value: 'policy', label: 'Academic Policy', icon: <ShieldCheck className="h-5 w-5 text-primary" /> },
    { value: 'calendar', label: 'Academic Calendar', icon: <Calendar className="h-5 w-5 text-primary" /> },
    { value: 'other', label: 'Other Document', icon: <FileText className="h-5 w-5 text-primary" /> },
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

            await push(dbRef(db, 'generalResources'), { 
                title, 
                description, 
                type, 
                fileUrl,
                uploadedAt: new Date().toISOString()
            });
            toast({ title: 'Document Uploaded Successfully' });
            setIsDialogOpen(false); 
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to upload document' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this document? Students will lose access immediately.")) return;
        await remove(dbRef(db, `generalResources/${id}`));
        toast({ title: 'Document removed' });
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl font-headline">Academic Policies & Handbooks</CardTitle>
                        <CardDescription>Manage official institutional documents available to all students.</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="shadow-md">
                                <PlusCircle className="mr-2 h-4 w-4"/>Upload Document
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>New Institutional Resource</DialogTitle>
                                <DialogDescription>Uploaded documents are visible to all students in their Resources tab.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <Label>Document Title</Label>
                                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., 2024 Student Handbook"/>
                                </div>
                                <div className="space-y-1">
                                    <Label>Type</Label>
                                    <Select value={type} onValueChange={setType}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>{resourceTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Brief Description</Label>
                                    <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="A short summary of what this document contains..."/>
                                </div>
                                <div className="space-y-1">
                                    <Label>File (PDF, Doc, Excel, PPT)</Label>
                                    <div className="flex items-center gap-2 p-4 border-2 border-dashed rounded-lg bg-muted/20">
                                        <FileUp className="h-8 w-8 text-muted-foreground" />
                                        <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" className="border-0 bg-transparent shadow-none" onChange={e => setFile(e.target.files?.[0] || null)} />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleSaveResource} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                    Save Document
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
                </div>
            ) : resources.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {resources.map(res => (
                        <Card key={res.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow border-t-4 border-t-primary">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        {resourceTypes.find(t=>t.value===res.type)?.icon}
                                        <Badge variant="secondary" className="capitalize text-[10px]">{res.type}</Badge>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(res.id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                                <CardTitle className="text-lg pt-2">{res.title}</CardTitle>
                                <CardDescription className="line-clamp-2">{res.description}</CardDescription>
                            </CardHeader>
                            <CardFooter className="mt-auto border-t p-4 flex justify-between bg-muted/10">
                                <Button asChild variant="outline" size="sm" className="w-full">
                                    <a href={res.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4"/>Download File
                                    </a>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-muted/10 rounded-xl border-2 border-dashed">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-semibold">No Documents Uploaded</h3>
                    <p className="text-sm text-muted-foreground">Policies and handbooks will appear here once uploaded.</p>
                </div>
            )}
        </div>
    );
}