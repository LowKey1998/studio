
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Trash2, Download, Upload, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, onValue, push, remove, set, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DocumentFile = { name: string; url: string };

type Accreditation = {
    id: string;
    body: string;
    program: string;
    status: 'Accredited' | 'Under Review' | 'Probation' | 'Expired';
    expiryDate: string;
    documents?: Record<string, DocumentFile>;
};

export default function AccreditationPage() {
    const [accreditations, setAccreditations] = React.useState<Accreditation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingAccreditation, setEditingAccreditation] = React.useState<Accreditation | null>(null);
    const [body, setBody] = React.useState('');
    const [program, setProgram] = React.useState('');
    const [status, setStatus] = React.useState<Accreditation['status']>('Accredited');
    const [expiryDate, setExpiryDate] = React.useState('');
    const [files, setFiles] = React.useState<File[]>([]);

    const { toast } = useToast();

    React.useEffect(() => {
        const accreditationsRef = ref(db, 'accreditations');
        const unsub = onValue(accreditationsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setAccreditations(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime()));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setBody(''); setProgram(''); setStatus('Accredited'); setExpiryDate(''); setFiles([]);
        setEditingAccreditation(null);
    };

    const openDialog = (accreditation: Accreditation | null) => {
        if(accreditation) {
            setEditingAccreditation(accreditation);
            setBody(accreditation.body);
            setProgram(accreditation.program);
            setStatus(accreditation.status);
            setExpiryDate(accreditation.expiryDate);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    }
    
    const handleSave = async () => {
        if (!body || !program) {
            toast({ variant: 'destructive', title: 'Accrediting body and program are required.' });
            return;
        }
        setFormLoading(true);
        try {
            const documentUploads: Record<string, DocumentFile> = {};
            for(const file of files) {
                const fileRef = storageRef(storage, `accreditations/${file.name}_${Date.now()}`);
                const snapshot = await uploadBytes(fileRef, file);
                const url = await getDownloadURL(snapshot.ref);
                documentUploads[push(ref(db)).key!] = { name: file.name, url };
            }
            
            const accreditationData = {
                body,
                program,
                status,
                expiryDate,
                documents: editingAccreditation?.documents ? {...editingAccreditation.documents, ...documentUploads} : documentUploads,
            };

            if (editingAccreditation) {
                 await update(ref(db, `accreditations/${editingAccreditation.id}`), accreditationData);
                 toast({ title: "Accreditation Updated" });
            } else {
                await push(ref(db, 'accreditations'), accreditationData);
                toast({ title: "Accreditation Added" });
            }

            resetForm();
            setIsDialogOpen(false);
        } catch(e: any) {
            toast({ variant: 'destructive', title: "Save failed", description: e.message });
        } finally {
            setFormLoading(false);
        }
    }

    const handleDelete = async (id: string) => {
        if(!window.confirm("Are you sure? This action is permanent.")) return;
        await remove(ref(db, `accreditations/${id}`));
        toast({ title: "Accreditation record deleted" });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Accreditation Tracker</CardTitle>
                    <CardDescription>Track the status of all institutional and programmatic accreditations.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
                    <DialogTrigger asChild>
                        <Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/> Add Accreditation</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editingAccreditation ? "Edit" : "Add"} Accreditation</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1"><Label>Accrediting Body</Label><Input value={body} onChange={e => setBody(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Program</Label><Input value={program} onChange={e => setProgram(e.target.value)} placeholder="e.g., All Programmes"/></div>
                            <div className="space-y-1"><Label>Status</Label><Select value={status} onValueChange={val => setStatus(val as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Accredited">Accredited</SelectItem><SelectItem value="Under Review">Under Review</SelectItem><SelectItem value="Probation">Probation</SelectItem><SelectItem value="Expired">Expired</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1"><Label>Expiry Date</Label><Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}/></div>
                             <div className="space-y-1"><Label>Upload Documents</Label><Input type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))}/></div>
                        </div>
                        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSave} disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save"}</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Accrediting Body</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                        accreditations.map(acc => (
                             <TableRow key={acc.id}>
                                <TableCell>{acc.body}</TableCell>
                                <TableCell>{acc.program}</TableCell>
                                <TableCell><Badge variant={acc.status === 'Accredited' ? 'default' : 'secondary'}>{acc.status}</Badge></TableCell>
                                <TableCell>{acc.expiryDate ? format(new Date(acc.expiryDate), 'PPP') : 'N/A'}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" disabled={!acc.documents}><FileText className="mr-2 h-4 w-4" />View Documents</Button></DialogTrigger>
                                        <DialogContent><DialogHeader><DialogTitle>Documents for {acc.body}</DialogTitle></DialogHeader><div className="py-4 space-y-2">{Object.values(acc.documents || {}).map(doc => (<a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 hover:bg-muted rounded-md"><Download className="h-4 w-4"/><span>{doc.name}</span></a>))}</div></DialogContent>
                                    </Dialog>
                                    <Button size="icon" variant="ghost" onClick={() => openDialog(acc)}><Pencil className="h-4 w-4"/></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(acc.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
