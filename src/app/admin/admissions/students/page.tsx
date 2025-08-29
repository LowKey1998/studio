
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
import { Search, Printer, User, Mail, Phone, Calendar, Send, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
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

type Programme = {
    id: string;
    name: string;
};

type Intake = {
    id: string;
    name: string;
};

export default function StudentsListPage() {
    const { user, userProfile } = useAuth();
    const [students, setStudents] = React.useState<Student[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    // Filter states
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    
    // Dialog states
    const [selectedStudent, setSelectedStudent] = React.useState<Student | null>(null);
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [isMessageOpen, setIsMessageOpen] = React.useState(false);
    const [messageSubject, setMessageSubject] = React.useState('');
    const [messageBody, setMessageBody] = React.useState('');
    const [sendingMessage, setSendingMessage] = React.useState(false);

    React.useEffect(() => {
        const programmesRef = ref(db, 'programmes');
        const unsubProgs = onValue(programmesRef, (snapshot) => {
            setProgrammes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });
        
        const intakesRef = ref(db, 'intakes');
        const unsubIntakes = onValue(intakesRef, (snapshot) => {
            setIntakes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            const usersData = snapshot.exists() ? snapshot.val() : {};
            const studentList: Student[] = [];
             for (const uid in usersData) {
                if (usersData[uid].role === 'Student') {
                    studentList.push({
                        uid,
                        ...usersData[uid],
                    });
                }
            }
            setStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

        return () => {
            unsubProgs();
            unsubIntakes();
            unsubUsers();
        };
    }, []);
    
    const filteredStudents = React.useMemo(() => {
        return students.map(student => {
            const programmeName = programmes.find(p => p.id === student.programmeId)?.name || 'N/A';
            const intakeName = intakes.find(i => i.id === student.intakeId)?.name || 'N/A';
            return { ...student, programmeName, intakeName };
        }).filter(student => {
            const lowerCaseSearch = searchTerm.toLowerCase();
            const searchMatch = !searchTerm ||
                student.name.toLowerCase().includes(lowerCaseSearch) ||
                student.id.toLowerCase().includes(lowerCaseSearch) ||
                student.email.toLowerCase().includes(lowerCaseSearch) ||
                student.nationalId?.toLowerCase().includes(lowerCaseSearch) ||
                student.passport?.toLowerCase().includes(lowerCaseSearch);

            const programmeMatch = programmeFilter === 'all' || student.programmeId === programmeFilter;
            const intakeMatch = intakeFilter === 'all' || student.intakeId === intakeFilter;
            
            return searchMatch && programmeMatch && intakeMatch;
        });
    }, [students, searchTerm, programmeFilter, intakeFilter, programmes, intakes]);
    
    const handlePrint = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Student List Report", 14, 22);
        doc.setFontSize(11);
        doc.text(`Filters: Programme - ${programmes.find(p=>p.id === programmeFilter)?.name || 'All'}, Intake - ${intakes.find(i=>i.id === intakeFilter)?.name || 'All'}`, 14, 30);
        
        const tableColumn = ["ID", "Name", "Email", "Programme", "Intake"];
        const tableRows = filteredStudents.map(s => [
            s.id,
            s.name,
            s.email,
            s.programmeName,
            s.intakeName
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 35
        });
        
        doc.save(`student_list_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleSendMessage = async () => {
        if (!selectedStudent || !messageSubject || !messageBody || !userProfile) {
            toast({ variant: 'destructive', title: 'Subject and message are required.'});
            return;
        }
        setSendingMessage(true);
        try {
            const emailBody = `
                <p>You have received a message from ${userProfile.name} (${userProfile.id}):</p>
                <br/>
                <p>${messageBody.replace(/\n/g, '<br>')}</p>
            `;

            await sendEmail({
                to: [selectedStudent.email],
                subject: messageSubject,
                body: emailBody,
                log: true,
                userIds: [selectedStudent.uid]
            });
            await createNotification(selectedStudent.uid, `You have a new message from the admin: ${messageSubject}`, '/student/dashboard');
            toast({ title: 'Message Sent', description: `Your message has been sent to ${selectedStudent.name}.` });
            setIsMessageOpen(false);
            setMessageBody('');
            setMessageSubject('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send', description: error.message });
        } finally {
            setSendingMessage(false);
        }
    };
    
    const openDetailDialog = (student: Student) => {
        setSelectedStudent(student);
        setIsDetailOpen(true);
    }

    return (
        <>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><User /> Students List</CardTitle>
                <CardDescription>View, filter, and print lists of all students in the system.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4 p-4 border rounded-lg">
                    <div className="flex-grow">
                        <Label htmlFor="search">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder="Search by name, ID, email..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                         <Label htmlFor="programme-filter">Programme</Label>
                         <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                            <SelectTrigger id="programme-filter"><SelectValue placeholder="Filter by programme..." /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <Label htmlFor="intake-filter">Intake</Label>
                        <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                            <SelectTrigger id="intake-filter"><SelectValue placeholder="Filter by intake..." /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Intakes</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="self-end">
                        <Button onClick={handlePrint} disabled={filteredStudents.length === 0}><Printer className="mr-2 h-4 w-4"/> Print Filtered List</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Programme</TableHead>
                                <TableHead>Intake</TableHead>
                                 <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                 Array.from({ length: 10 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                ))
                            ) : filteredStudents.length > 0 ? (
                                filteredStudents.map(student => (
                                <TableRow key={student.uid} onClick={() => openDetailDialog(student)} className="cursor-pointer">
                                    <TableCell>{student.id}</TableCell>
                                    <TableCell className="font-medium">{student.name}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">{student.email}</div>
                                        <div className="text-xs text-muted-foreground">{student.phoneNumber}</div>
                                    </TableCell>
                                    <TableCell>{student.programmeName}</TableCell>
                                    <TableCell>{student.intakeName}</TableCell>
                                    <TableCell>
                                        {student.isOnline ? 
                                            <span className="flex items-center gap-2 text-xs text-green-600 font-semibold"><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"/>Online</span> : 
                                            <span className="text-xs text-muted-foreground">{student.lastSeen ? formatDistanceToNow(new Date(student.lastSeen), { addSuffix: true }) : 'Offline'}</span>}
                                    </TableCell>
                                </TableRow>
                            ))
                            ) : (
                                 <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">No students found matching your criteria.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                <div className="text-xs text-muted-foreground">
                    Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> students.
                </div>
            </CardFooter>
        </Card>

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{selectedStudent?.name}</DialogTitle>
                    <DialogDescription>{selectedStudent?.id} &middot; {selectedStudent?.programmeName}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2 text-sm">
                    <p><strong className="font-semibold">Email:</strong> {selectedStudent?.email}</p>
                    <p><strong className="font-semibold">Phone:</strong> {selectedStudent?.phoneNumber || 'N/A'}</p>
                    <p><strong className="font-semibold">Intake:</strong> {selectedStudent?.intakeName || 'N/A'}</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
                    <Button onClick={() => { setIsDetailOpen(false); setIsMessageOpen(true); }}><Send className="mr-2 h-4 w-4" />Send Message</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isMessageOpen} onOpenChange={(open) => { if (!open) { setMessageBody(''); setMessageSubject(''); } setIsMessageOpen(open); }}>
             <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Send Message to {selectedStudent?.name}</DialogTitle>
                    <DialogDescription>The message will be sent as an email and an in-app notification.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-1"><Label>Subject</Label><Input value={messageSubject} onChange={e => setMessageSubject(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Body</Label><Textarea value={messageBody} onChange={e => setMessageBody(e.target.value)} rows={8} /></div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsMessageOpen(false)}>Cancel</Button>
                    <Button onClick={handleSendMessage} disabled={sendingMessage}>{sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Send</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
