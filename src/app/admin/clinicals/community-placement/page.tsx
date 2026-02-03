
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Trash2, MapPin, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Placement = { id: string; studentId: string; studentName: string; location: string; startDate: string; endDate: string; };
type Student = { uid: string; name: string; id: string; };

export default function CommunityPlacementPage() {
    const [placements, setPlacements] = React.useState<Placement[]>([]);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    // Form State
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedStudentId, setSelectedStudentId] = React.useState('');
    const [location, setLocation] = React.useState('');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');

    React.useEffect(() => {
        const pRef = ref(db, 'clinicals/placements');
        const uRef = ref(db, 'users');

        const unsubP = onValue(pRef, (snap) => {
            setPlacements(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
        });

        const unsubU = onValue(uRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                setStudents(Object.keys(data).filter(uid => data[uid].role === 'Student').map(uid => ({ uid, name: data[uid].name, id: data[uid].id })));
            }
            setLoading(false);
        });

        return () => { unsubP(); unsubU(); };
    }, []);

    const handleSave = async () => {
        if (!selectedStudentId || !location || !startDate || !endDate) return;
        setSaving(true);
        try {
            const student = students.find(s => s.uid === selectedStudentId);
            await push(ref(db, 'clinicals/placements'), {
                studentId: selectedStudentId,
                studentName: student?.name,
                location,
                startDate,
                endDate
            });
            toast({ title: 'Placement Recorded' });
            setIsOpen(false);
            setSelectedStudentId(''); setLocation(''); setStartDate(''); setEndDate('');
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await remove(ref(db, `clinicals/placements/${id}`));
        toast({ title: 'Placement removed' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Community Placement Management</CardTitle>
                        <CardDescription>Track and manage student community service and clinical placements.</CardDescription>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Assign Placement</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>New Community Placement</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-1">
                                    <Label>Student</Label>
                                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                        <SelectTrigger><SelectValue placeholder="Select student..."/></SelectTrigger>
                                        <SelectContent>{students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name} ({s.id})</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Location / Health Centre</Label><Input value={location} onChange={e => setLocation(e.target.value)}/></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}/></div>
                                    <div className="space-y-1"><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}/></div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : 'Save'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24 w-full"/></TableCell></TableRow> :
                             placements.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-bold">{p.studentName}</TableCell>
                                    <TableCell>{p.location}</TableCell>
                                    <TableCell>{format(new Date(p.startDate), 'MMM d')} - {format(new Date(p.endDate), 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
