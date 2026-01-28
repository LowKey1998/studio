'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Users, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

type Scholarship = {
    id: string;
    name: string;
    description: string;
    donor?: string;
    percentage: number;
    semesterIds?: Record<string, boolean>;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
};

export default function ScholarshipManagementPage() {
    const [scholarships, setScholarships] = React.useState<Scholarship[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingScholarship, setEditingScholarship] = React.useState<Scholarship | null>(null);
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [donor, setDonor] = React.useState('');
    const [percentage, setPercentage] = React.useState(100);
    
    // Assign Dialog state
    const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
    const [selectedSemesters, setSelectedSemesters] = React.useState<Record<string, boolean>>({});

    const { toast } = useToast();

    React.useEffect(() => {
        const scholarshipsRef = ref(db, 'scholarships');
        const unsubSchol = onValue(scholarshipsRef, (snapshot) => {
            setScholarships(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        
        const semestersRef = ref(db, 'semesters');
        const unsubSem = onValue(semestersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSemesters(Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived'));
            } else {
                setSemesters([]);
            }
        });
        
        return () => { unsubSchol(); unsubSem(); };
    }, []);
    
    const resetForm = () => {
        setName('');
        setDescription('');
        setDonor('');
        setPercentage(100);
        setEditingScholarship(null);
    };

    const handleSave = async () => {
        if (!name || !percentage) {
            toast({ variant: 'destructive', title: 'Name and percentage are required' });
            return;
        }
        setSaving(true);
        try {
            const data = { name, description, donor, percentage, semesterIds: editingScholarship?.semesterIds || {} };
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
            setPercentage(scholarship.percentage || 100);
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
    
    const openAssignDialog = (scholarship: Scholarship) => {
        setEditingScholarship(scholarship);
        setSelectedSemesters(scholarship.semesterIds || {});
        setIsAssignDialogOpen(true);
    };
    
    const handleSemesterSelection = (semesterId: string) => {
        setSelectedSemesters(prev => {
            const newSelection = { ...prev };
            if (newSelection[semesterId]) delete newSelection[semesterId];
            else newSelection[semesterId] = true;
            return newSelection;
        });
    };

    const handleAssignToSemesters = async () => {
        if (!editingScholarship) return;
        setSaving(true);
        try {
            await update(ref(db, `scholarships/${editingScholarship.id}`), { semesterIds: selectedSemesters });
            toast({ title: 'Availability Updated' });
            setIsAssignDialogOpen(false);
        } catch(e: any) {
            toast({variant: 'destructive', title: 'Update failed'});
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Scholarship Management</CardTitle>
                    <CardDescription>Create scholarship programs with specific tuition waiver percentages and assign them to semesters.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open);}}>
                    <DialogTrigger asChild><Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4"/>New Scholarship</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>{editingScholarship ? 'Edit' : 'Create'} Scholarship</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                             <div className="space-y-1">
                                <Label>Tuition Waiver Percentage</Label>
                                <div className="relative">
                                    <Input type="number" min="1" max="100" value={percentage} onChange={e => setPercentage(Number(e.target.value))} className="pr-8"/>
                                    <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                            <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Donor / Sponsor (Optional)</Label><Input value={donor} onChange={e => setDonor(e.target.value)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Waiver</TableHead><TableHead>Donor</TableHead><TableHead>Description</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         scholarships.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.name}</TableCell>
                                <TableCell className="font-bold">{s.percentage}%</TableCell>
                                <TableCell>{s.donor}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => openAssignDialog(s)} className="mr-2">Assign Semesters</Button>
                                    <Button variant="ghost" size="sm" onClick={() => openDialog(s)}>Edit</Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Assign "{editingScholarship?.name}" to Semesters</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-4 max-h-80 overflow-y-auto">
                        {semesters.map(semester => (
                            <div key={semester.id} className="flex items-center gap-2 p-2 border rounded-md">
                                <Checkbox id={semester.id} checked={!!selectedSemesters[semester.id]} onCheckedChange={() => handleSemesterSelection(semester.id)} />
                                <Label htmlFor={semester.id}>{semester.name}</Label>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignToSemesters} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Assignments</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
