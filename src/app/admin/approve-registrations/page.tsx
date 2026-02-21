'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    UserCheck, 
    Check, 
    X, 
    ClipboardCheck, 
    GraduationCap, 
    AlertCircle, 
    Edit, 
    Save, 
    CheckCircle2, 
    History, 
    AlertTriangle, 
    ArrowRight,
    UserMinus,
    Info,
    CalendarDays
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, get, update, remove, set, serverTimestamp, push } from 'firebase/database';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
    DialogClose 
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { syncInvoiceToQuickbooks } from '@/ai/flows/sync-to-quickbooks';
import { syncInvoiceToSage } from '@/ai/flows/sync-to-sage';

type RegistrationRequest = {
  userId: string;
  semesterId: string;
  semesterName: string;
  studentName: string;
  studentId: string;
  studentIntakeId: string;
  courseIds: string[];
  invoiceId: string;
  registrationDate: string;
  status: 'Pending Approval' | 'Pending Payment' | 'Completed';
  applyScholarship?: boolean;
  scholarshipStatus?: 'Approved' | 'Denied';
  programmeId: string;
  programmeName: string;
  optionalFees: string[];
  academicHistory: Record<string, 'Passed' | 'Failed'>;
  amountPaid: number;
};

type GroupedRequests = Record<string, RegistrationRequest[]>;

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
    year: number;
}

type Fee = {
    id: string;
    name: string;
    amount: number;
}

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

type CurrentAdmin = { name: string; id: string; };

