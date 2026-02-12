'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, Check, X, ClipboardCheck, GraduationCap, AlertCircle, Edit, Save, CheckCircle2, History, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, get, update, remove, set, serverTimestamp, push } from 'firebase/database';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { syncInvoiceToQuickbooks, voidQbInvoice } from '@/ai/flows/sync-to-quickbooks';
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
  academicHistory: Record<string, 'Passed' | 'Failed'>; // courseId -> status
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

type GroupedCourses = {
    [year: string]: Course[];
}

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<number, { courses: string[] }>;
};

type CurrentAdmin = { name: string; id: string; };

const statusVariant: { [key in RegistrationRequest['status']]: 'destructive' | 'secondary' | 'default' } = {
  'Pending Approval': 'secondary',
  'Pending Payment': 'destructive',
  'Completed': 'default',
};
const statusText: { [key in RegistrationRequest['status']]: string } = {
    'Pending Approval': 'Pending Approval',
    'Pending Payment': 'Approved (Awaiting Payment)',
    'Completed': 'Enrolled'
};

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
            const [coursesSnap, programmesSnap, optionalFeesSnap, mandatoryFeesSnap, registrationsSnap, settingsSnap, semestersSnap, intakesSnap, coursePathsSnap, assessmentsSnap] = await Promise.all([
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
            ]);
            
            if (settingsSnap.exists()) {
                const settingsData = settingsSnap.val();
                setEnrollmentPolicy(settingsData.enrollmentPolicy);
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
                                 // Simplified pass/fail logic
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
                const originalCourses = new Set(request.courseIds);
                const finalCourses = editingSelections[`${request.userId}-${request.semesterId}`] || [];
                const finalCoursesSet = new Set(finalCourses);
                
                const newStatus = enrollmentPolicy === 'onApproval' ? 'Completed' : 'Pending Payment';
                let notificationMessage = `Your course registration for ${request.semesterName} has been approved!`;
                if (newStatus === 'Completed') {
                    notificationMessage += ' You are now enrolled in your selected courses.';
                } else {
                    notificationMessage += ' Please proceed to payments to finalize your enrollment.';
                }

                const added = finalCourses.filter(c => !originalCourses.has(c)).map(id => allCourses.get(id)?.code);
                const removed = request.courseIds.filter(c => !finalCoursesSet.has(c)).map(id => allCourses.get(id)?.code);

                if (added.length > 0 || removed.length > 0) {
                     notificationMessage += ` The following adjustments were made by the registrar:`;
                     if (added.length > 0) notificationMessage += ` Added: ${added.join(', ')}.`;
                     if (removed.length > 0) notificationMessage += ` Removed: ${removed.join(', ')}.`;
                }

                const tuitionCost = finalCourses.reduce((acc, id) => acc + (allCourses.get(id)?.cost || 0), 0);
                const optionalFeesCost = (request.optionalFees || []).reduce((acc, id) => acc + (allOptionalFees.get(id)?.amount || 0), 0);
                const mandatoryFeesCost = Array.from(allMandatoryFees.values()).reduce((acc, fee) => acc + fee.amount, 0);

                await update(invoiceRef, {
                    courses: finalCourses,
                    totalTuition: tuitionCost,
                    totalOptionalFees: optionalFeesCost,
                    totalMandatoryFees: mandatoryFeesCost,
                    applyScholarship: false,
                });

                await update(registrationRef, { 
                    status: newStatus,
                    courses: finalCourses,
                    originalCourses: request.courseIds
                });
                
                await createNotification(request.userId, notificationMessage, '/student/registration');
                
                toast({
                    title: 'Registration Approved',
                    description: `${request.studentName}'s registration is now ${newStatus === 'Completed' ? 'enrolled' : 'pending payment'}.`,
                });
                 // Sync to QuickBooks/Sage
                const syncData = {
                    invoiceId: request.invoiceId,
                    studentName: request.studentName,
                    studentId: request.studentId,
                    amount: tuitionCost + optionalFeesCost + mandatoryFeesCost,
                    date: new Date().toISOString().split('T')[0],
                    description: `Invoice for ${request.semesterName}`,
                };
                if(isQuickBooksEnabled) {
                    await syncInvoiceToQuickbooks(syncData);
                    toast({ title: 'Synced to QuickBooks' });
                }
                if(isSageEnabled) {
                    await syncInvoiceToSage(syncData as any);
                    toast({ title: 'Synced to Sage' });
                }

            } else { 
                await remove(registrationRef);
                await remove(invoiceRef);
                if(isQuickBooksEnabled) await voidQbInvoice(request.invoiceId);
                // No equivalent Sage void action for now
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
            
            const registrationUpdates: Record<string, any> = {
                status: newStatus,
                scholarshipStatus: isApproved ? 'Approved' : 'Denied',
                applyScholarship: isApproved
            };
            
            const invoiceSnapshot = await get(invoiceRef);
            if(invoiceSnapshot.exists()){
                const invoiceData = invoiceSnapshot.val();
                const updatedInvoice = {...invoiceData, applyScholarship: isApproved };
                await update(invoiceRef, updatedInvoice);
            }

            await update(registrationRef, registrationUpdates);

            const notificationMessage = isApproved
                ? `Congratulations! Your scholarship application for ${request.semesterName} has been approved. Your tuition has been waived.`
                : `Regarding your registration for ${request.semesterName}, your scholarship application was not approved. The full tuition amount is now due.`;

            await createNotification(request.userId, notificationMessage, '/student/registration');
            
            toast({
                title: `Scholarship ${isApproved ? 'Approved' : 'Denied'}`,
                description: `The scholarship for ${request.studentName} has been processed.`,
            });
            fetchRequests();
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Scholarship Action Failed', description: e.message });
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

    const getProgrammeCourses = (programmeId: string) => {
        const programme = allProgrammes.get(programmeId);
        if(!programme || !programme.courseIds) return [];
        return Object.keys(programme.courseIds).map(id => allCourses.get(id)).filter(Boolean) as Course[];
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
                                <Card key={reqId} className="overflow-hidden">
                                    <CardHeader className="bg-muted/50 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg">{request.studentName}</CardTitle>
                                                <CardDescription>ID: {request.studentId} | Programme: <strong>{request.programmeName}</strong> | Intake: <strong>{allIntakes.get(request.studentIntakeId)?.name || 'N/A'}</strong></CardDescription>
                                                <CardDescription>Submitted: {format(new Date(request.registrationDate), 'PPP')}</CardDescription>
                                                {request.applyScholarship && type !== 'completed' && ( <Badge variant="default" className="bg-blue-600 hover:bg-blue-700"><GraduationCap className="mr-2 h-4 w-4" />Scholarship Applicant</Badge>)}
                                            </div>
                                            {type === 'pending' ? ( <div className="flex gap-2 self-start sm:self-center">
                                                    <Button size="sm" variant="destructive" onClick={() => handleApproval(request, 'decline')} disabled={!!actionLoading}><X className="h-4 w-4" /></Button>
                                                    {request.applyScholarship ? (
                                                        <Button size="sm" onClick={() => setScholarshipReviewRequest(request)} disabled={!!actionLoading} variant="default" className="bg-blue-600 hover:bg-blue-700">{actionLoading === request.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />} Review Scholarship</Button>
                                                    ) : (
                                                        <Button size="sm" onClick={() => handleApproval(request, 'approve')} disabled={!!actionLoading}>{actionLoading === request.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve</Button>
                                                    )}</div>
                                            ) : (
                                                <Badge variant={statusVariant[request.status]}>{statusText[request.status]}</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    {type !== 'completed' && (<CardContent className="p-4"><ul className="space-y-2">
                                        {currentSelection.map(courseId => allCourses.get(courseId)).filter(Boolean).map(course => {
                                            const history = request.academicHistory[course.id];
                                            const isPathDeviation = coursePath && coursePath.semesters ? !Object.values(coursePath.semesters).some(s => s.courses.includes(course.id)) : false;
                                            return(
                                            <li key={course.id} className={cn("flex items-center gap-4 rounded-md border p-2 text-sm", type==='pending' && request.courseIds.includes(course.id) && !currentSelection.includes(course.id) && "bg-red-100 border-red-200", type==='pending' && !request.courseIds.includes(course.id) && currentSelection.includes(course.id) && "bg-green-100 border-green-200")}>
                                                <Checkbox id={`${reqId}-${course.id}`} checked={type === 'pending' ? currentSelection.includes(course.id) : request.courseIds.includes(course.id)} onCheckedChange={() => handleCourseSelectionChange(reqId, course.id)} disabled={type !== 'pending'}/>
                                                <label htmlFor={`${reqId}-${course.id}`} className="flex-1 flex flex-col">
                                                    <div><span className="font-medium">{course.code}</span><span className="text-muted-foreground"> - {course.name}</span></div>
                                                    <div className='flex gap-2 items-center'>
                                                        {history && (<Popover><PopoverTrigger asChild><Badge variant={history === 'Passed' ? 'default' : 'destructive'} className='cursor-pointer'><History className="mr-1 h-3 w-3"/>{history}</Badge></PopoverTrigger><PopoverContent className='w-auto p-2 text-sm'>Previously {history.toLowerCase()}.</PopoverContent></Popover>)}
                                                        {isPathDeviation && (<Popover><PopoverTrigger asChild><Badge variant='destructive' className='cursor-pointer'><AlertTriangle className="mr-1 h-3 w-3"/>Path Deviation</Badge></PopoverTrigger><PopoverContent className='w-auto p-2 text-sm'>This course is not in the defined path.</PopoverContent></Popover>)}
                                                    </div>
                                                </label>
                                                <span className="font-mono text-right">ZMW {course.cost.toFixed(2)}</span>
                                            </li>
                                        )})}</ul>
                                        <Separator className="my-4" />
                                        <div className="flex justify-end items-center gap-4 font-bold"><span>Updated Tuition Cost</span><span className="font-mono text-lg">ZMW {totalCost.toFixed(2)}</span></div>
                                    </CardContent>)}
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
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Manage Course Registrations</CardTitle>
                    <CardDescription>Review, approve, or decline student course selections for the upcoming semester.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="pending">Pending ({loading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : Object.values(pendingRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="approved">Awaiting Payment ({loading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : Object.values(approvedRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="completed">Enrolled ({loading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : Object.values(completedRequests).flat().length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="mt-4">{renderRequestList(pendingRequests, 'pending')}</TabsContent>
                        <TabsContent value="approved" className="mt-4">{renderRequestList(approvedRequests, 'approved')}</TabsContent>
                        <TabsContent value="completed" className="mt-4">{renderRequestList(completedRequests, 'completed')}</TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={!!scholarshipReviewRequest} onOpenChange={() => setScholarshipReviewRequest(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Scholarship Review</DialogTitle>
                        <DialogDescription>Reviewing scholarship application for <span className="font-bold">{scholarshipReviewRequest?.studentName}</span> ({scholarshipReviewRequest?.studentId}). Approving the scholarship will waive 100% of the tuition fees for this registration.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="destructive" onClick={() => handleScholarshipDecision('deny')} disabled={actionLoading}>Deny Scholarship</Button>
                        <Button onClick={() => handleScholarshipDecision('approve')} disabled={actionLoading}>{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}Approve Scholarship</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
