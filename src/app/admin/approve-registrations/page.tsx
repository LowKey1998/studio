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
    CalendarDays,
    RotateCcw,
    BookOpen,
    Tag,
    Receipt,
    Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, remove, set, serverTimestamp, push } from 'firebase/database';
import { format, parseISO, isAfter, addDays } from 'date-fns';
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
    AlertDialogTitle,
    AlertDialogTrigger
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
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { syncInvoiceToQuickbooks } from '@/ai/flows/sync-to-quickbooks';
import { syncInvoiceToSage } from '@/ai/flows/sync-to-sage';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculateBilling, type BillingPolicy } from '@/lib/billing-utils';

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
  scholarshipId?: string;
  scholarshipPercentage?: number;
  programmeId: string;
  programmeName: string;
  optionalFees: string[];
  academicHistory: Record<string, 'Passed' | 'Failed'>;
  amountPaid: number;
  billingPolicy: BillingPolicy;
  semesterTuitionFee: number;
  source: 'auto' | 'manual';
  lateFee?: number;
};

type Scholarship = {
    id: string;
    name: string;
    percentage: number;
    description: string;
    donor?: string;
};

type EnrollmentRequest = {
    id: string;
    userId: string;
    studentId: string;
    studentName: string;
    courseId: string;
    courseCode: string;
    courseName: string;
    semesterId: string;
    status: 'Pending' | 'Approved' | 'Declined';
    timestamp: number;
    totalDue?: number;
    totalPaid?: number;
    balance?: number;
};

