'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Book, PlusCircle, Loader2, Save, Trash2, Clock, Info } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, serverTimestamp, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type LogEntry = {
    id: string;
    ward: string;
    date: string;
    logText: string;
    status: 'Pending Review' | 'Approved';
    timestamp: number;
};

export default function StudentLogbookPage() {
    const [logs, setLogs] = React.useState<LogEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<any>(null);

    // Form state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [ward, setWard] = React.useState('');
    const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [logText, setLogText] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                onValue(ref(db, `users/${user.uid}`), s => setUserData(s.val()));
            } else setLoading(false);
        });
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        const logsRef = ref(db, `wardLogbooks/${currentUser.uid}`);
        const unsub = onValue(logsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setLogs(Object.entries(data).map(([id, d]: [string, any]) => ({ id, ...d })).sort((a,b) => b.timestamp - a.timestamp));
            } else {
                setLogs([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    const handleSaveEntry = async () => {
        if (!ward || !logText || !currentUser || !userData) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const newRef = push(ref(db, `wardLogbooks/${currentUser.uid}`));
            await set(newRef, {
                studentName: userData.name,
                ward,
                date,
                logText,
                status: 'Pending Review',
                timestamp: serverTimestamp()
            });
            toast({ title: 'Logbook Entry Submitted' });
            setIsDialogOpen(false);
            setWard(''); setLogText('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(!currentUser || !window.confirm("Permanently delete this log entry?")) return;
        await remove(ref(db, `wardLogbooks/${currentUser.uid}/${id}`));
        toast({ title: 'Entry deleted' });
    }

    if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md">
                            <Book className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Clinical Logbook</CardTitle>
                            <CardDescription>Record your clinical skills and ward observations for academic verification.</CardDescription>
                        </div>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="shadow-md"><PlusCircle className="mr-2 h-4 w-4"/> New Entry</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>New Logbook Entry</DialogTitle>
                                <DialogDescription>Document your activities for today's clinical rotation.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Ward / Department</Label>
                                        <Input value={ward} onChange={e => setWard(e.target.value)} placeholder="e.g., Medical Ward 1" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Date</Label>
                                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Observations & Skills Performed</Label>
                                    <Textarea className="min-h-[200px]" value={logText} onChange={e => setLogText(e.target.value)} placeholder="Describe procedures performed, observations made, and case discussions..." />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleSaveEntry} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                                    Submit for Review
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                {logs.length > 0 ? logs.map(log => (
                    <Card key={log.id} className="shadow-sm">
                        <CardHeader className="py-4 border-b bg-muted/10">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="bg-background font-black uppercase text-[10px] tracking-widest">{log.ward}</Badge>
                                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(parseISO(log.date), 'PPP')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={log.status === 'Approved' ? 'default' : 'secondary'}>{log.status}</Badge>
                                    {log.status === 'Pending Review' && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(log.id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">{log.logText}</p>
                        </CardContent>
                    </Card>
                )) : (
                    <div className="py-20 text-center border-2 border-dashed rounded-xl bg-muted/5">
                        <Info className="mx-auto h-12 w-12 opacity-10 mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">Your digital logbook is empty. Click "New Entry" to begin recording your clinical practice.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
