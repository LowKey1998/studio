
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
import { Loader2, PlusCircle, Calendar as CalendarIcon, Briefcase } from 'lucide-react';
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
import { format, differenceInCalendarDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type LeaveRequest = {
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Declined';
    dateRequested: string;
    applicantId: string;
    applicantName: string;
};

type UserData = {
    id: string;
    name: string;
    role: 'Staff';
}

type TimetableEntry = {
    day: string;
    courseCode: string;
};

const statusVariant: { [key in LeaveRequest['status']]: 'destructive' | 'secondary' | 'default' } = {
  Pending: 'secondary',
  Approved: 'default',
  Declined: 'destructive',
};

const leaveTypes = ["Annual", "Sick", "Maternity", "Paternity", "Unpaid", "Bereavement"];
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


export default function LeavePage() {
    const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [maxLeaveDays, setMaxLeaveDays] = React.useState<number | null>(null);
    const [timetable, setTimetable] = React.useState<TimetableEntry[]>([]);
    const [conflictingClasses, setConflictingClasses] = React.useState<TimetableEntry[]>([]);


    // Form state
    const [leaveType, setLeaveType] = React.useState('');
    const [dateRange, setDateRange] = React.useState<{from: Date | undefined, to: Date | undefined}>({ from: undefined, to: undefined });
    const [reason, setReason] = React.useState('');

    const { toast } = useToast();
    
     React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if(snapshot.exists()) {
                setUserData(snapshot.val());
            }
          }
        });
        return () => unsubscribe();
      }, []);

    React.useEffect(() => {
        const fetchInitialData = async () => {
             if (!currentUser) return;
             setLoading(true);
             try {
                // Fetch leave policy
                const policyRef = ref(db, 'settings/leavePolicy/maxDays');
                const policySnap = await get(policyRef);
                setMaxLeaveDays(policySnap.exists() ? policySnap.val() : 14);

                // Fetch lecturer's timetable
                const coursesRef = ref(db, 'courses');
                const coursesSnap = await get(coursesRef);
                const assignedCourseIds: string[] = [];
                if (coursesSnap.exists()) {
                    Object.entries(coursesSnap.val()).forEach(([id, course]: [string, any]) => {
                        if (course.lecturerId === currentUser.uid) assignedCourseIds.push(id);
                    });
                }

                const timetablesRef = ref(db, 'timetables');
                const timetablesSnap = await get(timetablesRef);
                const userTimetable: TimetableEntry[] = [];
                if (timetablesSnap.exists()) {
                    const allTimetables = timetablesSnap.val();
                     for (const semester in allTimetables) {
                        for (const courseId in allTimetables[semester]) {
                            if (assignedCourseIds.includes(courseId)) {
                                Object.values(allTimetables[semester][courseId]).forEach((entry: any) => {
                                    userTimetable.push({ day: entry.day, courseCode: coursesSnap.val()[courseId].code });
                                });
                            }
                        }
                    }
                }
                setTimetable(userTimetable);

             } catch(e) { console.error(e) }
             finally { setLoading(false) }
        };

        fetchInitialData();

        if (!currentUser) return;
        setLoading(true);
        const requestsRef = query(ref(db, 'leaveRequests'), orderByChild('applicantId'), equalTo(currentUser.uid));
        const unsubscribe = onValue(requestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const requestsList: LeaveRequest[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime());
                setLeaveRequests(requestsList);
            } else {
                setLeaveRequests([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const resetForm = () => {
        setLeaveType('');
        setDateRange({ from: undefined, to: undefined });
        setReason('');
        setConflictingClasses([]);
    };
    
    const requestedDays = React.useMemo(() => {
        if (dateRange.from && dateRange.to) {
            return differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
        }
        return 0;
    }, [dateRange]);

    React.useEffect(() => {
        if (dateRange.from && dateRange.to && timetable.length > 0) {
            const leaveDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
            const conflicts: TimetableEntry[] = [];
            leaveDays.forEach(day => {
                const dayOfWeek = daysOfWeek[day.getDay()];
                const classesOnDay = timetable.filter(t => t.day === dayOfWeek);
                if(classesOnDay.length > 0) {
                     conflicts.push(...classesOnDay.map(c => ({...c, day: format(day, 'PPP')})));
                }
            });
            setConflictingClasses(conflicts);
        } else {
            setConflictingClasses([]);
        }
    }, [dateRange, timetable]);

    const isRequestValid = maxLeaveDays === null || requestedDays <= maxLeaveDays;


    const handleApplyForLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!leaveType || !dateRange.from || !reason || !currentUser || !userData) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required fields.' });
            return;
        }
        
        if (!isRequestValid) {
            toast({ variant: 'destructive', title: 'Invalid Request', description: `Your leave request exceeds the maximum of ${maxLeaveDays} days.` });
            return;
        }

        setFormLoading(true);
        try {
            const newRequestRef = push(ref(db, 'leaveRequests'));
            await set(newRequestRef, {
                leaveType,
                startDate: format(dateRange.from, 'yyyy-MM-dd'),
                endDate: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd'),
                reason,
                status: 'Pending',
                dateRequested: new Date().toISOString(),
                applicantId: currentUser.uid,
                applicantName: userData.name,
                applicantSystemId: userData.id
            });
            
            // Notify HR
            const usersRef = ref(db, 'users');
            const usersSnapshot = await get(usersRef);
            if(usersSnapshot.exists()){
                const users = usersSnapshot.val();
                const hrIds = Object.keys(users).filter(uid => users[uid].role === 'Staff' && users[uid].subRoles?.includes('HR'));
                const notificationPromises = hrIds.map(id => 
                    createNotification(
                        id,
                        `${userData.name} has submitted a new leave request.`,
                        '/admin/leave-approvals'
                    )
                );
                await Promise.all(notificationPromises);
            }

            toast({ variant: 'success', title: 'Leave Request Submitted', description: 'Your request has been sent for approval.' });
            resetForm();
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">Leave Management</CardTitle>
                        <CardDescription>Apply for leave and track the status of your requests.</CardDescription>
                    </div>
                     <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if(!isOpen) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Apply for Leave</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <form onSubmit={handleApplyForLeave}>
                                <DialogHeader>
                                    <DialogTitle className="font-headline">New Leave Application</DialogTitle>
                                    <DialogDescription>Fill out the form below to request time off.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="leaveType">Leave Type</Label>
                                        <Select onValueChange={setLeaveType} value={leaveType} disabled={formLoading}>
                                            <SelectTrigger id="leaveType">
                                                <SelectValue placeholder="Select a leave type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {leaveTypes.map(type => (
                                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="dateRange">Start & End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                id="dateRange"
                                                variant={'outline'}
                                                className={cn( 'w-full justify-start text-left font-normal', !dateRange.from && 'text-muted-foreground' )}
                                                disabled={formLoading}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateRange.from ? 
                                                    (dateRange.to ? 
                                                        `${format(dateRange.from, 'PPP')} - ${format(dateRange.to, 'PPP')}` 
                                                        : format(dateRange.from, 'PPP')) 
                                                    : <span>Pick a date range</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        {requestedDays > 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                Total days: {requestedDays}
                                            </p>
                                        )}
                                        {!isRequestValid && maxLeaveDays !== null && (
                                            <Alert variant="destructive" className="mt-2">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Duration Exceeds Limit</AlertTitle>
                                                <AlertDescription>
                                                    The maximum leave duration is {maxLeaveDays} days. Please adjust your selection.
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                        {conflictingClasses.length > 0 && (
                                            <Alert variant="destructive" className="mt-2">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Timetable Conflict</AlertTitle>
                                                <AlertDescription>
                                                    This leave conflicts with scheduled classes. Please ensure they are rescheduled.
                                                    <ul className="list-disc pl-5 mt-1 text-xs">
                                                        {conflictingClasses.slice(0, 3).map((c, i) => <li key={i}>{c.courseCode} on {c.day}</li>)}
                                                         {conflictingClasses.length > 3 && <li>and {conflictingClasses.length - 3} more...</li>}
                                                    </ul>
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="reason">Reason / Comments</Label>
                                        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={formLoading} placeholder="Provide a brief reason for your leave request..."/>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                    <Button type="submit" disabled={formLoading || !isRequestValid || requestedDays === 0}>
                                        {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Submit Request'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date Requested</TableHead>
                                <TableHead>Leave Type</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 3}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : leaveRequests.length > 0 ? (
                                leaveRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{format(new Date(req.dateRequested), 'PPP')}</TableCell>
                                        <TableCell>{req.leaveType}</TableCell>
                                        <TableCell>{format(new Date(req.startDate), 'PPP')} - {format(new Date(req.endDate), 'PPP')}</TableCell>
                                        <TableCell><Badge variant={statusVariant[req.status]}>{req.status}</Badge></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Briefcase className="h-12 w-12 text-muted-foreground" />
                                            <p className="text-muted-foreground">You have no past leave requests.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

