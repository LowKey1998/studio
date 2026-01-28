
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type HackathonLog = {
    id: string;
    event: string;
    student: string;
    project: string;
};

export default function HackathonLogsPage() {
    const [logs, setLogs] = React.useState<HackathonLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [event, setEvent] = React.useState('');
    const [student, setStudent] = React.useState('');
    const [project, setProject] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const logsRef = ref(db, 'hackathonLogs');
        const unsub = onValue(logsRef, (snapshot) => {
            setLogs(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setEvent(''); setStudent(''); setProject('');
    };

    const handleAddLog = async () => {
        if (!event || !student || !project) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setSaving(true);
        try {
            await push(ref(db, 'hackathonLogs'), { event, student, project });
            toast({ title: 'Log Added' });
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to add log' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        await remove(ref(db, `hackathonLogs/${id}`));
        toast({ title: 'Log removed' });
    }


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Hackathon Participation Logs</CardTitle>
                    <CardDescription>Keep a record of student participation in internal and external hackathons.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>Add Log</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Hackathon Log</DialogTitle></DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-1"><Label>Event Name</Label><Input value={event} onChange={e => setEvent(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Student Name</Label><Input value={student} onChange={e => setStudent(e.target.value)}/></div>
                            <div className="space-y-1"><Label>Project Name</Label><Input value={project} onChange={e => setProject(e.target.value)}/></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleAddLog} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Add Log
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Project</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                        : logs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{log.event}</TableCell>
                                <TableCell>{log.student}</TableCell>
                                <TableCell>{log.project}</TableCell>
                                 <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(log.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
