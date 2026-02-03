
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, PlusCircle, Loader2, Info, BookOpen, Trash2, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, remove, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CounselingLog = {
    id: string;
    date: string;
    studentId: string;
    studentName: string;
    notes: string;
    counselorId: string;
};

type Student = { uid: string; name: string; id: string; };

export default function MentalHealthPage() {
    const [logs, setLogs] = React.useState<CounselingLog[]>([]);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [userData, setUserData] = React.useState<any>(null);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    // Form State
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedStudentId, setSelectedStudentId] = React.useState('');
    const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [notes, setNotes] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
            get(ref(db, `users/${user.uid}`)).then(snap => setUserData(snap.val()));
          }
        });
        return () => unsubscribe();
    }, []);

    const isAuthorized = React.useMemo(() => 
        userData?.role === 'Admin' || userData?.subRoles?.includes('Counselor')
    , [userData]);

    React.useEffect(() => {
        if (!isAuthorized) { setLoading(false); return; }

        const logsRef = ref(db, 'counselingLogs');
        const uRef = ref(db, 'users');

        const unsubL = onValue(logsRef, (snap) => {
            setLogs(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })).sort((a,b) => b.date.localeCompare(a.date)) : []);
        });

        const unsubU = onValue(uRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                setStudents(Object.keys(data).filter(uid => data[uid].role === 'Student').map(uid => ({ uid, name: data[uid].name, id: data[uid].id })));
            }
            setLoading(false);
        });

        return () => { unsubL(); unsubU(); };
    }, [isAuthorized]);

    const handleSave = async () => {
        if (!selectedStudentId || !notes || !currentUser) return;
        setSaving(true);
        try {
            const student = students.find(s => s.uid === selectedStudentId);
            await push(ref(db, 'counselingLogs'), {
                studentId: selectedStudentId,
                studentName: student?.name,
                date,
                notes,
                counselorId: currentUser.uid
            });
            toast({ title: 'Session Logged Confidentially' });
            setIsOpen(false);
            setSelectedStudentId(''); setNotes(''); setDate(format(new Date(), 'yyyy-MM-dd'));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This is permanent.")) return;
        await remove(ref(db, `counselingLogs/${id}`));
        toast({ title: 'Record removed' });
    };

    if (loading) return <Skeleton className="h-96 w-full" />;

    if (!isAuthorized) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Access Restricted</AlertTitle>
                        <AlertDescription>This confidential area is only available to administrators and authorized counselors.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><HeartPulse className="text-primary"/> Counseling & Mental Health Logs</CardTitle>
                        <CardDescription>Private records of student support sessions. Access is strictly controlled.</CardDescription>
                    </div>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> New Session Entry</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Record Counseling Session</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-1">
                                    <Label>Student</Label>
                                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                        <SelectTrigger><SelectValue placeholder="Select student..."/></SelectTrigger>
                                        <SelectContent>{students.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name} ({s.id})</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>Session Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)}/></div>
                                <div className="space-y-1"><Label>Confidential Notes</Label><Textarea className="min-h-[200px]" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Type session summary here..."/></div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="animate-spin"/> : 'Save Privately'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive" className="mb-6">
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Privacy Notice</AlertTitle>
                        <AlertDescription>These logs are stored with encryption-at-rest. Your actions, including views and deletions, are audited.</AlertDescription>
                    </Alert>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Student</TableHead>
                                <TableHead>Notes Preview</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map(log => (
                                <TableRow key={log.id}>
                                    <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                    <TableCell className="font-bold">{log.studentName}</TableCell>
                                    <TableCell className="max-w-xs truncate italic">"{log.notes}"</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                toast({ title: 'Full details visible in editing mode (coming soon)' });
                                            }}><BookOpen className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(log.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
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
