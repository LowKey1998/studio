'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DisciplinaryLog = {
    id: string;
    studentName: string;
    studentId: string;
    date: string;
    action: 'Warning' | 'Suspension' | 'Expulsion';
    details: string;
};

export default function DisciplinaryLogsPage() {
    const [logs, setLogs] = React.useState<DisciplinaryLog[]>([]);
    const [students, setStudents] = React.useState<{id: string, name: string}[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedStudent, setSelectedStudent] = React.useState('');
    const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [action, setAction] = React.useState<'Warning' | 'Suspension' | 'Expulsion'>('Warning');
    const [details, setDetails] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const logsRef = ref(db, 'disciplinaryLogs');
        const unsubLogs = onValue(logsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setLogs(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setLoading(false);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const usersData = snapshot.val() || {};
            setStudents(Object.keys(usersData).filter(uid => usersData[uid].role === 'Student').map(uid => ({ id: uid, name: `${usersData[uid].name} (${usersData[uid].id})` })));
        });

        return () => {
            unsubLogs();
            unsubUsers();
        };
    }, []);

    const resetForm = () => {
        setSelectedStudent(''); setDate(format(new Date(), 'yyyy-MM-dd')); setAction('Warning'); setDetails('');
    };

    const handleSaveLog = async () => {
        if (!selectedStudent || !action || !details) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setSaving(true);
        try {
            const studentData = students.find(s => s.id === selectedStudent);
            await push(ref(db, 'disciplinaryLogs'), {
                studentId: selectedStudent,
                studentName: studentData?.name,
                date,
                action,
                details
            });
            toast({ title: 'Log Entry Saved' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save log' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        await remove(ref(db, `disciplinaryLogs/${id}`));
        toast({ title: 'Log entry deleted.' });
    }

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Student Disciplinary Logs</CardTitle>
                    <CardDescription>Record and manage student disciplinary actions.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Log Entry</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Disciplinary Log</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Student</Label>
                                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                                    <SelectTrigger><SelectValue placeholder="Select a student..."/></SelectTrigger>
                                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label>Date of Incident</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Action Taken</Label>
                                <Select value={action} onValueChange={(val) => setAction(val as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="Warning">Warning</SelectItem><SelectItem value="Suspension">Suspension</SelectItem><SelectItem value="Expulsion">Expulsion</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1"><Label>Details</Label><Textarea value={details} onChange={e => setDetails(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveLog} disabled={saving}>{saving && <Loader2 className="mr-2"/>}Save Log</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         logs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{log.studentName}</TableCell>
                                <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                <TableCell>{log.action}</TableCell>
                                <TableCell className="max-w-sm truncate">{log.details}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(log.id)}><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}