export default function ApproveRegistrationsPage() {
    const [pendingRequests, setPendingRequests] = React.useState<GroupedRequests>({});
    const [approvedRequests, setApprovedRequests] = React.useState<GroupedRequests>({});
    const [completedRequests, setCompletedRequests] = React.useState<GroupedRequests>({});
    const [allCourses, setAllCourses] = React.useState<Map<string, Course>>(new Map());
    const [allProgrammes, setAllProgrammes] = React.useState<Map<string, any>>(new Map());
    const [allSemesters, setAllSemesters] = React.useState<Map<string, any>>(new Map());
    const [allIntakes, setAllIntakes] = React.useState<Map<string, any>>(new Map());
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [allOptionalFees, setAllOptionalFees] = React.useState<Map<string, Fee>>(new Map());
    const [allMandatoryFees, setAllMandatoryFees] = React.useState<Map<string, Fee>>(new Map());
    const [enrollmentPolicy, setEnrollmentPolicy] = React.useState('onFullPayment');
    
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null); 
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    const [activeTab, setActiveTab] = React.useState('pending');

    const [editingSelections, setEditingSelections] = React.useState<Record<string, string[]>>({});
    const [scholarshipReviewRequest, setScholarshipReviewRequest] = React.useState<RegistrationRequest | null>(null);
    const [timetablePreview, setTimetablePreview] = React.useState<string[]>([]);
    
    const [isQuickBooksEnabled, setIsQuickBooksEnabled] = React.useState(false);
    const [isSageEnabled, setIsSageEnabled] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
             if (user) {
                const userRef = ref(db, `users/${user.uid}`);
                const snapshot = await get(userRef);
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    setCurrentAdmin({ name: userData.name, id: userData.id });
                }
             }
        });
        return () => unsubscribe();
    }, []);

    const fetchRequests = React.useCallback(async () => {
        setLoading(true);
        try {
            const [coursesSnap, programmesSnap, optionalFeesSnap, mandatoryFeesSnap, registrationsSnap, settingsSnap, semestersSnap, intakesSnap, coursePathsSnap, assessmentsSnap, transactionsSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'programmes')),
                get(ref(db, 'optionalFees')),
                get(ref(db, 'mandatoryFees')),
                get(ref(db, 'registrations')),
                get(ref(db, 'settings')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'assessments')),
                get(ref(db, 'transactions')),
            ]);
            
            if (settingsSnap.exists()) {
                const settingsData = settingsSnap.val();
                setEnrollmentPolicy(settingsData.enrollmentPolicy || 'onFullPayment');
                setIsQuickBooksEnabled(settingsData.integrations?.quickbooks?.enabled);
                setIsSageEnabled(settingsData.integrations?.sage?.enabled);
            }

            const coursesData = new Map<string, Course>();
            if (coursesSnap.exists()) Object.entries(coursesSnap.val()).forEach(([id, data]) => coursesData.set(id, { id, ...(data as Omit<Course, 'id'>) }));
            setAllCourses(coursesData);
            
            const programmesData = new Map<string, any>();
            if(programmesSnap.exists()) Object.entries(programmesSnap.val()).forEach(([id, data]) => programmesData.set(id, {id, ...(data as any)}));
            setAllProgrammes(programmesData);

            const semestersData = new Map<string, any>();
            if(semestersSnap.exists()) Object.entries(semestersSnap.val()).forEach(([id, data]) => semestersData.set(id, {id, ...(data as any)}));
            setAllSemesters(semestersData);
            
            const intakesData = new Map<string, any>();
            if(intakesSnap.exists()) Object.entries(intakesSnap.val()).forEach(([id, data]) => intakesData.set(id, {id, ...(data as any)}));
            setAllIntakes(intakesData);
            
            if(coursePathsSnap.exists()) setAllCoursePaths(Object.values(coursePathsSnap.val()));

            const optionalFeesData = new Map<string, Fee>();
            if (optionalFeesSnap.exists()) Object.entries(optionalFeesSnap.val()).forEach(([id, data]) => optionalFeesData.set(id, { id, ...(data as Omit<Fee, 'id'>) }));
            setAllOptionalFees(optionalFeesData);

            const mandatoryFeesData = new Map<string, Fee>();
            if (mandatoryFeesSnap.exists()) Object.entries(mandatoryFeesSnap.val()).forEach(([id, data]) => mandatoryFeesData.set(id, { id, ...(data as Omit<Fee, 'id'>) }));
            setAllMandatoryFees(mandatoryFeesData);
            
            const assessmentsData = assessmentsSnap.exists() ? assessmentsSnap.val() : {};
            const allTransactions = transactionsSnap.exists() ? Object.values(transactionsSnap.val() as Record<string, any>) : [];

            if (!registrationsSnap.exists()) { setLoading(false); return; }

            const allRegistrations = registrationsSnap.val();
            const pending: RegistrationRequest[] = [], approved: RegistrationRequest[] = [], completed: RegistrationRequest[] = [];
            const userPromises: Promise<any>[] = [];

            for (const userId in allRegistrations) {
                const userRegistrations = allRegistrations[userId];
                for (const semesterId in userRegistrations) {
                    const registration = userRegistrations[semesterId];
                    if (['Pending Approval', 'Pending Payment', 'Completed'].includes(registration.status)) {
                         userPromises.push(get(ref(db, `users/${userId}`)).then(userSnapshot => {
                             if(userSnapshot.exists()){
                                 const userData = userSnapshot.val();
                                 const academicHistory: Record<string, 'Passed' | 'Failed'> = {};
                                 
                                 for (const prevSemesterId in userRegistrations) {
                                     if(prevSemesterId === semesterId) continue;
                                     const prevReg = userRegistrations[prevSemesterId];
                                     if(prevReg.status === 'Completed') {
                                         (prevReg.courses || []).forEach((courseId: string) => {
                                             const finalExam = assessmentsData[courseId]?.[userId]?.finalExam?.score;
                                             academicHistory[courseId] = (finalExam !== undefined && finalExam >= 50) ? 'Passed' : 'Failed';
                                         });
                                     }
                                 }

                                 const amountPaid = allTransactions
                                    .filter(tx => tx.userId === userId && tx.invoiceId === registration.invoiceId && tx.status === 'successful')
                                    .reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

                                 const requestData: RegistrationRequest = {
                                    userId,
                                    semesterId: semesterId,
                                    semesterName: semestersData.get(semesterId)?.name || 'Unknown Semester',
                                    studentName: userData.name,
                                    studentId: userData.id,
                                    studentIntakeId: userData.intakeId,
                                    courseIds: registration.courses || [],
                                    invoiceId: registration.invoiceId,
                                    registrationDate: registration.registrationDate,
                                    status: registration.status,
                                    applyScholarship: registration.applyScholarship || false,
                                    scholarshipStatus: registration.scholarshipStatus,
                                    programmeId: registration.programmeId,
                                    programmeName: programmesData.get(registration.programmeId)?.name || 'Unknown Programme',
                                    optionalFees: registration.optionalFees || [],
                                    academicHistory,
                                    amountPaid
                                };
                                if (registration.status === 'Pending Approval') pending.push(requestData);
                                else if (registration.status === 'Pending Payment') approved.push(requestData);
                                else completed.push(requestData);
                             }
                         }));
                    }
                }
            }
            
            await Promise.all(userPromises);
            
            const groupRequests = (requests: RegistrationRequest[]): GroupedRequests => requests.reduce((acc, req) => {
                const key = req.semesterName;
                if (!acc[key]) acc[key] = [];
                acc[key].push(req);
                acc[key].sort((a,b) => new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime());
                return acc;
            }, {} as GroupedRequests);

            setPendingRequests(groupRequests(pending));
            setApprovedRequests(groupRequests(approved));
            setCompletedRequests(groupRequests(completed));

            const initialEdits: Record<string, string[]> = {};
            [...pending, ...approved, ...completed].forEach(req => {
                initialEdits[`${req.userId}-${req.semesterId}`] = req.courseIds;
            });
            setEditingSelections(initialEdits);

        } catch (error: any) {
            console.error('Error fetching registration requests:', error);
            toast({ variant: 'destructive', title: 'Failed to load requests' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (currentUser) {
            fetchRequests();
        }
    }, [currentUser, fetchRequests]);

    const fetchTimetableCourses = async (semesterId: string, intakeId: string) => {
        try {
            const intakeSnap = await get(ref(db, `intakes/${intakeId}`));
            const intakeName = intakeSnap.val()?.name;
            const timetableSnap = await get(ref(db, `timetables/${semesterId}`));
            const masterSnap = await get(ref(db, `timetables/master`));
            
            const courseIds = new Set<string>();
            
            const processTimetableNode = (node: any) => {
                if (!node) return;
                Object.entries(node).forEach(([cId, sessions]: [string, any]) => {
                    const sessionArr = Object.values(sessions);
                    const isForCohort = sessionArr.some((s: any) => s.intakeName === intakeName || s.intakeName === 'Master');
                    if (isForCohort) courseIds.add(cId);
                });
            };

            processTimetableNode(timetableSnap.val());
            processTimetableNode(masterSnap.val());

            return Array.from(courseIds);
        } catch (e) {
            console.error("Timetable fetch failed:", e);
            return [];
        }
    };

    const handleSyncWithTimetable = async (request: RegistrationRequest) => {
        const timetableIds = await fetchTimetableCourses(request.semesterId, request.studentIntakeId);
        if (timetableIds.length === 0) {
            toast({ variant: 'destructive', title: 'No Timetable Found', description: 'Could not find a scheduled timetable for this cohort.' });
            return;
        }
        
        setEditingSelections(prev => ({
            ...prev,
            [`${request.userId}-${request.semesterId}`]: timetableIds
        }));
        toast({ title: 'Synced with Timetable', description: `Loaded ${timetableIds.length} scheduled courses.` });
    };

    const handleForceEnroll = async (request: RegistrationRequest) => {
        if (!currentAdmin) {
             toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not identify current admin.' });
             return;
        }
        setActionLoading(request.userId);
        try {
            const updates: Record<string, any> = {};
            updates[`registrations/${request.userId}/${request.semesterId}/status`] = 'Completed';
            
            const activityRef = push(ref(db, 'recentActivities'));
            updates[`recentActivities/${activityRef.key!}`] = {
                user: currentAdmin.name,
                userId: currentAdmin.id,
                action: `manually enrolled ${request.studentName} (**${request.studentId}**) for the ${request.semesterName} semester.`,
                timestamp: serverTimestamp()
            };

            await update(ref(db), updates);

             await createNotification(
                request.userId,
                `Your registration for ${request.semesterName} has been manually approved and completed by an admin. You are now enrolled.`,
                '/student/classes'
            );
            toast({
                title: 'Student Enrolled',
                description: `${request.studentName} has been manually enrolled for ${request.semesterName}.`,
            });
            fetchRequests();
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleApproval = async (request: RegistrationRequest, decision: 'approve' | 'decline') => {
        if (!currentUser) return;
        setActionLoading(request.userId);

        try {
            const registrationRef = ref(db, `registrations/${request.userId}/${request.semesterId}`);
            const invoiceRef = ref(db, `invoices/${request.userId}/${request.invoiceId}`);

            if (decision === 'approve') {
                const finalCourses = editingSelections[`${request.userId}-${request.semesterId}`] || [];
                const newStatus = enrollmentPolicy === 'onApproval' ? 'Completed' : 'Pending Payment';
                
                let notificationMessage = `Your course registration for ${request.semesterName} has been approved!`;
                if (newStatus === 'Completed') {
                    notificationMessage += ' You are now enrolled in your selected courses.';
                } else {
                    notificationMessage += ' Please proceed to payments to finalize your enrollment.';
                }

                const tuitionCost = finalCourses.reduce((acc, id) => acc + (allCourses.get(id)?.cost || 0), 0);
                const optionalFeesCost = (request.optionalFees || []).reduce((acc, id) => acc + (allOptionalFees.get(id)?.amount || 0), 0);
                const mandatoryFeesCost = Array.from(allMandatoryFees.values()).reduce((acc, fee) => acc + fee.amount, 0);

                await update(invoiceRef, {
                    courses: finalCourses,
                    totalTuition: tuitionCost,
                    totalOptionalFees: optionalFeesCost,
                    totalMandatoryFees: mandatoryFeesCost,
                });

                await update(registrationRef, { 
                    status: newStatus,
                    courses: finalCourses,
                });
                
                await createNotification(request.userId, notificationMessage, '/student/registration');
                
                toast({
                    title: 'Registration Approved',
                    description: `${request.studentName}'s registration is now ${newStatus === 'Completed' ? 'enrolled' : 'pending payment'}.`,
                });

                // Financial Integration Logic
                const syncData = {
                    invoiceId: request.invoiceId,
                    studentName: request.studentName,
                    studentId: request.studentId,
                    amount: tuitionCost + optionalFeesCost + mandatoryFeesCost,
                    date: new Date().toISOString().split('T')[0],
                    description: `Invoice for ${request.semesterName}`,
                };
                
                if(isQuickBooksEnabled) await syncInvoiceToQuickbooks(syncData).catch(() => {});
                if(isSageEnabled) await syncInvoiceToSage(syncData as any).catch(() => {});

            } else { 
                await remove(registrationRef);
                await remove(invoiceRef);
                
                await createNotification(
                    request.userId,
                    `Your course registration for ${request.semesterName} has been declined. Please review and resubmit.`,
                    '/student/registration'
                );
                toast({
                    variant: 'destructive',
                    title: 'Registration Declined',
                    description: `${request.studentName}'s registration has been declined and removed.`,
                });
            }
            fetchRequests();
        } catch(error: any) {
             toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setActionLoading(null); }
    };

    const handleScholarshipDecision = async (decision: 'approve' | 'deny') => {
        if (!scholarshipReviewRequest) return;
        setActionLoading(scholarshipReviewRequest.userId);
        
        const request = scholarshipReviewRequest;
        const registrationRef = ref(db, `registrations/${request.userId}/${request.semesterId}`);
        const invoiceRef = ref(db, `invoices/${request.userId}/${request.invoiceId}`);

        try {
            const isApproved = decision === 'approve';
            const newStatus = enrollmentPolicy === 'onApproval' ? 'Completed' : 'Pending Payment';
            
            await update(registrationRef, {
                status: newStatus,
                scholarshipStatus: isApproved ? 'Approved' : 'Denied',
                applyScholarship: isApproved
            });
            
            await update(invoiceRef, { applyScholarship: isApproved });

            const msg = isApproved
                ? `Congratulations! Your scholarship application for ${request.semesterName} has been approved. Your tuition has been waived.`
                : `Your scholarship application for ${request.semesterName} was not approved. The full tuition amount is now due.`;

            await createNotification(request.userId, msg, '/student/registration');
            
            toast({ title: `Scholarship ${isApproved ? 'Approved' : 'Denied'}` });
            fetchRequests();
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
            setScholarshipReviewRequest(null);
        }
    }
    
    const handleCourseSelectionChange = (reqId: string, courseId: string) => {
        setEditingSelections(prev => {
            const currentSelection = prev[reqId] || [];
            const newSelection = currentSelection.includes(courseId) ? currentSelection.filter(id => id !== courseId) : [...currentSelection, courseId];
            return { ...prev, [reqId]: newSelection };
        });
    };

    const renderRequestList = (groupedRequests: GroupedRequests, type: 'pending' | 'approved' | 'completed') => {
        if (loading) return (<div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}</div>);
        if (Object.keys(groupedRequests).length === 0) return (<div className="py-16 text-center text-muted-foreground"><UserCheck className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">All Clear!</h3><p className="mt-2 text-sm">There are no {type} registrations to show.</p></div>);

        return (
             <Accordion type="multiple" defaultValue={Object.keys(groupedRequests)} className="w-full space-y-4">
                 {Object.entries(groupedRequests).map(([semesterName, requests]) => (
                     <AccordionItem value={semesterName} key={semesterName} className="border-none">
                        <AccordionTrigger className="bg-muted px-4 py-2 rounded-md font-bold text-lg hover:no-underline">{semesterName} ({requests.length})</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                             {requests.map((request) => {
                                const reqId = `${request.userId}-${request.semesterId}`;
                                const currentSelection = editingSelections[reqId] || [];
                                const totalCost = currentSelection.reduce((sum, id) => sum + (allCourses.get(id)?.cost || 0), 0);
                                const coursePath = allCoursePaths.find(p => p.intakeId === request.studentIntakeId && p.programmeId === request.programmeId);

                                return (
                                <Card key={reqId} className="overflow-hidden shadow-md border-l-4 border-l-primary">
                                    <CardHeader className="bg-muted/50 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg">{request.studentName}</CardTitle>
                                                <CardDescription>ID: {request.studentId} | Programme: <strong>{request.programmeName}</strong> | Intake: <strong>{allIntakes.get(request.studentIntakeId)?.name || 'N/A'}</strong></CardDescription>
                                                <CardDescription>Submitted: {format(new Date(request.registrationDate), 'PPP')}</CardDescription>
                                                {request.applyScholarship && type !== 'completed' && ( <Badge variant="default" className="bg-blue-600 hover:bg-blue-700"><GraduationCap className="mr-2 h-4 w-4" />Scholarship Applicant</Badge>)}
                                            </div>
                                            {type === 'pending' ? ( <div className="flex flex-col gap-2">
                                                    <div className="flex gap-2 self-start sm:self-end">
                                                        <Button size="sm" variant="destructive" onClick={() => handleApproval(request, 'decline')} disabled={!!actionLoading}><X className="h-4 w-4" /></Button>
                                                        {request.applyScholarship ? (
                                                            <Button size="sm" onClick={() => setScholarshipReviewRequest(request)} disabled={!!actionLoading} variant="default" className="bg-blue-600 hover:bg-blue-700">{actionLoading === request.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />} Review Scholarship</Button>
                                                        ) : (
                                                            <Button size="sm" onClick={() => handleApproval(request, 'approve')} disabled={!!actionLoading}>{actionLoading === request.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve</Button>
                                                        )}
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => handleSyncWithTimetable(request)} className="h-8 text-[10px] uppercase font-black tracking-widest"><RotateCcw className="h-3 w-3 mr-1"/> Sync with Timetable</Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-2">
                                                    <Badge variant={request.status === 'Completed' ? 'default' : 'secondary'}>{request.status === 'Completed' ? 'Enrolled' : 'Awaiting Payment'}</Badge>
                                                    {type === 'approved' && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="link" className="h-auto p-0 text-[10px] font-bold text-destructive underline">Manual Force Enroll &rarr;</Button></AlertDialogTrigger>
                                                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Bypass Payment Threshold?</AlertDialogTitle><AlertDialogDescription>This will manually enroll the student regardless of their current payment status. Use only if payment is verified via external slip or cash.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleForceEnroll(request)}>Enroll Student</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-[0.2em] mb-2">Class Roster Configuration</Label>
                                            <div className="grid gap-2">
                                                {Array.from(allCourses.values()).filter(c => c.status === 'active' && (currentSelection.includes(c.id) || request.courseIds.includes(c.id))).map(course => {
                                                    const history = request.academicHistory[course.id];
                                                    const isPathCourse = coursePath?.semesters?.[request.semesterId]?.courses?.includes(course.id);
                                                    const isStudentSelected = request.courseIds.includes(course.id);
                                                    
                                                    return(
                                                    <div key={course.id} className={cn(
                                                        "flex items-center gap-4 rounded-xl border p-3 text-sm transition-all",
                                                        currentSelection.includes(course.id) ? "bg-primary/5 border-primary/20" : "opacity-50 grayscale bg-muted/20"
                                                    )}>
                                                        <Checkbox id={`${reqId}-${course.id}`} checked={currentSelection.includes(course.id)} onCheckedChange={() => handleCourseSelectionChange(reqId, course.id)} disabled={type !== 'pending'}/>
                                                        <div className="flex-1 flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">{course.code}</span>
                                                                <span className="text-muted-foreground text-xs">{course.name}</span>
                                                                {!isPathCourse && <Badge variant="destructive" className="h-4 text-[8px] uppercase">Path Deviation</Badge>}
                                                                {!isStudentSelected && currentSelection.includes(course.id) && <Badge variant="secondary" className="h-4 text-[8px] uppercase bg-blue-100 text-blue-700">Added by Registrar</Badge>}
                                                            </div>
                                                            <div className='flex gap-2 items-center'>
                                                                {history && (<Badge variant={history === 'Passed' ? 'default' : 'destructive'} className='h-4 px-1.5 text-[9px] gap-1'><History className="h-2.5 w-2.5"/>Previously {history}</Badge>)}
                                                            </div>
                                                        </div>
                                                        <span className="font-mono font-bold text-xs">ZMW {course.cost.toFixed(2)}</span>
                                                    </div>
                                                )})}
                                            </div>
                                        </div>
                                        
                                        <Separator />
                                        
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                                            <div className="flex items-center gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none">Total Invoiced</span>
                                                    <span className="font-black text-lg">ZMW {totalCost.toFixed(2)}</span>
                                                </div>
                                                <div className="flex flex-col border-l pl-6">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none">Amount Paid</span>
                                                    <span className={cn("font-black text-lg", request.amountPaid > 0 ? "text-green-600" : "text-muted-foreground")}>ZMW {request.amountPaid.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black uppercase text-primary tracking-widest leading-none">Outstanding Balance</span>
                                                <span className={cn("text-2xl font-black", (totalCost - request.amountPaid) > 0.01 ? "text-destructive" : "text-green-600")}>ZMW {Math.max(0, totalCost - request.amountPaid).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )})}
                        </AccordionContent>
                     </AccordionItem>
                 ))}
             </Accordion>
        )
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md">
                            <ClipboardCheck className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Course Registration Audit</CardTitle>
                            <CardDescription>Verify student enrollments, process scholarships, and reconcile with the institutional timetable.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 rounded-xl">
                            <TabsTrigger value="pending" className="py-3 rounded-lg font-bold">Pending ({loading ? '...' : Object.values(pendingRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="approved" className="py-3 rounded-lg font-bold">Approved ({loading ? '...' : Object.values(approvedRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="completed" className="py-3 rounded-lg font-bold">Enrolled ({loading ? '...' : Object.values(completedRequests).flat().length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="mt-6">{renderRequestList(pendingRequests, 'pending')}</TabsContent>
                        <TabsContent value="approved" className="mt-6">{renderRequestList(approvedRequests, 'approved')}</TabsContent>
                        <TabsContent value="completed" className="mt-6">{renderRequestList(completedRequests, 'completed')}</TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={!!scholarshipReviewRequest} onOpenChange={() => setScholarshipReviewRequest(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <GraduationCap className="h-6 w-6" />
                            <DialogTitle className="text-xl">Scholarship Verification</DialogTitle>
                        </div>
                        <DialogDescription className="text-base">
                            Reviewing tuition waiver application for <span className="font-black text-foreground">{scholarshipReviewRequest?.studentName}</span>. 
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-primary/5 border rounded-xl space-y-3">
                        <div className="flex justify-between text-sm"><span>Proposed Programme:</span> <span className="font-bold">{scholarshipReviewRequest?.programmeName}</span></div>
                        <div className="flex justify-between text-sm"><span>Cohort Intake:</span> <span className="font-bold">{allIntakes.get(scholarshipReviewRequest?.studentIntakeId || '')?.name}</span></div>
                        <Alert variant="default" className="bg-white border-primary/20 py-2">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-[10px] leading-tight">Approving this will apply a <strong>100% waiver</strong> to all tuition line items for this semester registration.</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => handleScholarshipDecision('deny')} disabled={!!actionLoading}>Deny</Button>
                        <Button className="flex-1" onClick={() => handleScholarshipDecision('approve')} disabled={!!actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Approve Waiver
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
