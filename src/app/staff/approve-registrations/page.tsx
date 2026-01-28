
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, Check, X, ClipboardCheck, GraduationCap, AlertCircle, Edit, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, get, update, remove, set } from 'firebase/database';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

type RegistrationRequest = {
  userId: string;
  semester: string;
  studentName: string;
  studentId: string;
  courseIds: string[];
  invoiceId: string;
  registrationDate: string;
  status: 'Pending Approval' | 'Pending Payment' | 'Completed';
  applyScholarship?: boolean;
  programmeId: string;
  programmeName: string;
  optionalFees: string[];
};

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

export default function ApproveRegistrationsPage() {
    const [pendingRequests, setPendingRequests] = React.useState<RegistrationRequest[]>([]);
    const [approvedRequests, setApprovedRequests] = React.useState<RegistrationRequest[]>([]);
    const [completedRequests, setCompletedRequests] = React.useState<RegistrationRequest[]>([]);
    const [allCourses, setAllCourses] = React.useState<Map<string, Course>>(new Map());
    const [allProgrammes, setAllProgrammes] = React.useState<Map<string, any>>(new Map());
    const [allOptionalFees, setAllOptionalFees] = React.useState<Map<string, Fee>>(new Map());
    const [allMandatoryFees, setAllMandatoryFees] = React.useState<Map<string, Fee>>(new Map());
    
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null); 
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [activeTab, setActiveTab] = React.useState('pending');

    const [editingSelections, setEditingSelections] = React.useState<Record<string, string[]>>({});

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchRequests = React.useCallback(async () => {
        setLoading(true);
        try {
            const [coursesSnap, programmesSnap, optionalFeesSnap, mandatoryFeesSnap, registrationsSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'programmes')),
                get(ref(db, 'optionalFees')),
                get(ref(db, 'mandatoryFees')),
                get(ref(db, 'registrations'))
            ]);

            const coursesData = new Map<string, Course>();
            if (coursesSnap.exists()) {
                Object.entries(coursesSnap.val()).forEach(([id, data]) => {
                    coursesData.set(id, { id, ...(data as Omit<Course, 'id'>) });
                });
            }
            setAllCourses(coursesData);
            
            const programmesData = new Map<string, any>();
            if(programmesSnap.exists()){
                Object.entries(programmesSnap.val()).forEach(([id, data]) => {
                    programmesData.set(id, {id, ...(data as any)});
                });
            }
            setAllProgrammes(programmesData);

            const optionalFeesData = new Map<string, Fee>();
            if (optionalFeesSnap.exists()) {
                Object.entries(optionalFeesSnap.val()).forEach(([id, data]) => {
                    optionalFeesData.set(id, { id, ...(data as Omit<Fee, 'id'>) });
                });
            }
            setAllOptionalFees(optionalFeesData);

            const mandatoryFeesData = new Map<string, Fee>();
            if (mandatoryFeesSnap.exists()) {
                Object.entries(mandatoryFeesSnap.val()).forEach(([id, data]) => {
                    mandatoryFeesData.set(id, { id, ...(data as Omit<Fee, 'id'>) });
                });
            }
            setAllMandatoryFees(mandatoryFeesData);


            if (!registrationsSnap.exists()) {
                setPendingRequests([]); setApprovedRequests([]); setCompletedRequests([]); setLoading(false); return;
            }

            const registrationsData = registrationsSnap.val();
            const pending: RegistrationRequest[] = [];
            const approved: RegistrationRequest[] = [];
            const completed: RegistrationRequest[] = [];
            const userPromises: Promise<any>[] = [];

            for (const userId in registrationsData) {
                const userRegistrations = registrationsData[userId];
                for (const semester in userRegistrations) {
                    const registration = userRegistrations[semester];
                    if (registration.status === 'Pending Approval' || registration.status === 'Pending Payment' || registration.status === 'Completed') {
                         userPromises.push(get(ref(db, `users/${userId}`)).then(userSnapshot => {
                             if(userSnapshot.exists()){
                                 const userData = userSnapshot.val();
                                 const requestData: RegistrationRequest = {
                                    userId,
                                    semester,
                                    studentName: userData.name,
                                    studentId: userData.id,
                                    courseIds: registration.courses,
                                    invoiceId: registration.invoiceId,
                                    registrationDate: registration.registrationDate,
                                    status: registration.status,
                                    applyScholarship: registration.applyScholarship || false,
                                    programmeId: registration.programmeId,
                                    programmeName: programmesData.get(registration.programmeId)?.name || 'Unknown Programme',
                                    optionalFees: registration.optionalFees || []
                                };
                                if (registration.status === 'Pending Approval') {
                                    pending.push(requestData);
                                } else if (registration.status === 'Pending Payment') {
                                    approved.push(requestData);
                                } else {
                                    completed.push(requestData);
                                }
                             }
                         }));
                    }
                }
            }
            
            await Promise.all(userPromises);
            
            pending.sort((a,b) => new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime());
            approved.sort((a,b) => new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime());
            completed.sort((a,b) => new Date(b.registrationDate).getTime() - new Date(b.registrationDate).getTime());
            
            setPendingRequests(pending);
            setApprovedRequests(approved);
            setCompletedRequests(completed);

            const initialEdits: Record<string, string[]> = {};
            pending.forEach(req => {
                initialEdits[`${req.userId}-${req.semester}`] = req.courseIds;
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
        setActionLoading(request.userId);
        try {
            await update(ref(db, `registrations/${request.userId}/${request.semester}`), {
                status: 'Completed'
            });
             await createNotification(
                request.userId,
                `Your registration for ${request.semester} has been manually approved and completed by an admin. You are now enrolled.`,
                '/student/classes'
            );
            toast({
                title: 'Student Enrolled',
                description: `${request.studentName} has been manually enrolled for ${request.semester}.`,
            });
            fetchRequests();
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleApproval = async (request: RegistrationRequest, decision: 'approve' | 'decline') => {
        if (!currentUser) return;
        setActionLoading(request.userId);

        try {
            const registrationRef = ref(db, `registrations/${request.userId}/${request.semester}`);
            const invoiceRef = ref(db, `invoices/${request.userId}/${request.invoiceId}`);

            if (decision === 'approve') {
                const originalCourses = new Set(request.courseIds);
                const finalCourses = editingSelections[`${request.userId}-${request.semester}`] || [];
                const finalCoursesSet = new Set(finalCourses);
                
                let notificationMessage = `Your course registration for ${request.semester} has been approved!`;
                const added = finalCourses.filter(c => !originalCourses.has(c)).map(id => allCourses.get(id)?.code);
                const removed = request.courseIds.filter(c => !finalCoursesSet.has(c)).map(id => allCourses.get(id)?.code);

                if (added.length > 0 || removed.length > 0) {
                     notificationMessage += ` The following adjustments were made by the registrar:`;
                     if (added.length > 0) notificationMessage += ` Added: ${added.join(', ')}.`;
                     if (removed.length > 0) notificationMessage += ` Removed: ${removed.join(', ')}.`;
                }
                notificationMessage += ` Please proceed to payments.`;

                // Recalculate invoice based on final courses
                const tuitionCost = finalCourses.reduce((acc, id) => acc + (allCourses.get(id)?.cost || 0), 0);
                const optionalFeesCost = (request.optionalFees || []).reduce((acc, id) => acc + (allOptionalFees.get(id)?.amount || 0), 0);
                const mandatoryFeesCost = Array.from(allMandatoryFees.values()).reduce((acc, fee) => acc + fee.amount, 0);

                await update(invoiceRef, {
                    courses: finalCourses,
                    totalTuition: tuitionCost,
                    totalOptionalFees: optionalFeesCost,
                    totalMandatoryFees: mandatoryFeesCost
                });

                await update(registrationRef, { 
                    status: 'Pending Payment', 
                    courses: finalCourses,
                    originalCourses: request.courseIds // Save the original selection
                });
                
                await createNotification(request.userId, notificationMessage, '/student/registration');
                
                toast({
                    title: 'Registration Approved',
                    description: `${request.studentName}'s registration is now pending payment.`,
                });
            } else { // decline
                await remove(registrationRef);
                await remove(invoiceRef);
                await createNotification(
                    request.userId,
                    `Your course registration for ${request.semester} has been declined. Please review and resubmit.`,
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
             toast({
                variant: 'destructive',
                title: 'Action Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleCourseSelectionChange = (reqId: string, courseId: string) => {
        setEditingSelections(prev => {
            const currentSelection = prev[reqId] || [];
            const newSelection = currentSelection.includes(courseId)
                ? currentSelection.filter(id => id !== courseId)
                : [...currentSelection, courseId];
            return { ...prev, [reqId]: newSelection };
        });
    };

    const getProgrammeCourses = (programmeId: string) => {
        const programme = allProgrammes.get(programmeId);
        if(!programme || !programme.courseIds) return [];
        return Object.keys(programme.courseIds).map(id => allCourses.get(id)).filter(Boolean) as Course[];
    };
    
    const renderRequestList = (requests: RegistrationRequest[], type: 'pending' | 'approved' | 'completed') => {
        if (loading) {
            return (<div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}</div>);
        }
        
        if (requests.length === 0) {
            return (
                <div className="py-16 text-center text-muted-foreground">
                    <UserCheck className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">All Clear!</h3>
                    <p className="mt-2 text-sm">There are no {type} registrations to show.</p>
                </div>
            )
        }

        return (
             <div className="space-y-4">
                {requests.map((request) => {
                    const reqId = `${request.userId}-${request.semester}`;
                    const currentSelection = editingSelections[reqId] || [];
                    const programmeCourses = getProgrammeCourses(request.programmeId);

                    const groupedProgrammeCourses = programmeCourses.reduce((acc, course) => {
                        const yearKey = `Year ${course.year}`;
                        if (!acc[yearKey]) acc[yearKey] = [];
                        acc[yearKey].push(course);
                        return acc;
                    }, {} as GroupedCourses);

                    const totalCost = currentSelection.reduce((sum, id) => sum + (allCourses.get(id)?.cost || 0), 0);

                    return (
                    <Card key={reqId} className="overflow-hidden">
                        <CardHeader className="bg-muted/50 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg">{request.studentName}</CardTitle>
                                    <CardDescription>
                                        ID: {request.studentId} | Semester: {request.semester} | Submitted: {format(new Date(request.registrationDate), 'PPP')}
                                    </CardDescription>
                                     <CardDescription>Programme: <strong>{request.programmeName}</strong></CardDescription>
                                     {request.applyScholarship && type !== 'completed' && (
                                        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                                            <GraduationCap className="mr-2 h-4 w-4" />
                                            Scholarship Applicant
                                        </Badge>
                                    )}
                                </div>
                                {type === 'pending' ? (
                                    <div className="flex gap-2 self-start sm:self-center">
                                        <Button size="sm" variant="destructive" onClick={() => handleApproval(request, 'decline')} disabled={!!actionLoading}><X className="h-4 w-4" /></Button>
                                        <Button size="sm" onClick={() => handleApproval(request, 'approve')} disabled={!!actionLoading}>
                                            {actionLoading === request.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve
                                        </Button>
                                    </div>
                                ) : type === 'approved' ? (
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge variant="default"><ClipboardCheck className="mr-2 h-4 w-4"/>Approved (Pending Payment)</Badge>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="secondary">Force Enroll</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Force Enrollment?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action should only be used to manually confirm enrollment after verifying payment outside the system. The student will be granted access to their classes immediately.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleForceEnroll(request)}>Yes, force enroll</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ) : (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="mr-2 h-4 w-4"/>Enrolled</Badge>
                                )}
                            </div>
                        </CardHeader>
                        {type !== 'completed' && (
                        <CardContent className="p-4">
                             <Accordion type="multiple" defaultValue={Object.keys(groupedProgrammeCourses)} className="w-full">
                                {Object.entries(groupedProgrammeCourses).map(([year, courses]) => (
                                    <AccordionItem value={year} key={year}>
                                        <AccordionTrigger className="font-bold text-base">{year} Courses</AccordionTrigger>
                                        <AccordionContent>
                                            <ul className="space-y-2">
                                            {courses.map(course => (
                                                <li key={course.id} className={cn("flex items-center gap-4 rounded-md border p-2 text-sm", type==='pending' && request.courseIds.includes(course.id) && !currentSelection.includes(course.id) && "bg-red-100 border-red-200", type==='pending' && !request.courseIds.includes(course.id) && currentSelection.includes(course.id) && "bg-green-100 border-green-200")}>
                                                    <Checkbox
                                                        id={`${reqId}-${course.id}`}
                                                        checked={type === 'pending' ? currentSelection.includes(course.id) : request.courseIds.includes(course.id)}
                                                        onCheckedChange={() => handleCourseSelectionChange(reqId, course.id)}
                                                        disabled={type !== 'pending'}
                                                    />
                                                    <label htmlFor={`${reqId}-${course.id}`} className="flex-1">
                                                        <span className="font-medium">{course.code}</span>
                                                        <span className="text-muted-foreground"> - {course.name}</span>
                                                    </label>
                                                    <span className="font-mono text-right">ZMW {course.cost.toFixed(2)}</span>
                                                </li>
                                            ))}
                                            </ul>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                             <Separator className="my-4" />
                             <div className="flex justify-end items-center gap-4 font-bold">
                                <span>Updated Tuition Cost</span>
                                <span className="font-mono text-lg">ZMW {totalCost.toFixed(2)}</span>
                             </div>
                        </CardContent>
                        )}
                    </Card>
                )})}
            </div>
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
                            <TabsTrigger value="pending">Pending ({loading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : pendingRequests.length})</TabsTrigger>
                            <TabsTrigger value="approved">Approved ({loading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : approvedRequests.length})</TabsTrigger>
                            <TabsTrigger value="completed">Enrolled ({loading ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : completedRequests.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="mt-4">
                           {renderRequestList(pendingRequests, 'pending')}
                        </TabsContent>
                        <TabsContent value="approved" className="mt-4">
                           {renderRequestList(approvedRequests, 'approved')}
                        </TabsContent>
                         <TabsContent value="completed" className="mt-4">
                           {renderRequestList(completedRequests, 'completed')}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

    
