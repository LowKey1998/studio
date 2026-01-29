
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ClipboardCheck, User, Info, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, update, onValue, query, orderByChild, equalTo, set } from 'firebase/database';
import { format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type LeaveRequest = {
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
  lecturerId: string;
};

type UserData = {
    subRoles?: string[];
}

export default function StudentLeaveApprovalsPage() {
    const [pendingRequests, setPendingRequests] = React.useState<LeaveRequest[]>([]);
    const [historyRequests, setHistoryRequests] = React.useState<LeaveRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<any | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, (snapshot) => {
                    if(snapshot.exists()) {
                        setUserData(snapshot.val());
                    }
                });
            } else { setLoading(false) }
        });
        return () => unsubscribe();
    }, [toast]);

    React.useEffect(() => {
        if (!currentUser) return;

        setLoading(true);
        const requestsRef = query(ref(db, 'studentLeaveRequests'), orderByChild('lecturerId'), equalTo(currentUser.uid));
        const unsubscribe = onValue(requestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const allRequests: LeaveRequest[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                const pending = allRequests.filter(r => r.status === 'Pending').sort((a,b) => new Date(a.dateRequested).getTime() - new Date(b.dateRequested).getTime());
                const history = allRequests.filter(r => r.status !== 'Pending').sort((a,b) => new Date(b.dateRequested).getTime() - new Date(a.dateRequested).getTime());
                setPendingRequests(pending);
                setHistoryRequests(history);
            } else {
                setPendingRequests([]);
                setHistoryRequests([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);
    
    const handleApproval = async (request: LeaveRequest, decision: 'Approved' | 'Declined') => {
        if (!currentUser) return;
        setActionLoading(request.id);

        try {
            const requestRef = ref(db, `studentLeaveRequests/${request.id}`);
            await update(requestRef, { status: decision });

            // Mark attendance as 'Excused Absence' if approved
            if(decision === 'Approved'){
                const attendanceRef = ref(db, `attendance/${request.courseId}/${request.leaveDate}/${request.studentId}`);
                await set(attendanceRef, 'Excused Absence');
            }

            await createNotification(
                request.studentId,
                `Your absence request for ${request.courseName} on ${format(new Date(request.leaveDate), 'PPP')} has been ${decision.toLowerCase()}.`,
                '/student/leave'
            );

            toast({
                variant: 'success',
                title: `Request ${decision}`,
                description: `${request.studentName}'s request has been ${decision.toLowerCase()}.`,
            });
            // State will update automatically via onValue listener
        } catch(error: any) {
             toast({
                variant: 'destructive',
                title: 'Action Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setActionLoading(null);
        }
    };
    
    if (loading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    }

    if (!userData?.subRoles?.includes('Lecturer')) {
        return (
             <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>This page is only available to lecturers.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Approve Student Absences</CardTitle>
                    <CardDescription>Review and approve or decline student absence requests for your courses.</CardDescription>
                </CardHeader>
                <CardContent>
                     {pendingRequests.length > 0 ? (
                        <div className="space-y-4">
                            {pendingRequests.map((request) => (
                                <Card key={request.id} className="overflow-hidden">
                                    <CardHeader className="bg-muted/50 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <CardTitle className="text-lg">{request.studentName} ({request.studentSystemId})</CardTitle>
                                                <CardDescription>
                                                   Course: {request.courseName} | Requested: {format(new Date(request.dateRequested), 'PPP')}
                                                </CardDescription>
                                            </div>
                                            <div className="flex gap-2 self-start sm:self-center">
                                                <Button 
                                                    size="sm" 
                                                    variant="destructive"
                                                    onClick={() => handleApproval(request, 'Declined')}
                                                    disabled={!!actionLoading}
                                                >
                                                     {actionLoading === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                     <span className="hidden sm:inline ml-2">Decline</span>
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleApproval(request, 'Approved')}
                                                    disabled={!!actionLoading}
                                                >
                                                    {actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                                    Approve
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="grid gap-2 text-sm">
                                            <div className="font-semibold">Absence Date: {format(new Date(request.leaveDate), 'PPP')}</div>
                                            <p><span className="font-semibold text-muted-foreground">Reason:</span> {request.reason}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                         <div className="py-16 text-center text-muted-foreground">
                            <ClipboardCheck className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">All Clear!</h3>
                            <p className="mt-2 text-sm">There are no pending absence requests to review.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-lg mt-8">
                 <CardHeader>
                    <CardTitle className="font-headline text-2xl">Request History</CardTitle>
                    <CardDescription>A log of all past absence requests for your courses.</CardDescription>
                </CardHeader>
                <CardContent>
                    {historyRequests.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {historyRequests.map(request => (
                                <AccordionItem value={request.id} key={request.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full pr-4 text-sm">
                                            <span>{request.studentName} - {request.courseName}</span>
                                            <span className={request.status === 'Approved' ? 'text-green-600' : 'text-red-600'}>{request.status}</span>
                                            <span>{format(new Date(request.leaveDate), 'PPP')}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="grid gap-2 text-sm p-4 bg-muted/50 rounded-md">
                                            <p><span className="font-semibold">Student:</span> {request.studentName} ({request.studentSystemId})</p>
                                            <p><span className="font-semibold">Date Requested:</span> {format(new Date(request.dateRequested), 'PPP')}</p>
                                            <p><span className="font-semibold">Reason:</span> {request.reason}</p>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                         <div className="py-16 text-center text-muted-foreground">
                            <User className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No History</h3>
                            <p className="mt-2 text-sm">There are no approved or declined requests yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
