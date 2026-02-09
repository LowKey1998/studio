'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Calendar as CalendarIcon, Briefcase, Info, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, get, set, push, query, orderByChild, equalTo, onValue } from 'firebase/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, isSameDay, getDay, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type LeaveRequest = { id: string; courseId: string; courseName: string; leaveDate: string; reason: string; status: 'Pending' | 'Approved' | 'Declined'; dateRequested: string; studentId: string; studentName: string; studentSystemId: string; lecturerId: string; };
type UserData = { id: string; name: string; role: 'Student'; }
type Course = { id: string; name: string; lecturerId: string; };
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StudentLeavePage() {
    const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
    const [enrolledCourses, setEnrolledCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [leaveDate, setLeaveDate] = React.useState<Date | undefined>();
    const [reason, setReason] = React.useState('');
    const { toast } = useToast();
    
    React.useEffect(() => {
        onAuthStateChanged(auth, user => { if (user) { setCurrentUser(user); get(ref(db, `users/${user.uid}`)).then(s => setUserData(s.val())); } else setLoading(false); });
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        const fetchData = async () => {
             setLoading(true);
             try {
                const rSnap = await get(ref(db, `registrations/${currentUser.uid}`));
                const cIds = new Set<string>();
                if(rSnap.exists()) Object.values(rSnap.val()).forEach((reg: any) => { if (reg.status === 'Completed' || reg.status === 'Pending Payment') reg.courses.forEach((id: string) => cIds.add(id)); });
                const cSnap = await get(ref(db, 'courses'));
                if(cSnap.exists()) setEnrolledCourses(Array.from(cIds).map(id => ({ id, ...cSnap.val()[id]})));
                onValue(query(ref(db, 'studentLeaveRequests'), orderByChild('studentId'), equalTo(currentUser.uid)), (snapshot) => {
                    setLeaveRequests(snapshot.exists() ? Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] })).sort((a, b) => b.dateRequested.localeCompare(a.dateRequested)) : []);
                    setLoading(false);
                });
             } catch(e) { setLoading(false); }
        };
        fetchData();
    }, [currentUser]);

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourseId || !leaveDate || !reason || !currentUser || !userData) return;
        const course = enrolledCourses.find(c => c.id === selectedCourseId);
        if (!course) return;
        setFormLoading(true);
        try {
            await set(push(ref(db, 'studentLeaveRequests')), { courseId: course.id, courseName: course.name, leaveDate: format(leaveDate, 'yyyy-MM-dd'), reason, status: 'Pending', dateRequested: new Date().toISOString(), studentId: currentUser.uid, studentName: userData.name, studentSystemId: userData.id, lecturerId: course.lecturerId });
            toast({ title: 'Submitted' }); setIsDialogOpen(false); setReason(''); setLeaveDate(undefined);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed' }); }
        finally { setFormLoading(false); }
    };

    return (
        <div className="space-y-6">
            <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Absence Requests</CardTitle><CardDescription>Manage your requests.</CardDescription></div><Button onClick={()=>setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Request Absence</Button></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Date Requested</TableHead><TableHead>Course</TableHead><TableHead>Absence Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow> :
                             leaveRequests.map(req => (<TableRow key={req.id}><TableCell>{format(new Date(req.dateRequested), 'PPP')}</TableCell><TableCell>{req.courseName}</TableCell><TableCell>{format(new Date(req.leaveDate), 'PPP')}</TableCell><TableCell><Badge>{req.status}</Badge></TableCell></TableRow>))
                            }
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}><DialogContent><form onSubmit={handleApply}><DialogHeader><DialogTitle>New Request</DialogTitle></DialogHeader><div className="space-y-4 py-4"><Select onValueChange={setSelectedCourseId}><SelectTrigger><SelectValue placeholder="Select course"/></SelectTrigger><SelectContent>{enrolledCourses.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Input type="date" onChange={e=>setLeaveDate(new Date(e.target.value))} /><Textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason..."/></div><DialogFooter><Button type="submit">Submit</Button></DialogFooter></form></DialogContent></Dialog>
        </div>
    );
}