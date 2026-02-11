
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ClipboardCheck, User, Info, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as AuthUser } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, update, onValue, set } from 'firebase/database';
import { format } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export default function StudentAbsenceApprovalsPage() {
    const [pendingRequests, setPendingRequests] = React.useState<StudentLeaveRequest[]>([]);
    const [historyRequests, setHistoryRequests] = React.useState<StudentLeaveRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const requestsRef = ref(db, 'studentLeaveRequests');
        const unsub = onValue(requestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const allRequests: StudentLeaveRequest[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
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

        return () => unsub();
    }, []);

    const handleApproval = async (request: StudentLeaveRequest, decision: 'Approved' | 'Declined') => {
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
                `Your absence request for ${request.courseName} on ${format(new Date(request.leaveDate), 'PPP')} has been ${decision.toLowerCase()} by Academics.`,
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
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Student Absence Approvals</CardTitle>
                    <CardDescription>Review and approve formal absence requests submitted by students for specific classes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {pendingRequests.length > 0 ? (
                        <div className="space-y-4">
                            {pendingRequests.map((request) => (
                                <Card key={request.id} className="overflow-hidden border-primary/20">
                                    <CardHeader className="bg-muted/50 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <CardTitle className="text-lg">{request.studentName} ({request.studentSystemId})</CardTitle>
                                                <CardDescription>Course: {request.courseName} | Requested: {format(new Date(request.dateRequested), 'PPP')}</CardDescription>
                                            </div>
                                            <div className="flex gap-2 self-start sm:self-center">
                                                <Button size="sm" variant="destructive" onClick={() => handleApproval(request, 'Declined')} disabled={!!actionLoading}>{actionLoading === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Decline</Button>
                                                <Button size="sm" onClick={() => handleApproval(request, 'Approved')} disabled={!!actionLoading}>{actionLoading === request.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Approve</Button>
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
                            <h3 className="mt-4 text-lg font-semibold">No Pending Requests</h3>
                            <p className="mt-2 text-sm">All student absence requests have been processed.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-lg mt-8">
                 <CardHeader>
                    <CardTitle className="font-headline text-xl">Approval History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {historyRequests.map(request => (
                            <AccordionItem value={request.id} key={request.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4 text-sm">
                                        <span>{request.studentName} - {request.courseName}</span>
                                        <Badge variant={request.status === 'Approved' ? 'default' : 'destructive'}>{request.status}</Badge>
                                        <span className="hidden sm:inline">{format(new Date(request.leaveDate), 'PPP')}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/20 rounded-md text-sm space-y-2">
                                        <p><strong>Reason:</strong> {request.reason}</p>
                                        <p className="text-xs text-muted-foreground">Submitted: {format(new Date(request.dateRequested), 'PPP p')}</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                        {historyRequests.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">No historical records found.</p>}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
