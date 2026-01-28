
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Book, Heart, Trash2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

type ChaplainLog = {
    id: string;
    date: string;
    title: string;
    notes: string;
    chaplainId: string;
};

export default function ChaplainLogsPage() {
    const [logs, setLogs] = React.useState<ChaplainLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [notes, setNotes] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;

        const logsRef = ref(db, `chaplainLogs/${currentUser.uid}`);
        const unsubscribe = onValue(logsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setLogs(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } else {
                setLogs([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const resetForm = () => {
        setTitle('');
        setNotes('');
        setDate(format(new Date(), 'yyyy-MM-dd'));
    };

    const handleSaveLog = async () => {
        if (!title || !notes || !currentUser) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const newLogRef = push(ref(db, `chaplainLogs/${currentUser.uid}`));
            await set(newLogRef, {
                date,
                title,
                notes,
                chaplainId: currentUser.uid
            });
            toast({ title: 'Log Entry Saved' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save log', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLog = async (id: string) => {
        if (!currentUser || !window.confirm("Are you sure you want to delete this log entry?")) return;
        await remove(ref(db, `chaplainLogs/${currentUser.uid}/${id}`));
        toast({ title: 'Log entry deleted' });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Book className="h-6 w-6"/>Chaplaincy Logs</CardTitle>
                    <CardDescription>A secure and confidential space for your personal ministry logs.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Log Entry</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Confidential Log Entry</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Title / Subject</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Session with John Doe" /></div>
                            <div className="space-y-1"><Label>Confidential Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={10} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSaveLog} disabled={saving}>{saving && <Loader2 className="mr-2 h-4"/>}Save Entry</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive" className="mb-4">
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Strictly Confidential</AlertTitle>
                    <AlertDescription>
                        These logs are private to your account and are not accessible by other system administrators or users.
                    </AlertDescription>
                </Alert>
                <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow> :
                         logs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                <TableCell>{log.title}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteLog(log.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
