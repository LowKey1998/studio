
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, get } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Scholarship = {
    id: string;
    name: string;
    description: string;
    donor?: string;
};

export default function ScholarshipManagementPage() {
    const [scholarships, setScholarships] = React.useState<Scholarship[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingScholarship, setEditingScholarship] = React.useState<Scholarship | null>(null);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [donor, setDonor] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const scholarshipsRef = ref(db, 'scholarships');
        const unsub = onValue(scholarshipsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setScholarships(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setScholarships([]);
            }
            setLoading(false);
        });
        
        return () => unsub();
    }, []);
    
    const resetForm = () => {
        setName('');
        setDescription('');
        setDonor('');
        setEditingScholarship(null);
    };

    const handleSave = async () => {
        if (!name) {
            toast({ variant: 'destructive', title: 'Scholarship name is required' });
            return;
        }
        setSaving(true);
        try {
            const data = { name, description, donor };
            if (editingScholarship) {
                await set(ref(db, `scholarships/${editingScholarship.id}`), data);
                toast({ title: 'Scholarship Updated' });
            } else {
                await push(ref(db, 'scholarships'), data);
                toast({ title: 'Scholarship Created' });
            }
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const openDialog = (scholarship: Scholarship | null) => {
        if (scholarship) {
            setEditingScholarship(scholarship);
            setName(scholarship.name);
            setDescription(scholarship.description);
            setDonor(scholarship.donor || '');
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This will remove the scholarship program.")) return;
        await remove(ref(db, `scholarships/${id}`));
        toast({ title: 'Scholarship Deleted' });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Scholarship Management</CardTitle>
                    <CardDescription>Create and manage scholarship programs. Student assignment is handled during registration approval.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4"/>New Scholarship</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>{editingScholarship ? 'Edit' : 'Create'} Scholarship</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                             <div className="space-y-1"><Label>Donor / Sponsor (Optional)</Label><Input value={donor} onChange={e => setDonor(e.target.value)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Donor</TableHead><TableHead>Description</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         scholarships.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell>{s.donor}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => openDialog(s)}>Edit</Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
