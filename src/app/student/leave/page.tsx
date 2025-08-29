
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, isSameDay, getDay, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type LeaveRequest = {
  id: string;
  courseId: string;
  courseName: string;
  leaveDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  dateRequested: string;
  studentId: string; // The user's UID
  studentName: string;
  studentSystemId: string; // The user's STU-XXX ID
  lecturerId: string;
};

type UserData = {
    id: string;
    name: string;
    role: 'Student';
}

type Course = {
    id: string;
    name: string;
    lecturerId: string;
};

type TimetableEntry = {
    day: string; // "Monday", "Tuesday", etc.
};

type ClassOverride = {
    originalDate: string;
    newDate?: string;
    status: 'rescheduled' | 'cancelled';
};


const statusVariant: { [key in LeaveRequest['status']]: 'destructive' | 'secondary' | 'default' } = {
  Pending: 'secondary',
  Approved: 'default',
  Declined: 'destructive',
};
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


export default function StudentLeavePage() {
    const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
    const [enrolledCourses, setEnrolledCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    // Form state
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [leaveDate, setLeaveDate] = React.useState<Date | undefined>();
    const [reason, setReason] = React.useState('');
    const [validDates, setValidDates] = React.useState<Date[]>([]);


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
        if (!currentUser) return;

        const fetchInitialData = async () => {
             setLoading(true);
             try {
                // Fetch enrolled courses
                const registrationsRef = ref(db, `registrations/${currentUser.uid}`);
                const regsSnapshot = await get(registrationsRef);
                const courseIds = new Set<string>();
                if(regsSnapshot.exists()){
                    Object.values(regsSnapshot.val()).forEach((reg: any) => {
                        if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                            reg.courses.forEach((id: string) => courseIds.add(id));
                        }
                    });
                }
                const coursesRef = ref(db, 'courses');
                const coursesSnap = await get(coursesRef);
                if(coursesSnap.exists()){
                    const allCourses = coursesSnap.val();
                    const enrolled = Array.from(courseIds).map(id => ({ id, ...allCourses[id]}));
                    setEnrolledCourses(enrolled);
                }

                // Fetch leave requests
                const requestsRef = query(ref(db, 'studentLeaveRequests'), orderByChild('studentId'), equalTo(currentUser.uid));
                onValue(requestsRef, (snapshot) => {
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

             } catch(e) { console.error(e); setLoading(false); }
        };
        fetchInitialData();
    }, [currentUser]);

    // Calculate valid dates for absence request when a course is selected
    React.useEffect(() => {
        if (!selectedCourseId || !currentUser) {
            setValidDates([]);
            return;
        }

        const calculateValidDates = async () => {
            const today = new Date();
            const startOfCurrentMonth = startOfMonth(today);
            const endOfNextMonth = endOfMonth(new Date(today.getFullYear(), today.getMonth() + 2, 1)); 

            const [timetableSnap, overridesSnap, regsSnap] = await Promise.all([
                get(ref(db, 'timetables')),
                get(ref(db, `classOverrides/${selectedCourseId}`)),
                get(ref(db, `registrations/${currentUser.uid}`))
            ]);

            const semesterId = Object.keys(regsSnap.val() || {}).find(semId => regsSnap.val()[semId].courses.includes(selectedCourseId));
            if (!semesterId) { setValidDates([]); return; }
            
            const timetableData = timetableSnap.val()?.[semesterId]?.[selectedCourseId];
            const overridesData: Record<string, ClassOverride> = overridesSnap.val() || {};
            const recurringDays: number[] = Object.values(timetableData || {}).map((entry: any) => daysOfWeek.indexOf(entry.day)).filter(d => d !== -1);
            
            const possibleDates = eachDayOfInterval({ start: startOfCurrentMonth, end: endOfNextMonth });
            const validClassDates: Date[] = [];
            
            possibleDates.forEach(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const override = overridesData[dateStr];
                
                if (override?.status === 'cancelled') return;
                
                if (Object.values(overridesData).some(ov => ov.status === 'rescheduled' && ov.originalDate === dateStr)) {
                    return;
                }
                
                if (recurringDays.includes(getDay(date)) && !override) {
                    validClassDates.push(date);
                }
                
                if (Object.values(overridesData).some(ov => ov.status === 'rescheduled' && ov.newDate === dateStr)) {
                    validClassDates.push(date);
                }
            });
            
            setValidDates(validClassDates);
        };

        calculateValidDates();
    }, [selectedCourseId, currentUser]);


    const resetForm = () => {
        setSelectedCourseId('');
        setLeaveDate(undefined);
        setReason('');
    };
    
    const handleApplyForLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCourseId || !leaveDate || !reason || !currentUser || !userData) {
            toast({ variant: 'destructive', title: 'Missing Fields' });
            return;
        }

        const selectedCourse = enrolledCourses.find(c => c.id === selectedCourseId);
        if (!selectedCourse) {
             toast({ variant: 'destructive', title: 'Invalid Course' });
             return;
        }

        setFormLoading(true);
        try {
            const newRequestRef = push(ref(db, 'studentLeaveRequests'));
            await set(newRequestRef, {
                courseId: selectedCourse.id,
                courseName: selectedCourse.name,
                leaveDate: format(leaveDate, 'yyyy-MM-dd'),
                reason,
                status: 'Pending',
                dateRequested: new Date().toISOString(),
                studentId: currentUser.uid,
                studentName: userData.name,
                studentSystemId: userData.id,
                lecturerId: selectedCourse.lecturerId,
            });
            
            await createNotification(
                selectedCourse.lecturerId,
                `${userData.name} requested absence for ${selectedCourse.name} on ${format(leaveDate, 'PPP')}.`,
                '/staff/student-absences'
            );

            toast({ variant: 'success', title: 'Request Submitted', description: 'Your request for absence has been sent to your lecturer.' });
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
                        <CardTitle className="font-headline text-2xl">Absence Requests</CardTitle>
                        <CardDescription>Request absence from a class and track the status of your requests.</CardDescription>
                    </div>
                     <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if(!isOpen) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Request Absence</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <form onSubmit={handleApplyForLeave}>
                                <DialogHeader>
                                    <DialogTitle className="font-headline">New Absence Request</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="course">Course</Label>
                                        <Select onValueChange={setSelectedCourseId} value={selectedCourseId} disabled={formLoading}>
                                            <SelectTrigger id="course">
                                                <SelectValue placeholder="Select a course" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {enrolledCourses.map(course => (
                                                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="leaveDate">Date of Absence</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                id="leaveDate"
                                                variant={'outline'}
                                                className={cn( 'w-full justify-start text-left font-normal', !leaveDate && 'text-muted-foreground' )}
                                                disabled={formLoading || !selectedCourseId}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {leaveDate ? format(leaveDate, 'PPP') : <span>Pick a class date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar 
                                                    mode="single" 
                                                    selected={leaveDate} 
                                                    onSelect={setLeaveDate} 
                                                    initialFocus 
                                                    disabled={(date) => isBefore(date, new Date()) || !validDates.some(validDate => isSameDay(validDate, date))}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="reason">Reason for Absence</Label>
                                        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={formLoading} placeholder="Provide a brief reason..."/>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                                    <Button type="submit" disabled={formLoading}>
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
                                <TableHead>Course</TableHead>
                                <TableHead>Absence Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 3}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : leaveRequests.length > 0 ? (
                                leaveRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{format(new Date(req.dateRequested), 'PPP')}</TableCell>
                                        <TableCell>{req.courseName}</TableCell>
                                        <TableCell>{format(new Date(req.leaveDate), 'PPP')}</TableCell>
                                        <TableCell><Badge variant={statusVariant[req.status]}>{req.status}</Badge></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Briefcase className="h-12 w-12 text-muted-foreground" />
                                            <p className="text-muted-foreground">You have no absence requests.</p>
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
