'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { format, parseISO, isSameDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

type Rotation = {
    id: string;
    studentId: string;
    studentName: string;
    ward: string;
    date: string;
};

type Student = {
    uid: string;
    name: string;
};

export default function RotationPlanningPage() {
    const [rotations, setRotations] = React.useState<Rotation[]>([]);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Form state
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
    const [selectedStudentId, setSelectedStudentId] = React.useState('');
    const [ward, setWard] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const rotationsRef = ref(db, 'clinicalRotations');
        const unsubRotations = onValue(rotationsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setRotations(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, snapshot => {
            const usersData = snapshot.val() || {};
            setStudents(Object.keys(usersData).filter(uid => usersData[uid].role === 'Student').map(uid => ({ uid, name: usersData[uid].name })));
        });

        return () => {
            unsubRotations();
            unsubUsers();
        };
    }, []);

    const resetForm = () => {
        setSelectedStudentId('');
        setWard('');
    };

    const handleScheduleRotation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedStudentId || !ward) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setFormLoading(true);
        try {
            const studentName = students.find(s => s.uid === selectedStudentId)?.name;
            await push(ref(db, 'clinicalRotations'), {
                studentId: selectedStudentId,
                studentName,
                ward,
                date: format(selectedDate, 'yyyy-MM-dd')
            });
            toast({ title: 'Rotation Scheduled' });
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Scheduling failed', description: error.message });
        } finally {
            setFormLoading(false);
        }
    };
    
    const rotationsOnSelectedDay = rotations.filter(r => isSameDay(parseISO(r.date), selectedDate || new Date()));

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Rotation Planning</CardTitle>
                    <CardDescription>Plan and schedule student clinical rotations across different wards and departments.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Schedule Rotation</Button></DialogTrigger>
                    <DialogContent><form onSubmit={handleScheduleRotation}>
                        <DialogHeader><DialogTitle>New Rotation</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Student</Label><Select value={selectedStudentId} onValueChange={setSelectedStudentId}><SelectTrigger><SelectValue placeholder="Select a student..."/></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1"><Label>Ward/Department</Label><Input value={ward} onChange={e => setWard(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal">{selectedDate ? format(selectedDate, 'PPP') : "Select date"}</Button></PopoverTrigger><PopoverContent><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} /></PopoverContent></Popover></div>
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={formLoading}>{formLoading && <Loader2 className="mr-2 animate-spin"/>}Schedule</Button></DialogFooter>
                    </form></DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="flex justify-center">
                 <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                />
                </div>
                 <div className="mt-4">
                    <h3 className="font-semibold">Rotations for {selectedDate ? format(selectedDate, 'PPP') : 'selected date'}:</h3>
                    {loading ? <Skeleton className="h-24"/>
                    : rotationsOnSelectedDay.length > 0 ? (
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            {rotationsOnSelectedDay.map(r => <li key={r.id}>{r.studentName} - {r.ward}</li>)}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-2">No rotations scheduled for this date.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
