
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ClipboardCheck, User, Briefcase, Calendar, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, update, onValue, set } from 'firebase/database';
import { format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type StaffLeaveRequest = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  dateRequested: string;
  applicantId: string;
  applicantName: string;
  applicantSystemId: string;
};

type StudentLeaveRequest = {
  id: string;
  courseId: string;
  courseName: string;
  leaveDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  dateRequested: string;
  studentId: string;
  studentName: string;
  studentSystemId: string;
};


export default function LeaveApprovalsPage() {
    const [pendingStaffRequests, setPendingStaffRequests] = React.useState<StaffLeaveRequest[]>([]);
    const [historyStaffRequests, setHistoryStaffRequests] = React.useState<StaffLeaveRequest[]>([]);
    const [pendingStudentRequests, setPendingStudentRequests] = React.useState<StudentLeaveRequest[]>([]);
    const [historyStudentRequests, setHistoryStudentRequests] = React.useState<StudentLeaveRequest[]>([]);

    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<any | null>(null); // Using any to access subRoles

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, (snapshot) => {
                    if(snapshot.exists()) {
                        setCurrentUser(snapshot.val());
                    } else {
                        setLoading(false);
                    }
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [toast]);
    
    const hasPermission = React.useMemo(() => {
        if (!currentUser) return false;
        return currentUser.role === 'Admin' || (currentUser.role === 'Staff' && currentUser.subRoles?.includes('HR'));
    }, [currentUser]);


    React.useEffect(() => {
        if (!hasPermission) {
            setLoading(false);
            return;
        };

        setLoading(true);
        const staffRequestsRef = ref(db, 'leaveRequests');
        const unsubStaff = onValue(staffRequestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const allRequests: StaffLeaveRequest[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                const pending = allRequests.filter(r => r.status === 'Pending').sort((a,b) => new Date(a.dateRequested).getTime() - new Date(b.dateRequested).getTime());
                const history = allRequests.filter(r => r.status !== 'Pending').sort((a,b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime());
                setPendingStaffRequests(pending);
                setHistoryStaffRequests(history);
            } else {
                setPendingStaffRequests([]);
                setHistoryStaffRequests([]);
            }
        });

        const studentRequestsRef = ref(db, 'studentLeaveRequests');
        const unsubStudent = onValue(studentRequestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const allRequests: StudentLeaveRequest[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                const pending = allRequests.filter(r => r.status === 'Pending').sort((a,b) => new Date(a.dateRequested).getTime() - new Date(b.dateRequested).getTime());
                const history = allRequests.filter(r => r.status !== 'Pending').sort((a,b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime());
                setPendingStudentRequests(pending);
                setHistoryStudentRequests(history);
            } else {
                setPendingStudentRequests([]);
                setHistoryStudentRequests([]);
            }
             setLoading(false);
        });


        return () => {
            unsubStaff();
            unsubStudent();
        }
    }, [hasPermission]);
    
    const handleStaffApproval = async (request: StaffLeaveRequest, decision: 'Approved' | 'Declined') => {
        if (!currentUser) return;
        setActionLoading(request.id);
        try {
            await update(ref(db, `leaveRequests/${request.id}`), { status: decision });
            await createNotification(
                request.applicantId,
                `Your leave request for ${format(new Date(request.startDate), 'PPP')} has been ${decision.toLowerCase()}.`,
                '/staff/leave'
            );
            toast({ variant: 'success', title: `Leave Request ${decision}`, description: `${request.applicantName}'s leave has been ${decision.toLowerCase()}.` });
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'An unexpected error occurred.'});
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleStudentApproval = async (request: StudentLeaveRequest, decision: 'Approved' | 'Declined') => {
        if (!currentUser) return;
        setActionLoading(request.id);
        try {
            const requestRef = ref(db, `studentLeaveRequests/${request.id}`);
            await update(requestRef, { status: decision });

            if(decision === 'Approved'){
                const attendanceRef = ref(db, `attendance/${request.courseId}/${request.leaveDate}/${request.studentId}`);
                await set(attendanceRef, 'Excused Absence');
            }

            await createNotification(
                request.studentId,
                `Your absence request for ${request.courseName} on ${format(new Date(request.leaveDate), 'PPP')} has been ${decision.toLowerCase()}.`,
                '/student/leave'
            );

            toast({ variant: 'success', title: `Request ${decision}`, description: `${request.studentName}'s request has been ${decision.toLowerCase()}.` });
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'An unexpected error occurred.'});
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    }
    
    if (!hasPermission) {
         return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>You do not have permission to view this page. This feature is restricted to HR personnel and Administrators.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Leave & Absence Approvals</CardTitle>
                    <CardDescription>Review and approve or decline staff leave and student absence applications.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="staff">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="staff">Staff Leave</TabsTrigger>
                            <TabsTrigger value="students">Student Absence</TabsTrigger>
                        </TabsList>
                        <TabsContent value="staff" className="mt-4">
                            {loading ? <Skeleton className="h-48 w-full" /> : pendingStaffRequests.length > 0 ? (
                                <div className="space-y-4">
                                    {pendingStaffRequests.map((request) => (
                                        <Card key={request.id}><CardHeader className="bg-muted/50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">{request.applicantName} ({request.applicantSystemId})</CardTitle><CardDescription>Type: {request.leaveType} | Submitted: {format(new Date(request.dateRequested), 'PPP')}</CardDescription></div><div className="flex gap-2 self-start sm:self-center"><Button size="sm" variant="destructive" onClick={() => handleStaffApproval(request, 'Declined')} disabled={!!actionLoading}>{actionLoading === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}<span className="hidden sm:inline ml-2">Decline</span></Button><Button size="sm" onClick={() => handleStaffApproval(request, 'Approved')} disabled={!!actionLoading}>{actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve</Button></div></div></CardHeader><CardContent className="p-4"><div className="grid gap-2 text-sm"><div className="font-semibold">Dates: {format(new Date(request.startDate), 'PPP')} to {format(new Date(request.endDate), 'PPP')}</div><p><span className="font-semibold text-muted-foreground">Reason:</span> {request.reason}</p></div></CardContent></Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-16 text-center text-muted-foreground"><ClipboardCheck className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">All Clear!</h3><p className="mt-2 text-sm">There are no pending staff leave requests to review.</p></div>
                            )}
                        </TabsContent>
                         <TabsContent value="students" className="mt-4">
                             {loading ? <Skeleton className="h-48 w-full" /> : pendingStudentRequests.length > 0 ? (
                                <div className="space-y-4">
                                    {pendingStudentRequests.map((request) => (
                                        <Card key={request.id}><CardHeader className="bg-muted/50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-lg">{request.studentName} ({request.studentSystemId})</CardTitle><CardDescription>Course: {request.courseName} | Requested: {format(new Date(request.dateRequested), 'PPP')}</CardDescription></div><div className="flex gap-2 self-start sm:self-center"><Button size="sm" variant="destructive" onClick={() => handleStudentApproval(request, 'Declined')} disabled={!!actionLoading}>{actionLoading === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}<span className="hidden sm:inline ml-2">Decline</span></Button><Button size="sm" onClick={() => handleStudentApproval(request, 'Approved')} disabled={!!actionLoading}>{actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve</Button></div></div></CardHeader><CardContent className="p-4"><div className="grid gap-2 text-sm"><div className="font-semibold">Absence Date: {format(new Date(request.leaveDate), 'PPP')}</div><p><span className="font-semibold text-muted-foreground">Reason:</span> {request.reason}</p></div></CardContent></Card>
                                    ))}
                                </div>
                             ) : (
                                <div className="py-16 text-center text-muted-foreground"><ClipboardCheck className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">All Clear!</h3><p className="mt-2 text-sm">There are no pending student absence requests to review.</p></div>
                             )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Card className="shadow-lg mt-8">
                 <CardHeader>
                    <CardTitle className="font-headline text-2xl">Request History</CardTitle>
                    <CardDescription>A log of all past leave and absence requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="staff-history">
                            <AccordionTrigger><Briefcase className="mr-2 h-4 w-4"/>Staff Leave History</AccordionTrigger>
                            <AccordionContent>
                                {historyStaffRequests.length > 0 ? historyStaffRequests.map(request => (<div key={request.id} className="border-b p-3"><p className="font-semibold">{request.applicantName} - {request.leaveType}</p><p className="text-sm text-muted-foreground">Dates: {format(new Date(request.startDate), 'PPP')} to {format(new Date(request.endDate), 'PPP')}</p><p className={`text-sm font-bold ${request.status === 'Approved' ? 'text-green-600' : 'text-red-600'}`}>{request.status}</p></div>)) : <p className="text-sm text-center p-4">No staff history</p>}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="student-history">
                            <AccordionTrigger><Calendar className="mr-2 h-4 w-4"/>Student Absence History</AccordionTrigger>
                            <AccordionContent>
                                {historyStudentRequests.length > 0 ? historyStudentRequests.map(request => (<div key={request.id} className="border-b p-3"><p className="font-semibold">{request.studentName} - {request.courseName}</p><p className="text-sm text-muted-foreground">Date: {format(new Date(request.leaveDate), 'PPP')}</p><p className={`text-sm font-bold ${request.status === 'Approved' ? 'text-green-600' : 'text-red-600'}`}>{request.status}</p></div>)) : <p className="text-sm text-center p-4">No student history</p>}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
