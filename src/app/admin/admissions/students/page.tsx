
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { db, auth } from "@/lib/firebase";
import { ref, onValue, get } from 'firebase/database';
import { Search, Printer, User, Mail, Phone, Calendar, Send, Loader2, MoreVertical, KeyRound } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { createNotification } from '@/lib/firebase';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';

type Student = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    programmeId?: string;
    programmeName?: string;
    intakeId?: string;
    intakeName?: string;
    nationalId?: string;
    passport?: string;
    isOnline?: boolean;
    lastSeen?: number;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };

export default function StudentsListPage() {
    const { user: adminUser, userProfile: adminProfile } = useAuth();
    const [students, setStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    
    const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
    const [isMessageOpen, setIsMessageOpen] = React.useState(false);
    const [isCredentialsOpen, setIsCredentialsOpen] = React.useState(false);
    const [messageSubject, setMessageSubject] = React.useState('');
    const [messageBody, setMessageBody] = React.useState('');
    const [sendingAction, setSendingAction] = React.useState(false);
    const [credSubject, setCredSubject] = React.useState('Your Portal Login Details');
    const [credBody, setCredBody] = React.useState('');

    React.useEffect(() => {
        const unsubProgs = onValue(ref(db, 'programmes'), (snap) => setProgrammes(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []));
        const unsubIntakes = onValue(ref(db, 'intakes'), (snap) => setIntakes(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []));
        const unsubUsers = onValue(ref(db, 'users'), (snapshot) => {
            const usersData = snapshot.exists() ? snapshot.val() : {};
            const studentList: Student[] = [];
             for (const uid in usersData) {
                if (usersData[uid].role === 'Student') studentList.push({ uid, ...usersData[uid] });
            }
            setStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
            setLoading(false); setTableLoading(false);
        });
        return () => { unsubProgs(); unsubIntakes(); unsubUsers(); };
    }, []);
    
    const filteredStudents = React.useMemo(() => {
        return students.map(student => {
            const programmeName = programmes.find(p => p.id === student.programmeId)?.name || 'N/A';
            const intakeName = intakes.find(i => i.id === student.intakeId)?.name || 'N/A';
            return { ...student, programmeName, intakeName };
        }).filter(student => {
            const lowerCaseSearch = searchTerm.toLowerCase();
            const searchMatch = !searchTerm || student.name.toLowerCase().includes(lowerCaseSearch) || student.id.toLowerCase().includes(lowerCaseSearch) || student.email.toLowerCase().includes(lowerCaseSearch);
            const programmeMatch = programmeFilter === 'all' || student.programmeId === programmeFilter;
            const intakeMatch = intakeFilter === 'all' || student.intakeId === intakeFilter;
            return searchMatch && programmeMatch && intakeMatch;
        });
    }, [students, searchTerm, programmeFilter, intakeFilter, programmes, intakes]);
    
    const handleSendMessage = async () => {
        if (!selectedStudent || !messageSubject || !messageBody || !adminProfile) return;
        setSendingAction(true);
        try {
            await sendEmail({ to: [selectedStudent.email], subject: messageSubject, body: `<p>${messageBody.replace(/\n/g, '<br>')}</p>`, log: true, userIds: [selectedStudent.uid] });
            await createNotification(selectedStudent.uid, `New message: ${messageSubject}`, '/student/dashboard');
            toast({ title: 'Message Sent' }); setIsMessageOpen(false);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed' }); }
        finally { setSendingAction(false); }
    };
    
    const openCredentialsPreview = (user: Student) => {
        setSelectedStudent(user);
        setCredSubject('Your Portal Login Details');
        setCredBody(`<h2>Portal Access</h2><p>Hello ${user.name},</p><p>Access your portal at <a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></p><ul><li><strong>User ID:</strong> ${user.id}</li></ul><p><strong>Note:</strong> If you have login issues, try <strong>12345678</strong> as your temporary password.</p>`);
        setIsCredentialsOpen(true);
    };

    return (
        <>
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle><User className="inline mr-2"/>Students List</CardTitle><CardDescription>Manage student accounts.</CardDescription></div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 border rounded-lg">
                    <div className="flex-grow"><Label>Search</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
                    <div className="flex-1 min-w-[200px]"><Label>Programme</Label><Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger><SelectValue placeholder="All"/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex-1 min-w-[200px]"><Label>Intake</Label><Select value={intakeFilter} onValueChange={setIntakeFilter}><SelectTrigger><SelectValue placeholder="All"/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Programme</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {tableLoading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)) : 
                        filteredStudents.map(student => (
                            <TableRow key={student.uid}>
                                <TableCell className="font-mono text-xs">{student.id}</TableCell>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell className="text-xs">{student.email}</TableCell>
                                <TableCell>{student.programmeName}</TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setSelectedStudent(student); setIsMessageOpen(true); }}><Send className="mr-2 h-4 w-4"/>Message</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openCredentialsPreview(student)}><KeyRound className="mr-2 h-4 w-4"/>Credentials</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}>
             <DialogContent>
                <DialogHeader><DialogTitle>Send Message</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-1"><Label>Subject</Label><Input value={messageSubject} onChange={e => setMessageSubject(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Body</Label><Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={6} /></div>
                </div>
                <DialogFooter><Button onClick={handleSendMessage} disabled={sendingAction}>{sendingAction && <Loader2 className="mr-2 animate-spin"/>}Send</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Preview Credentials Email</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-1"><Label>Subject</Label><Input value={credSubject} onChange={e => setCredSubject(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Body (HTML)</Label><Textarea value={credBody} onChange={e => setCredBody(e.target.value)} rows={10} className="font-mono text-xs" /></div>
                </div>
                <DialogFooter><Button onClick={async () => { setSendingAction(true); try { await sendEmail({ to: [selectedStudent!.email], subject: credSubject, body: credBody }); toast({ title: 'Sent' }); setIsCredentialsOpen(false); } catch(e) { toast({ variant: 'destructive', title: 'Failed' }); } finally { setSendingAction(false); } }} disabled={sendingAction}>{sendingAction && <Loader2 className="mr-2 animate-spin"/>}Send</Button></DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
