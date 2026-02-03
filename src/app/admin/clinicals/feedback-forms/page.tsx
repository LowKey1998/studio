
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type FeedbackForm = { id: string; title: string; description: string; schema?: string; };

export default function FeedbackFormsPage() {
    const [forms, setForms] = React.useState<FeedbackForm[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Form state
    const [isOpen, setIsOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');

    React.useEffect(() => {
        const fRef = ref(db, 'clinicals/feedbackForms');
        const unsub = onValue(fRef, (snap) => {
            setForms(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!title) return;
        setSaving(true);
        try {
            await push(ref(db, 'clinicals/feedbackForms'), { title, description });
            toast({ title: 'Form Template Created' });
            setIsOpen(false);
            setTitle(''); setDescription('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `clinicals/feedbackForms/${id}`));
        toast({ title: 'Form removed' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Clinical Feedback Forms</CardTitle>
                        <CardDescription>Manage standardized forms for clinical evaluations.</CardDescription>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Create Form</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>New Evaluation Template</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-1"><Label>Form Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Mid-Term Practical Evaluation"/></div>
                                <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)}/></div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : 'Create'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24 w-full"/></TableCell></TableRow> :
                             forms.map(f => (
                                <TableRow key={f.id}>
                                    <TableCell className="font-bold">{f.title}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{f.description}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </TableCell>
                                </TableRow>
                             ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
