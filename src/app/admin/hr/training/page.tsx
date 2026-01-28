
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Check, Trash2, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

type TrainingLog = {
    id: string;
    title: string;
    date: string;
    status: 'Scheduled' | 'Completed';
    attendees?: Record<string, { name: string }>;
};

type StaffMember = {
    uid: string;
    name: string;
};

export default function TrainingLogsPage() {
    const [trainings, setTrainings] = React.useState<TrainingLog[]>([]);
    const [staff, setStaff] = React.useState<StaffMember[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [date, setDate] = React.useState('');
    const [selectedAttendees, setSelectedAttendees] = React.useState<Record<string, boolean>>({});

    const { toast } = useToast();

    React.useEffect(() => {
        const trainingsRef = ref(db, 'trainingLogs');
        const unsubTrainings = onValue(trainingsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setTrainings(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setLoading(false);
        });
        
        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const users = snapshot.val() || {};
            setStaff(Object.keys(users).filter(uid => users[uid].role === 'Staff').map(uid => ({ uid, name: users[uid].name })));
        });

        return () => {
            unsubTrainings();
            unsubUsers();
        };
    }, []);

    const resetForm = () => {
        setTitle('');
        setDate('');
        setSelectedAttendees({});
    };

    const handleSaveTraining = async () => {
        if (!title || !date) {
            toast({ variant: 'destructive', title: 'Title and Date are required.' });
            return;
        }
        setSaving(true);
        try {
            const attendeesData: Record<string, { name: string }> = {};
            Object.keys(selectedAttendees).forEach(uid => {
                if (selectedAttendees[uid]) {
                    const staffMember = staff.find(s => s.uid === uid);
                    if (staffMember) attendeesData[uid] = { name: staffMember.name };
                }
            });

            const newTrainingRef = push(ref(db, 'trainingLogs'));
            await set(newTrainingRef, {
                title,
                date,
                status: 'Scheduled',
                attendees: attendeesData,
            });
            toast({ title: 'Training Scheduled' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to schedule training', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This cannot be undone.")) return;
        await remove(ref(db, `trainingLogs/${id}`));
        toast({ title: 'Training log deleted' });
    };

    const handleMarkComplete = async (id: string) => {
        await update(ref(db, `trainingLogs/${id}`), { status: 'Completed' });
        toast({ title: 'Training marked as complete' });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Training Logs</CardTitle>
                    <CardDescription>Log and track staff training and development programs.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Training</Button></DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Schedule New Training</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                           <div className="space-y-1"><Label>Training Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
                           <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                           <div className="space-y-2">
                               <Label>Attendees</Label>
                               <ScrollArea className="h-48 rounded-md border p-4">
                                   {staff.map(s => (
                                       <div key={s.uid} className="flex items-center gap-2 mb-2">
                                            <Checkbox 
                                                id={`att-${s.uid}`} 
                                                checked={!!selectedAttendees[s.uid]}
                                                onCheckedChange={checked => setSelectedAttendees(prev => ({...prev, [s.uid]: !!checked}))}
                                            />
                                            <Label htmlFor={`att-${s.uid}`}>{s.name}</Label>
                                       </div>
                                   ))}
                               </ScrollArea>
                           </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" onClick={resetForm}>Cancel</Button></DialogClose>
                            <Button onClick={handleSaveTraining} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 animate-spin"/> : <Check className="mr-2 h-4"/>}Schedule Training
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Training Title</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Attendees</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         trainings.map(t => (
                            <TableRow key={t.id}>
                                <TableCell>{t.title}</TableCell>
                                <TableCell>{format(new Date(t.date), 'PPP')}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{t.attendees ? Object.values(t.attendees).map(a => a.name).join(', ') : 'None'}</TableCell>
                                <TableCell><Badge variant={t.status === 'Completed' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell>
                                <TableCell className="text-right space-x-2">
                                    {t.status === 'Scheduled' && <Button variant="outline" size="sm" onClick={() => handleMarkComplete(t.id)}><Check className="mr-2 h-4 w-4" />Mark Complete</Button>}
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                       ))}
                       {trainings.length === 0 && !loading && <TableRow><TableCell colSpan={5} className="h-24 text-center">No training logs found.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