type GroupedRequests = Record<string, RegistrationRequest[]>;

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
    year: number;
    status?: string;
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
    const [classRequests, setClassRequests] = React.useState<EnrollmentRequest[]>([]);
    
    const [allCourses, setAllCourses] = React.useState<Map<string, Course>>(new Map());
    const [allProgrammes, setAllProgrammes] = React.useState<Map<string, any>>(new Map());
    const [allSemesters, setAllSemesters] = React.useState<Map<string, any>>(new Map());
    const [allIntakes, setAllIntakes] = React.useState<Map<string, any>>(new Map());
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [allScholarships, setAllScholarships] = React.useState<Scholarship[]>([]);
    const [allOptionalFees, setAllOptionalFees] = React.useState<Map<string, Fee>>(new Map());
    const [allMandatoryFees, setAllMandatoryFees] = React.useState<Map<string, Fee>>(new Map());
    const [allUsers, setAllUsers] = React.useState<Record<string, any>>({});
    const [enrollmentPolicy, setEnrollmentPolicy] = React.useState('onFullPayment');
    
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null); 
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    const [activeTab, setActiveTab] = React.useState('pending');

    const [editingSelections, setEditingSelections] = React.useState<Record<string, string[]>>({});
    const [scholarshipReviewRequest, setScholarshipReviewRequest] = React.useState<RegistrationRequest | null>(null);
    const [selectedScholarshipId, setSelectedScholarshipId] = React.useState<string>('');
    
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
            const [coursesSnap, programmesSnap, optionalFeesSnap, mandatoryFeesSnap, registrationsSnap, settingsSnap, semestersSnap, intakesSnap, coursePathsSnap, assessmentsSnap, transactionsSnap, classReqsSnap, invoicesSnap, scholarshipsSnap, usersSnap] = await Promise.all([
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
                get(ref(db, 'classEnrollmentRequests')),
                get(ref(db, 'invoices')),
                get(ref(db, 'scholarships')),
                get(ref(db, 'users'))
            ]);
            
            const usersMap = usersSnap.val() || {};
            setAllUsers(usersMap);

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

            let scholarshipsList: Scholarship[] = [];
            if (scholarshipsSnap.exists()) {
                scholarshipsList = Object.entries(scholarshipsSnap.val()).map(([id, data]: [string, any]) => ({ id, ...data }));
                setAllScholarships(scholarshipsList);
            }

            const optionalFeesData = new Map<string, Fee>();
            if (optionalFeesSnap.exists()) {
                Object.entries(optionalFeesSnap.val()).forEach(([id, data]) => optionalFeesData.set(id, { id, ...(data as Omit<Fee, 'id'>) }));
            }
            setAllOptionalFees(optionalFeesData);

            const mandatoryFeesData = new Map<string, Fee>();
            if (mandatoryFeesSnap.exists()) {
                Object.entries(mandatoryFeesSnap.val()).forEach(([id, data]) => mandatoryFeesData.set(id, { id, ...(data as Omit<Fee, 'id'>) }));
            }
            setAllMandatoryFees(mandatoryFeesData);
            
            const assessmentsData = assessmentsSnap.exists() ? assessmentsSnap.val() : {};
            const allTransactions = transactionsSnap.exists() ? Object.values(transactionsSnap.val() as Record<string, any>) : [];
            const allInvoices = invoicesSnap.val() || {};

            // 1. Process Main Registrations
            if (registrationsSnap.exists()) {
                const allRegistrations = registrationsSnap.val();
                const pending: RegistrationRequest[] = [], approved: RegistrationRequest[] = [], completed: RegistrationRequest[] = [];

                for (const userId in allRegistrations) {
                    const userRegistrations = allRegistrations[userId];
                    const userData = usersMap[userId];
                    if (!userData) continue;

                    for (const semesterId in userRegistrations) {
                        const registration = userRegistrations[semesterId];
                        const semesterInfo = semestersData.get(semesterId);
                        
                        if (['Pending Approval', 'Pending Payment', 'Completed'].includes(registration.status)) {
                            const academicHistory: Record<string, 'Passed' | 'Failed'> = {};
                            
                            for (const prevSemesterId in userRegistrations) {
                                if(prevSemesterId === semesterId) continue;
                                const prevReg = userRegistrations[prevSemesterId];
                                if(prevReg.status === 'Completed') {
                                    const coursesArr = Array.isArray(prevReg.courses) ? prevReg.courses : Object.keys(prevReg.courses || {});
                                    coursesArr.forEach((courseId: string) => {
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
                                semesterName: semesterInfo?.name || 'Unknown Semester',
                                studentName: userData.name,
                                studentId: userData.id,
                                studentIntakeId: userData.intakeId,
                                courseIds: Array.isArray(registration.courses) ? registration.courses : Object.keys(registration.courses || {}),
                                invoiceId: registration.invoiceId,
                                registrationDate: registration.registrationDate,
                                status: registration.status,
                                applyScholarship: registration.applyScholarship || false,
                                scholarshipStatus: registration.scholarshipStatus,
                                scholarshipId: registration.scholarshipId,
                                scholarshipPercentage: registration.scholarshipPercentage || 0,
                                programmeId: registration.programmeId,
                                programmeName: programmesData.get(registration.programmeId)?.name || 'Unknown Programme',
                                optionalFees: registration.optionalFees || [],
                                academicHistory,
                                amountPaid,
                                billingPolicy: semesterInfo?.billingPolicy || 'course',
                                semesterTuitionFee: Number(semesterInfo?.tuitionFee || 0),
                                source: registration.source || 'manual',
                                lateFee: allInvoices[userId]?.[registration.invoiceId]?.lateFee || 0
                            };
                            if (registration.status === 'Pending Approval') pending.push(requestData);
                            else if (registration.status === 'Pending Payment') approved.push(requestData);
                            else completed.push(requestData);
                        }
                    }
                }
                
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
                [...pending].forEach(req => {
                    initialEdits[`${req.userId}-${req.semesterId}`] = req.courseIds;
                });
                setEditingSelections(initialEdits);
            }

            // 2. Process Class Enrollment Requests
            if (classReqsSnap.exists()) {
                const reqs = Object.entries(classReqsSnap.val()).map(([id, data]: [string, any]) => {
                    const userId = data.userId;
                    const semId = data.semesterId;
                    const studentReg = registrationsSnap.val()?.[userId]?.[semId];
                    const invoiceId = studentReg?.invoiceId;
                    const invoice = allInvoices[userId]?.[invoiceId];

                    let totalDue = 0;
                    if (invoice) {
                        const tuition = Number(invoice.totalTuition || 0);
                        const mandatory = Number(invoice.totalMandatoryFees || 0);
                        const optional = Number(invoice.totalOptionalFees || 0);
                        const late = Number(invoice.lateFee || 0);
                        const percentage = Number(invoice.scholarshipPercentage || 100);

                        totalDue = invoice.applyScholarship 
                            ? (tuition * (1 - (percentage / 100))) + mandatory + optional + late
                            : tuition + mandatory + optional + late;
                    }

                    const totalPaid = allTransactions
                        .filter(tx => tx.userId === userId && tx.invoiceId === invoiceId && tx.status === 'successful')
                        .reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

                    return {
                        id,
                        ...data,
                        totalDue,
                        totalPaid,
                        balance: Math.max(0, totalDue - totalPaid)
                    } as EnrollmentRequest;
                }).filter(r => r.status === 'Pending');
                setClassRequests(reqs.sort((a,b) => b.timestamp - a.timestamp));
            } else {
                setClassRequests([]);
            }

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

                const breakdown = calculateBilling({
                    policy: request.billingPolicy,
                    semesterTuition: request.semesterTuitionFee,
                    courses: finalCourses.map(id => ({ id, cost: allCourses.get(id)?.cost || 0 })),
                    mandatoryFees: Array.from(allMandatoryFees.values()),
                    optionalFees: (request.optionalFees || []).map(id => ({ name: allOptionalFees.get(id)?.name || 'Fee', amount: allOptionalFees.get(id)?.amount || 0 })),
                    applyScholarship: !!request.applyScholarship,
                    scholarshipPercentage: request.scholarshipPercentage || 0,
                    lateFee: request.lateFee || 0
                });

                await update(invoiceRef, {
                    courses: finalCourses,
                    totalTuition: breakdown.baseTuition,
                    totalMandatoryFees: breakdown.totalMandatoryFees,
                    totalOptionalFees: breakdown.totalOptionalFees,
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

                const syncData = {
                    invoiceId: request.invoiceId,
                    studentName: request.studentName,
                    studentId: request.studentId,
                    amount: breakdown.grandTotal,
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

    const handleClassRequestDecision = async (request: EnrollmentRequest, decision: 'Approved' | 'Declined') => {
        setActionLoading(request.id);
        try {
            if (decision === 'Approved') {
                const regRef = ref(db, `registrations/${request.userId}/${request.semesterId}`);
                const regSnap = await get(regRef);
                const currentReg = regSnap.exists() ? regSnap.val() : null;

                if (!currentReg) {
                    throw new Error("Student registration record not found for this semester.");
                }

                const currentCourses = Array.isArray(currentReg.courses) ? currentReg.courses : Object.keys(currentReg.courses || {});
                const updatedCourses = [...new Set([...currentCourses, request.courseId])];

                await update(regRef, { courses: updatedCourses });

                const semesterInfo = allSemesters.get(request.semesterId);
                const billingPolicy = semesterInfo?.billingPolicy || 'course';

                const invoiceRef = ref(db, `invoices/${request.userId}/${currentReg.invoiceId}`);
                const invoiceSnap = await get(invoiceRef);
                if (invoiceSnap.exists()) {
                    const breakdown = calculateBilling({
                        policy: billingPolicy,
                        semesterTuition: Number(semesterInfo?.tuitionFee || 0),
                        courses: updatedCourses.map(id => ({ id, cost: allCourses.get(id)?.cost || 0 })),
                        mandatoryFees: Array.from(allMandatoryFees.values()),
                        optionalFees: (currentReg.optionalFees || []).map((id:string) => ({ name: allOptionalFees.get(id)?.name || 'Fee', amount: allOptionalFees.get(id)?.amount || 0 })),
                        applyScholarship: !!currentReg.applyScholarship,
                        scholarshipPercentage: currentReg.scholarshipPercentage || 0,
                        lateFee: invoiceSnap.val().lateFee || 0
                    });

                    await update(invoiceRef, { 
                        courses: updatedCourses,
                        totalTuition: breakdown.baseTuition 
                    });
                }

                await createNotification(
                    request.userId,
                    `Your request to enroll in ${request.courseCode} has been approved.`,
                    '/student/classes'
                );
            } else {
                await createNotification(
                    request.userId,
                    `Your request to enroll in ${request.courseCode} was not approved.`,
                    '/student/registration'
                );
            }

            await update(ref(db, `classEnrollmentRequests/${request.id}`), { status: decision });
            toast({ title: `Request ${decision}` });
            fetchRequests();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleScholarshipDecision = async (decision: 'approve' | 'deny') => {
        if (!scholarshipReviewRequest) return;
        
        if (decision === 'approve' && !selectedScholarshipId) {
            toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select a scholarship to apply.' });
            return;
        }

        setActionLoading(scholarshipReviewRequest.userId);
        
        const request = scholarshipReviewRequest;
        const scholarship = allScholarships.find(s => s.id === selectedScholarshipId);
        const registrationRef = ref(db, `registrations/${request.userId}/${request.semesterId}`);
        const invoiceRef = ref(db, `invoices/${request.userId}/${request.invoiceId}`);

        try {
            const isApproved = decision === 'approve';
            const newStatus = enrollmentPolicy === 'onApproval' ? 'Completed' : 'Pending Payment';
            
            const updates: any = {
                status: newStatus,
                scholarshipStatus: isApproved ? 'Approved' : 'Denied',
                applyScholarship: isApproved
            };

            const invoiceUpdates: any = { applyScholarship: isApproved };

            if (isApproved && scholarship) {
                updates.scholarshipId = scholarship.id;
                updates.scholarshipName = scholarship.name;
                updates.scholarshipPercentage = scholarship.percentage;
                
                invoiceUpdates.scholarshipId = scholarship.id;
                invoiceUpdates.scholarshipPercentage = scholarship.percentage;
            } else if (!isApproved) {
                updates.scholarshipId = null;
                updates.scholarshipName = null;
                updates.scholarshipPercentage = null;
                invoiceUpdates.scholarshipId = null;
                invoiceUpdates.scholarshipPercentage = null;
            }

            await update(registrationRef, updates);
            await update(invoiceRef, invoiceUpdates);

            const msg = isApproved
                ? `Congratulations! Your scholarship application for ${request.semesterName} has been approved (${scholarship?.name} - ${scholarship?.percentage}% waiver).`
                : `Your scholarship application for ${request.semesterName} was not approved. The full tuition amount is now due.`;

            await createNotification(request.userId, msg, '/student/registration');
            
            toast({ title: `Scholarship ${isApproved ? 'Approved' : 'Denied'}` });
            fetchRequests();
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
            setScholarshipReviewRequest(null);
            setSelectedScholarshipId('');
        }
    }
    
    const handleCourseSelectionChange = (reqId: string, courseId: string) => {
        setEditingSelections(prev => {
            const currentSelection = prev[reqId] || [];
            const newSelection = currentSelection.includes(courseId) ? currentSelection.filter(id => id !== courseId) : [...currentSelection, courseId];
            return { ...prev, [reqId]: newSelection };
        });
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

    const renderRequestList = (requests: RegistrationRequest[], type: 'pending' | 'approved' | 'completed') => {
        if (loading) return (<div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}</div>);
        
        const groupRequests = (reqList: RegistrationRequest[]): GroupedRequests => reqList.reduce((acc, req) => {
            const key = req.semesterName;
            if (!acc[key]) acc[key] = [];
            acc[key].push(req);
            return acc;
        }, {} as GroupedRequests);

        const grouped = groupRequests(requests);

        if (Object.keys(grouped).length === 0) return (<div className="py-16 text-center text-muted-foreground"><UserCheck className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">All Clear!</h3><p className="mt-2 text-sm">There are no {type} registrations to show.</p></div>);

        return (
             <Accordion type="multiple" defaultValue={Object.keys(grouped)} className="w-full space-y-4">
                 {Object.entries(grouped).map(([semesterName, reqs]) => (
                     <AccordionItem value={semesterName} key={semesterName} className="border-none">
                        <AccordionTrigger className="bg-muted px-4 py-2 rounded-md font-bold text-lg hover:no-underline">{semesterName} ({reqs.length})</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-4">
                             {reqs.map((request) => {
                                const reqId = `${request.userId}-${request.semesterId}`;
                                const currentSelection = editingSelections[reqId] || [];
                                const activeCourses = type === 'pending' ? currentSelection : request.courseIds;
                                
                                const breakdown = calculateBilling({
                                    policy: request.billingPolicy,
                                    semesterTuition: request.semesterTuitionFee,
                                    courses: activeCourses.map(id => ({ id, cost: allCourses.get(id)?.cost || 0 })),
                                    mandatoryFees: Array.from(allMandatoryFees.values()),
                                    optionalFees: (request.optionalFees || []).map(id => ({ name: allOptionalFees.get(id)?.name || 'Fee', amount: allOptionalFees.get(id)?.amount || 0 })),
                                    applyScholarship: !!request.applyScholarship,
                                    scholarshipPercentage: request.scholarshipPercentage || 0,
                                    lateFee: request.lateFee || 0
                                });
                                
                                const regDateValid = request.registrationDate && !isNaN(new Date(request.registrationDate).getTime());

                                return (
                                <Card key={reqId} className="overflow-hidden shadow-md border-l-4 border-l-primary">
                                    <CardHeader className="bg-muted/50 p-4">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-lg">{request.studentName}</CardTitle>
                                                    <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest opacity-70">
                                                        {request.billingPolicy === 'semester' ? 'Flat Fee' : 'Per Course'}
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-[8px] uppercase font-black tracking-tighter opacity-60">
                                                        Source: {request.source || 'Manual'}
                                                    </Badge>
                                                </div>
                                                <CardDescription>ID: {request.studentId} | Programme: <strong>{request.programmeName}</strong> | Intake: <strong>{allIntakes.get(request.studentIntakeId)?.name || 'N/A'}</strong></CardDescription>
                                                <CardDescription className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Submitted: {regDateValid ? format(new Date(request.registrationDate), 'PPP') : 'Date Pending'}
                                                </CardDescription>
                                                {request.applyScholarship && type !== 'completed' && ( 
                                                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                                                        <GraduationCap className="mr-2 h-4 w-4" />
                                                        {request.scholarshipStatus === 'Approved' ? 'Scholarship Awarded' : 'Scholarship Applicant'}
                                                    </Badge>
                                                )}
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
                                                {Array.from(allCourses.values()).filter(c => c.status === 'active' && (activeCourses.includes(c.id) || request.courseIds.includes(c.id))).map(course => {
                                                    const history = request.academicHistory[course.id];
                                                    const isStudentSelected = request.courseIds.includes(course.id);
                                                    
                                                    return(
                                                    <div key={course.id} className={cn(
                                                        "flex items-center gap-4 rounded-xl border p-3 text-sm transition-all",
                                                        activeCourses.includes(course.id) ? "bg-primary/5 border-primary/20" : "opacity-50 grayscale bg-muted/20"
                                                    )}>
                                                        <Checkbox id={`${reqId}-${course.id}`} checked={activeCourses.includes(course.id)} onCheckedChange={() => handleCourseSelectionChange(reqId, course.id)} disabled={type !== 'pending' || request.billingPolicy === 'semester'}/>
                                                        <div className="flex-1 flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">{course.code}</span>
                                                                <span className="text-muted-foreground text-xs">{course.name}</span>
                                                                {!isStudentSelected && activeCourses.includes(course.id) && <Badge variant="secondary" className="h-4 text-[8px] uppercase bg-blue-100 text-blue-700">Added by Registrar</Badge>}
                                                            </div>
                                                            <div className='flex gap-2 items-center'>
                                                                {history && (<Badge variant={history === 'Passed' ? 'default' : 'destructive'} className='h-4 px-1.5 text-[9px] gap-1'><History className="h-2.5 w-2.5"/>Previously {history}</Badge>)}
                                                            </div>
                                                        </div>
                                                        {request.billingPolicy === 'course' && (
                                                            <Badge variant="outline" className="h-6 font-mono text-[10px] bg-background border-primary/20">
                                                                ZMW {course.cost.toFixed(2)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )})}
                                            </div>
                                        </div>
                                        
                                        <Separator />
                                        
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                                            <div className="flex items-center gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none">Total Invoiced</span>
                                                    <span className="font-black text-lg">ZMW {breakdown.grandTotal.toFixed(2)}</span>
                                                </div>
                                                <div className="flex flex-col border-l pl-6">
                                                    <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-none">Amount Paid</span>
                                                    <span className={cn("font-black text-lg", request.amountPaid > 0 ? "text-green-600" : "text-muted-foreground")}>ZMW {request.amountPaid.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black uppercase text-primary tracking-widest leading-none">Outstanding Balance</span>
                                                <span className={cn("text-2xl font-black", (breakdown.grandTotal - request.amountPaid) > 0.01 ? "text-destructive" : "text-green-600")}>ZMW {Math.max(0, breakdown.grandTotal - request.amountPaid).toFixed(2)}</span>
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
                        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 rounded-xl">
                            <TabsTrigger value="pending" className="py-3 rounded-lg font-bold">Pending ({loading ? '...' : Object.values(pendingRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="approved" className="py-3 rounded-lg font-bold">Approved ({loading ? '...' : Object.values(approvedRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="completed" className="py-3 rounded-lg font-bold">Enrolled ({loading ? '...' : Object.values(completedRequests).flat().length})</TabsTrigger>
                            <TabsTrigger value="requests" className="py-3 rounded-lg font-bold">Class Requests ({loading ? '...' : classRequests.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="mt-6">{renderRequestList(Object.values(pendingRequests).flat(), 'pending')}</TabsContent>
                        <TabsContent value="approved" className="mt-6">{renderRequestList(Object.values(approvedRequests).flat(), 'approved')}</TabsContent>
                        <TabsContent value="completed" className="mt-6">{renderRequestList(Object.values(completedRequests).flat(), 'completed')}</TabsContent>
                        <TabsContent value="requests" className="mt-6">
                            <div className="grid gap-4">
                                {classRequests.map(req => (
                                    <Card key={req.id} className="border-l-4 border-l-blue-500 shadow-sm">
                                        <CardHeader className="py-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-lg">{req.studentName} ({req.studentId})</CardTitle>
                                                    <CardDescription>Requested: <strong>{req.courseCode}: {req.courseName}</strong></CardDescription>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] font-black uppercase opacity-60">
                                                    <CalendarDays className="h-3 w-3 mr-1" />
                                                    {format(new Date(req.timestamp), 'PPP')}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pb-4">
                                            <div className="grid sm:grid-cols-2 gap-6 items-center">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Financial Audit</Label>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] uppercase font-bold opacity-60">Paid to date</span>
                                                            <span className="font-black text-green-600">ZMW {req.totalPaid?.toFixed(2)}</span>
                                                        </div>
                                                        <Separator orientation="vertical" className="h-8" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] uppercase font-bold opacity-60">Out. Balance</span>
                                                            <span className="font-black text-destructive">ZMW {req.balance?.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" className="text-destructive font-bold" onClick={() => handleClassRequestDecision(req, 'Declined')} disabled={!!actionLoading}>
                                                        {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4 mr-1"/>}
                                                        Decline
                                                    </Button>
                                                    <Button size="sm" className="bg-primary font-bold shadow-md" onClick={() => handleClassRequestDecision(req, 'Approved')} disabled={!!actionLoading}>
                                                        {actionLoading === req.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4 mr-1"/>}
                                                        Approve Enrollment
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {classRequests.length === 0 && !loading && (
                                    <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                                        <BookOpen className="mx-auto h-12 w-12 opacity-10 mb-4" />
                                        <p>No individual class enrollment requests pending review.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                     </Tabs>
                </CardContent>
            </Card>

            <Dialog open={!!scholarshipReviewRequest} onOpenChange={() => setScholarshipReviewRequest(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <GraduationCap className="h-6 w-6" />
                            <DialogTitle className="text-xl">Scholarship & Semester Registration</DialogTitle>
                        </div>
                        <DialogDescription className="text-base">
                            Reviewing both the **Semester Registration** and **Tuition Waiver** application for <span className="font-black text-foreground">{scholarshipReviewRequest?.studentName}</span>. 
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 bg-primary/5 border rounded-xl space-y-3 text-sm shadow-inner">
                            <div className="flex justify-between"><span>Programme:</span> <span className="font-bold">{scholarshipReviewRequest?.programmeName}</span></div>
                            <div className="flex justify-between"><span>Intake:</span> <span className="font-bold">{allIntakes.get(scholarshipReviewRequest?.studentIntakeId || '')?.name}</span></div>
                            <div className="flex justify-between"><span>Phase:</span> <span className="font-bold">{scholarshipReviewRequest?.semesterName}</span></div>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Select Scholarship to Apply</Label>
                            <Select value={selectedScholarshipId} onValueChange={setSelectedScholarshipId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a scholarship..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allScholarships.length > 0 ? allScholarships.map(s => (
                                        <SelectItem key={s.id} value={s.id}>
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">{s.name} ({s.percentage}% Waiver)</span>
                                                {s.donor && <span className="text-[10px] opacity-60">Funder: {s.donor}</span>}
                                            </div>
                                        </SelectItem>
                                    )) : (
                                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                                            No active scholarships found in management.
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <Alert variant="default" className="bg-blue-50 border-blue-200 py-3 shadow-sm">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertDescription className="text-[10px] leading-relaxed font-medium text-blue-800">
                                <strong>Important:</strong> Approving this request will simultaneously **Authorize the Semester Enrollment** and apply the selected **Waiver Percentage** to the tuition line item for this registration cycle.
                            </AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => handleScholarshipDecision('deny')} disabled={!!actionLoading}>Deny Application</Button>
                        <Button className="flex-1 shadow-md font-bold" onClick={() => handleScholarshipDecision('approve')} disabled={!!actionLoading || !selectedScholarshipId}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Authorize & Award
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
