
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Clock, DollarSign, GraduationCap, MinusCircle, PlusCircle, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, child, push, remove, onValue, query, equalTo, orderByChild } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
    lecturerId: string;
    lecturerName?: string;
    status: 'active' | 'archived';
    year: number;
};

type Fee = {
    id: string;
    name: string;
    amount: number;
}

type UserData = {
    id: string;
    name: string;
    programmeId: string;
    intakeId: string;
};

type Invoice = {
    invoiceId: string;
    totalTuition: number;
    totalMandatoryFees: number;
    totalOptionalFees: number;
    lateFee?: number;
    paymentPlan: string;
    dateCreated: string;
    semester: string; // Semester Name
    semesterId: string;
    courses: string[];
    optionalFees: string[];
    applyScholarship?: boolean;
};

type Registration = {
    courses: string[];
    originalCourses?: string[];
    optionalFees: string[];
    invoiceId: string;
    status: 'Pending Approval' | 'Pending Payment' | 'Completed';
    paymentPlan: string;
    programmeId: string;
    applyScholarship?: boolean;
    invoiceDetails?: Invoice;
    semesterName: string;
    installmentsPaid?: number;
    totalInstallments?: number;
}

type PaymentPlan = {
    id: string;
    name: string;
    installments: number;
    installmentPercentages: number[];
    archived?: boolean;
}

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
    lateRegistrationActive?: boolean;
    paymentPlanIds?: Record<string, boolean>;
    mandatoryFees?: Record<string, Fee>;
    optionalFees?: Record<string, Fee>;
}

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, { courses: string[] }> };

type GroupedCourses = {
    [year: string]: Course[];
}

type RegistrationPolicy = {
    lateRegistrationFee: number;
}

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
}


export default function RegistrationPage() {
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [semesterOptionalFees, setSemesterOptionalFees] = React.useState<Fee[]>([]);
    const [semesterMandatoryFees, setSemesterMandatoryFees] = React.useState<Fee[]>([]);
    
    const [pathCourses, setPathCourses] = React.useState<Course[]>([]);
    const [otherCourses, setOtherCourses] = React.useState<Course[]>([]);
    
    const [selectedCourses, setSelectedCourses] = React.useState<string[]>([]);
    const [selectedFees, setSelectedFees] = React.useState<string[]>([]);
    const [applyScholarship, setApplyScholarship] = React.useState(false);

    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    
    const [openSemesters, setOpenSemesters] = React.useState<Semester[]>([]);
    const [selectedSemesterId, setSelectedSemesterId] = React.useState<string>("");
    
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [semesterPaymentPlans, setSemesterPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [selectedPaymentPlanId, setSelectedPaymentPlanId] = React.useState<string>('');
    const [registrationPolicy, setRegistrationPolicy] = React.useState<RegistrationPolicy>({ lateRegistrationFee: 0 });
    const [coursePaths, setCoursePaths] = React.useState<CoursePath[]>([]);

    const [existingRegistration, setExistingRegistration] = React.useState<Registration | null>(null);
    const [registeredCourses, setRegisteredCourses] = React.useState<Course[]>([]);

    const router = useRouter();
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
          } else {
              router.push('/login');
          }
        });
        return () => unsubscribe();
      }, [router]);
      
    // Fetch static data once
    React.useEffect(() => {
        const paymentPlansRef = ref(db, 'settings/paymentPlans');
        const regPolicyRef = ref(db, 'settings/registrationPolicy');
        const coursesRef = ref(db, 'courses');
        const pathsRef = ref(db, 'coursePaths');

        const unsubPaymentPlans = onValue(paymentPlansRef, (snapshot) => {
            if (snapshot.exists()) {
                setAllPaymentPlans(Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })));
            } else { setAllPaymentPlans([]) }
        })
        const unsubRegPolicy = onValue(regPolicyRef, (snapshot) => {
            if(snapshot.exists()) setRegistrationPolicy(snapshot.val());
        });
        const unsubCourses = onValue(coursesRef, (snapshot) => {
            if(snapshot.exists()) setAllCourses(Object.values(snapshot.val()));
        });
        const unsubPaths = onValue(pathsRef, (snapshot) => {
             if(snapshot.exists()) setCoursePaths(Object.values(snapshot.val()));
        });
        
        return () => {
            unsubPaymentPlans();
            unsubRegPolicy();
            unsubCourses();
            unsubPaths();
        };
    },[]);

    // Listen for open semesters
    React.useEffect(() => {
        const semestersRef = ref(db, 'semesters');
        const unsubSemesters = onValue(semestersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: Semester[] = Object.keys(data)
                    .map(key => ({ id: key, ...data[key] }))
                    .filter(s => s.status === 'Open');
                setOpenSemesters(list.sort((a,b) => b.name.localeCompare(a.name)));
                if (list.length > 0 && !selectedSemesterId) {
                    setSelectedSemesterId(list[0].id);
                } else if (list.length === 0) {
                    setSelectedSemesterId("");
                }
            } else {
                 setOpenSemesters([]);
                 setSelectedSemesterId("");
            }
        });

        return () => unsubSemesters();
    }, [selectedSemesterId]);

    // Main data fetching and real-time update logic
    const fetchDataForSemester = React.useCallback(async (user: User, uData: UserData) => {
        setLoading(true);
        try {
            const registrationRef = ref(db, `registrations/${user.uid}/${selectedSemesterId}`);
            const transactionsQuery = query(ref(db, 'transactions'), orderByChild('userId'), equalTo(user.uid));
            
            const [regSnap, txSnap, settingsSnap, invoiceSnap, usersSnap] = await Promise.all([
                get(registrationRef),
                get(transactionsQuery),
                get(ref(db, 'settings')),
                get(ref(db, `invoices/${user.uid}`)),
                get(ref(db, 'users'))
            ]);

            const regData = regSnap.exists() ? regSnap.val() : null;
            const allTransactionsData = txSnap.exists() ? txSnap.val() : {};

            if (regData) {
                const currentSemester = openSemesters.find(s => s.id === selectedSemesterId);
                if (currentSemester) {
                    setSemesterOptionalFees(currentSemester.optionalFees ? Object.keys(currentSemester.optionalFees).map(id => ({ id, ...currentSemester.optionalFees![id] })) : []);
                    setSemesterMandatoryFees(currentSemester.mandatoryFees ? Object.values(currentSemester.mandatoryFees) : []);
                }

                if (invoiceSnap.exists() && invoiceSnap.val()[regData.invoiceId]) {
                    regData.invoiceDetails = invoiceSnap.val()[regData.invoiceId];
                }
                
                 if (allTransactionsData) {
                    const invoiceTransactions = Object.values(allTransactionsData).filter((tx: any) => tx.invoiceId === regData.invoiceId && tx.status === 'successful');
                    const totalPaid = invoiceTransactions.reduce((sum, tx: any) => sum + tx.amount, 0);
                    const totalDue = (regData.invoiceDetails?.totalTuition || 0) + (regData.invoiceDetails?.totalMandatoryFees || 0) + (regData.invoiceDetails?.totalOptionalFees || 0);
                    const plan = allPaymentPlans.find(p => p.name === regData.paymentPlan) || { installments: 1, installmentPercentages: [100]};
                    
                    let paidCount = 0;
                    let paidAmountTracker = totalPaid;
                    for (let i = 0; i < plan.installments; i++) {
                        const installmentAmount = totalDue * ((plan.installmentPercentages[i] || (100 / plan.installments)) / 100);
                        if (paidAmountTracker >= installmentAmount) {
                            paidCount++;
                            paidAmountTracker -= installmentAmount;
                        } else {
                            break;
                        }
                    }
                    regData.installmentsPaid = paidCount;
                    regData.totalInstallments = plan.installments;
                }
                setExistingRegistration(regData);

                if (allCourses.length > 0) {
                     const userMap = new Map<string, string>();
                     if(usersSnap.exists()) Object.keys(usersSnap.val()).forEach(uid => userMap.set(uid, usersSnap.val()[uid].name));
                     const coursesList = regData.courses.map((courseId: string) => {
                         const courseData = allCourses.find(c => c.id === courseId);
                         return { ...(courseData as Course), lecturerName: userMap.get(courseData?.lecturerId || '') || 'N/A' };
                     });
                     setRegisteredCourses(coursesList);
                }

            } else { // No existing registration, show course selection
                 setExistingRegistration(null);
                 setRegisteredCourses([]);
                 
                 const semesterOfferingsSnap = await get(ref(db, `semesterOfferings/${openSemesters.find(s => s.id === selectedSemesterId)?.name}/courseIds`));
                 const availableCourseIds = semesterOfferingsSnap.exists() ? semesterOfferingsSnap.val() : [];
                 const path = coursePaths.find(p => p.intakeId === uData.intakeId && p.programmeId === uData.programmeId);
                 
                 const pathCourseIds = new Set<string>();
                 if(path?.semesters){
                     Object.values(path.semesters).forEach(sem => sem.courses.forEach(cid => pathCourseIds.add(cid)));
                 }
                 
                 const availableAndInPath = availableCourseIds.filter((id: string) => pathCourseIds.has(id));
                 const availableNotInPath = availableCourseIds.filter((id: string) => !pathCourseIds.has(id));
                 
                 setPathCourses(allCourses.filter(c => availableAndInPath.includes(c.id)));
                 setOtherCourses(allCourses.filter(c => availableNotInPath.includes(c.id)));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Error loading data' });
        } finally {
            setLoading(false);
        }
    }, [selectedSemesterId, openSemesters, allPaymentPlans, toast, allCourses, coursePaths]);


    React.useEffect(() => {
        if (!currentUser || !selectedSemesterId || !userData) {
            setLoading(false);
            setExistingRegistration(null);
            return;
        }

        fetchDataForSemester(currentUser, userData);
        const registrationRef = ref(db, `registrations/${currentUser.uid}/${selectedSemesterId}`);
        const regUnsub = onValue(registrationRef, () => { fetchDataForSemester(currentUser, userData); });

        return () => { regUnsub(); };
    }, [currentUser, selectedSemesterId, userData, fetchDataForSemester]);


    // Update available payment plans when semester changes
    React.useEffect(() => {
        const semester = openSemesters.find(s => s.id === selectedSemesterId);
        if (semester) {
             setSemesterOptionalFees(semester.optionalFees ? Object.keys(semester.optionalFees).map(id => ({ id, ...semester.optionalFees![id] })) : []);
             setSemesterMandatoryFees(semester.mandatoryFees ? Object.values(semester.mandatoryFees) : []);

            if (semester.paymentPlanIds && allPaymentPlans.length > 0) {
                const planIds = Object.keys(semester.paymentPlanIds);
                get(ref(db, 'calendarEvents')).then(eventsSnapshot => {
                    const eventMap = new Map<string, boolean>();
                    if(eventsSnapshot.exists()){
                        Object.values(eventsSnapshot.val()).forEach((event: any) => eventMap.set(event.title.trim(), true));
                    }

                    const plansForSemester = allPaymentPlans
                        .filter(p => planIds.includes(p.id) && !p.archived)
                        .filter(plan => {
                            for(let i = 0; i < plan.installments; i++) {
                                const deadlineTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester.name}`;
                                if (!eventMap.has(deadlineTitle)) {
                                    return false;
                                }
                            }
                            return true;
                        });

                    setSemesterPaymentPlans(plansForSemester);
                    if (plansForSemester.length > 0) {
                        setSelectedPaymentPlanId(plansForSemester[0].id);
                    } else {
                        setSelectedPaymentPlanId('');
                    }
                });
            } else {
                setSemesterPaymentPlans([]);
                setSelectedPaymentPlanId('');
            }
        }
    }, [selectedSemesterId, openSemesters, allPaymentPlans]);

    const handleSelectCourse = (courseId: string) => {
        setSelectedCourses(prev => {
            if (prev.includes(courseId)) {
                return prev.filter(id => id !== courseId);
            } else {
                return [...prev, courseId];
            }
        });
    };

    const handleSelectFee = (feeId: string) => {
        setSelectedFees(prev => {
            if (prev.includes(feeId)) {
                return prev.filter(id => id !== feeId);
            } else {
                return [...prev, feeId];
            }
        });
    };

    const handleRegister = async () => {
        if (!userData?.programmeId) { toast({ variant: 'destructive', title: 'No Programme Assigned' }); return; }
        if (selectedCourses.length === 0) { toast({ variant: 'destructive', title: 'No Courses Selected' }); return; }
        if (!currentUser || !userData) { toast({ variant: 'destructive', title: 'Not Authenticated' }); return; }
        if (!selectedPaymentPlanId) { toast({ variant: 'destructive', title: 'Please select a payment plan.' }); return; }

        setSubmitting(true);
        const selectedSemester = openSemesters.find(s => s.id === selectedSemesterId);
        if (!selectedSemester) { toast({ variant: 'destructive', title: 'Invalid semester.' }); setSubmitting(false); return; }

        try {
            const settingsSnap = await get(ref(db, 'settings/registrationPolicy'));
            const policy = settingsSnap.exists() ? settingsSnap.val() : { lateRegistrationFee: 0 };
            
            let lateFee = 0;
            if (selectedSemester.lateRegistrationActive && policy.lateRegistrationFee > 0) {
                lateFee = policy.lateRegistrationFee;
            }

            const tuitionCost = selectedCourses.reduce((acc, courseId) => acc + (allCourses.find(c => c.id === courseId)?.cost || 0), 0);
            const optionalFeesCost = selectedFees.reduce((acc, feeId) => acc + (semesterOptionalFees.find(f => f.id === feeId)?.amount || 0), 0);
            const mandatoryFeesCost = semesterMandatoryFees.reduce((acc, fee) => acc + fee.amount, 0);

            const selectedPlan = allPaymentPlans.find(p => p.id === selectedPaymentPlanId);
            if (!selectedPlan) { toast({ variant: 'destructive', title: 'Invalid payment plan selected.' }); setSubmitting(false); return; }

            const invoiceRef = push(ref(db, `invoices/${currentUser.uid}`));
            const invoiceId = invoiceRef.key!;
            await set(invoiceRef, {
                invoiceId, courses: selectedCourses, optionalFees: selectedFees,
                totalTuition: tuitionCost, totalOptionalFees: optionalFeesCost, totalMandatoryFees: mandatoryFeesCost, lateFee,
                paymentPlan: selectedPlan.name, amountPaid: 0, status: 'pending', dateCreated: new Date().toISOString(),
                semester: selectedSemester.name, semesterId: selectedSemester.id, applyScholarship
            });

            const registrationRef = ref(db, `registrations/${currentUser.uid}/${selectedSemester.id}`);
            await set(registrationRef, {
                courses: selectedCourses, optionalFees: selectedFees, invoiceId, paymentPlan: selectedPlan.name, programmeId: userData.programmeId,
                registrationDate: new Date().toISOString(), status: 'Pending Approval', applyScholarship, semesterName: selectedSemester.name, installmentsPaid: 0, totalInstallments: selectedPlan.installments
            });

            const registrarIds = await getRegistrarIds();
            const notificationPromises = registrarIds.map(id => createNotification(id, `${userData.name} (${userData.id}) submitted registration for approval.`, '/admin/approve-registrations'));
            await Promise.all(notificationPromises);
            
            toast({ variant: 'success', title: 'Registration Submitted' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Registration Failed' });
        } finally {
            setSubmitting(false);
        }
    };
    
    const handleCancelRegistration = async () => {
        if (!currentUser || !existingRegistration || !selectedSemesterId) return;
        setSubmitting(true);
        try {
            await remove(ref(db, `invoices/${currentUser.uid}/${existingRegistration.invoiceId}`));
            await remove(ref(db, `registrations/${currentUser.uid}/${selectedSemesterId}`));
            toast({ variant: 'success', title: 'Registration Canceled' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Cancellation Failed'});
        } finally {
            setSubmitting(false);
        }
    };
    
    const selectedSemester = openSemesters.find(s => s.id === selectedSemesterId);
    const isLateRegistration = selectedSemester?.lateRegistrationActive ?? false;
    const lateFeeAmount = registrationPolicy?.lateRegistrationFee || 0;

    const {tuitionCost, feesCost, totalCost, payableAmount} = React.useMemo(() => {
        const tuition = selectedCourses.reduce((acc, courseId) => acc + (allCourses.find(c => c.id === courseId)?.cost || 0), 0);
        const optional = selectedFees.reduce((acc, feeId) => acc + (semesterOptionalFees.find(f => f.id === feeId)?.amount || 0), 0);
        const mandatory = semesterMandatoryFees.reduce((acc, fee) => acc + fee.amount, 0);
        const lateFee = isLateRegistration ? lateFeeAmount : 0;

        const total = tuition + optional + mandatory + lateFee;
        
        const payableBase = applyScholarship ? optional + mandatory + lateFee : total;
        
        const selectedPlan = allPaymentPlans.find(p => p.id === selectedPaymentPlanId);
        const firstInstallmentMultiplier = selectedPlan ? (selectedPlan.installmentPercentages?.[0] || 100) / 100 : 1;
        
        const payable = payableBase * firstInstallmentMultiplier;

        return { tuitionCost: tuition, feesCost: optional, totalCost: total, payableAmount: payable };
    }, [selectedCourses, allCourses, selectedFees, semesterOptionalFees, semesterMandatoryFees, selectedPaymentPlanId, allPaymentPlans, applyScholarship, isLateRegistration, lateFeeAmount]);

    if (loading) {
         return <div className="space-y-6"><Card className="shadow-lg"><CardHeader><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4" /></CardHeader><CardContent><div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-4 p-2"><Skeleton className="h-5 w-5" /><Skeleton className="h-5 w-full" /></div>))}</div></CardContent></Card></div>
    }
    
    if (existingRegistration && existingRegistration.status !== 'Completed') {
        const isPendingApproval = existingRegistration.status === 'Pending Approval';
        const finalCoursesSet = new Set(existingRegistration.courses);
        const originalCoursesSet = new Set(existingRegistration.originalCourses || existingRegistration.courses);
        const addedCourses = registeredCourses.filter(c => !originalCoursesSet.has(c.id));
        const removedCourses = (existingRegistration.originalCourses || []).filter(id => !finalCoursesSet.has(id)).map(id => allCourses.find(c => c.id === id) || registeredCourses.find(rc => rc.id === id)).filter(Boolean) as Course[];
        const invoiceDetails = existingRegistration.invoiceDetails;

        let statusText = existingRegistration.status;
        if (existingRegistration.status === 'Pending Payment' && existingRegistration.installmentsPaid! > 0) {
            statusText = `${existingRegistration.installmentsPaid} of ${existingRegistration.totalInstallments} Installments Paid`;
        }

        return (
             <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Registration Status: {statusText}</CardTitle>
                        <CardDescription>{isPendingApproval ? `Your course selection for ${existingRegistration.semesterName} is awaiting approval from the registrar.` : `Your registration for ${existingRegistration.semesterName} has been approved. Please complete the payment to finalize your enrollment.`}</CardDescription>
                        {existingRegistration.applyScholarship && (
                            <Alert variant="default" className="mt-2 bg-blue-50 border-blue-200 text-blue-800"><GraduationCap className="h-4 w-4 text-blue-700" /><AlertTitle className="text-blue-900">Scholarship Application Pending</AlertTitle><AlertDescription className="text-blue-700">Your scholarship application is under review. You will be notified of the outcome.</AlertDescription></Alert>
                        )}
                    </CardHeader>
                    <CardContent>
                         <Alert><Info className="h-4 w-4" /><AlertTitle>{isPendingApproval ? 'Awaiting Approval' : 'Action Required'}</AlertTitle><AlertDescription>{isPendingApproval ? "You cannot make changes while your registration is under review. You may cancel and start over if needed." : "To enroll in different courses, you must first cancel this registration and start over. This will delete your current unpaid invoice."}</AlertDescription></Alert>
                         {(addedCourses.length > 0 || removedCourses.length > 0) && (<div className="my-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4"><h4 className="font-bold text-yellow-800">Registration Modified</h4><p className="text-sm text-yellow-700">The registrar made the following changes to your course selection:</p>{addedCourses.length > 0 && (<ul className="mt-2 list-inside list-disc text-sm text-green-700">{addedCourses.map(c => <li key={c.id}><PlusCircle className="inline h-4 w-4 mr-1"/>{c.name} ({c.code}) was added.</li>)}</ul>)}{removedCourses.length > 0 && (<ul className="mt-2 list-inside list-disc text-sm text-red-700">{removedCourses.map(c => <li key={c.id}><MinusCircle className="inline h-4 w-4 mr-1"/>{c.name} ({c.code}) was removed.</li>)}</ul>)}</div>)}
                         <h3 className="font-bold text-lg my-4">Invoice Summary</h3>
                         <Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader><TableBody>{invoiceDetails?.totalTuition > 0 && <TableRow><TableCell>Total Tuition</TableCell><TableCell className="text-right">{invoiceDetails.totalTuition.toFixed(2)}</TableCell></TableRow>}{Object.values(semesterMandatoryFees).map(fee => (<TableRow key={fee.id}><TableCell>Mandatory Fee: {fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>))}{invoiceDetails?.optionalFees?.map(feeId => (<TableRow key={feeId}><TableCell>Optional Fee: {semesterOptionalFees.find(f=>f.id===feeId)?.name}</TableCell><TableCell className="text-right">{semesterOptionalFees.find(f=>f.id===feeId)?.amount.toFixed(2)}</TableCell></TableRow>))}{invoiceDetails?.lateFee && invoiceDetails.lateFee > 0 && <TableRow className="text-destructive"><TableCell>Late Registration Fee</TableCell><TableCell className="text-right">{invoiceDetails.lateFee.toFixed(2)}</TableCell></TableRow>}<TableRow className="font-bold bg-muted/50"><TableCell>Total Invoice Value</TableCell><TableCell className="text-right">ZMW {( (invoiceDetails?.totalTuition || 0) + (invoiceDetails?.totalMandatoryFees || 0) + (invoiceDetails?.totalOptionalFees || 0) + (invoiceDetails?.lateFee || 0)).toFixed(2)}</TableCell></TableRow>{invoiceDetails?.applyScholarship && <TableRow className="font-bold text-blue-600"><TableCell>Scholarship Applied</TableCell><TableCell className="text-right">- ZMW {invoiceDetails.totalTuition.toFixed(2)}</TableCell></TableRow>}<TableRow className="font-bold"><TableCell>Payment Plan</TableCell><TableCell className="text-right">{existingRegistration.paymentPlan}</TableCell></TableRow></TableBody></Table>
                    </CardContent>
                     <CardFooter className="flex flex-col items-end gap-4 sm:flex-row sm:justify-end sm:items-center"><Button variant="destructive" onClick={handleCancelRegistration} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Cancel Registration</Button>{existingRegistration.status === 'Pending Payment' && (<Button asChild size="lg"><Link href="/student/payments">Proceed to Payment</Link></Button>)}{existingRegistration.status === 'Pending Approval' && (<Button disabled size="lg"><Clock className="mr-2 h-4 w-4"/>Awaiting Approval</Button>)}</CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Course Registration</CardTitle>
                    <CardDescription>{openSemesters.length > 0 ? "Select a semester to enroll in courses." : "Course registration is not currently open."}</CardDescription>
                </CardHeader>
                {openSemesters.length > 0 && (
                <>
                <CardContent className="space-y-4">
                    <div className="space-y-1"><Label htmlFor="semester-select">Select Semester</Label><Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}><SelectTrigger id="semester-select"><SelectValue placeholder="Select a semester..." /></SelectTrigger><SelectContent>{openSemesters.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select></div>
                    {isLateRegistration && (
                         <Alert variant="destructive">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Late Registration</AlertTitle>
                            <AlertDescription>
                                This is a late registration. A non-refundable penalty fee of <strong>ZMW {lateFeeAmount.toFixed(2)}</strong> will be added to your invoice.
                            </AlertDescription>
                        </Alert>
                    )}
                    {selectedSemesterId ? ( <>
                        <Accordion type="multiple" defaultValue={['recommended', 'other']} className="w-full">
                           <AccordionItem value="recommended">
                                <AccordionTrigger className="font-bold text-lg flex items-center gap-2"><Star className="text-yellow-500 fill-yellow-400"/>Recommended Courses</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Course Code</TableHead><TableHead>Course Name</TableHead><TableHead>Lecturer</TableHead><TableHead className="text-right">Cost (ZMW)</TableHead></TableRow></TableHeader>
                                        <TableBody>{pathCourses.map((course) => (<TableRow key={course.id} data-state={selectedCourses.includes(course.id) ? "selected": undefined}><TableCell><Checkbox id={`course-${course.id}`} checked={selectedCourses.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)}/></TableCell><TableCell className="font-medium">{course.code}</TableCell><TableCell>{course.name}</TableCell><TableCell>{course.lecturerName}</TableCell><TableCell className="text-right font-medium">{course.cost.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                                    </Table>
                                </AccordionContent>
                           </AccordionItem>
                           <AccordionItem value="other">
                               <AccordionTrigger className="font-bold text-lg">Other Available Courses</AccordionTrigger>
                               <AccordionContent>
                                     <Table>
                                        <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Course Code</TableHead><TableHead>Course Name</TableHead><TableHead>Lecturer</TableHead><TableHead className="text-right">Cost (ZMW)</TableHead></TableRow></TableHeader>
                                        <TableBody>{otherCourses.map((course) => (<TableRow key={course.id} data-state={selectedCourses.includes(course.id) ? "selected": undefined}><TableCell><Checkbox id={`course-${course.id}`} checked={selectedCourses.includes(course.id)} onCheckedChange={() => handleSelectCourse(course.id)}/></TableCell><TableCell className="font-medium">{course.code}</TableCell><TableCell>{course.name}</TableCell><TableCell>{course.lecturerName}</TableCell><TableCell className="text-right font-medium">{course.cost.toFixed(2)}</TableCell></TableRow>))}</TableBody>
                                    </Table>
                               </AccordionContent>
                           </AccordionItem>
                        </Accordion>
                        {semesterOptionalFees.length > 0 && (<div className="pt-4"><h3 className="font-bold text-lg mb-2">Optional Fees</h3><div className="space-y-2 rounded-md border p-4">{semesterOptionalFees.map(fee => (<div key={fee.id} className="flex items-center justify-between"><div className="flex items-center gap-2"><Checkbox id={`fee-${fee.id}`} checked={selectedFees.includes(fee.id)} onCheckedChange={() => handleSelectFee(fee.id)}/><Label htmlFor={`fee-${fee.id}`}>{fee.name}</Label></div><span className="font-medium">ZMW {fee.amount.toFixed(2)}</span></div>))}</div></div>)}
                        </>
                    ) : ( <div className="text-center py-10 text-muted-foreground"><p>Please select a programme to view courses.</p></div> )}
                </CardContent>
                <CardFooter className="flex flex-col items-end gap-4 border-t pt-6">
                    <div className="w-full space-y-4">
                         <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="payment-plan">Payment Plan</Label><Select onValueChange={setSelectedPaymentPlanId} value={selectedPaymentPlanId} disabled={semesterPaymentPlans.length === 0}><SelectTrigger id="payment-plan"><SelectValue placeholder="Select a payment plan" /></SelectTrigger><SelectContent>{semesterPaymentPlans.map(plan => (<SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>))}</SelectContent></Select>{semesterPaymentPlans.length === 0 && !loading && (<p className="text-xs text-destructive">No valid payment plans for this semester. Deadlines may be missing.</p>)}</div><div className="flex items-end pb-1"><div className="flex items-center gap-2"><Checkbox id="scholarship" checked={applyScholarship} onCheckedChange={(checked) => setApplyScholarship(checked as boolean)} /><Label htmlFor="scholarship">Apply for Scholarship (100% tuition waiver)</Label></div></div></div>
                        <Separator />
                        <div className="space-y-1 text-right text-sm w-full"><div className="flex justify-between"><span>Tuition Cost:</span> <span>ZMW {tuitionCost.toFixed(2)}</span></div>{semesterMandatoryFees.map(fee => (<div key={fee.id} className="flex justify-between"><span>Mandatory Fee: {fee.name}</span> <span>ZMW {fee.amount.toFixed(2)}</span></div>))}<div className="flex justify-between"><span>Optional Fees:</span> <span>ZMW {feesCost.toFixed(2)}</span></div>{isLateRegistration && <div className="flex justify-between text-destructive"><span>Late Registration Fee:</span> <span>ZMW {lateFeeAmount.toFixed(2)}</span></div>}<Separator className="my-1"/><div className="flex justify-between font-bold"><span>Total Invoice Value:</span> <span>ZMW {totalCost.toFixed(2)}</span></div>{applyScholarship && <div className="flex justify-between font-bold text-blue-600"><span>Scholarship Applied:</span> <span>- ZMW {tuitionCost.toFixed(2)}</span></div>}</div>
                        <Alert variant={applyScholarship ? 'default' : 'destructive'} className={applyScholarship ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}><DollarSign className={applyScholarship ? 'text-blue-700' : ''} /><AlertTitle className={applyScholarship ? 'text-blue-900' : ''}>Amount Due for First Installment</AlertTitle><AlertDescription className={applyScholarship ? 'text-blue-700' : ''}>Your initial amount payable is ZMW {payableAmount.toFixed(2)}.{applyScholarship && " Your scholarship application will be reviewed. If not approved, the standard tuition amount will become due."}</AlertDescription></Alert>
                    </div>
                    <Button onClick={handleRegister} disabled={submitting || loading || selectedCourses.length === 0} size="lg" className="mt-4">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? 'Submitting...' : 'Submit for Approval'}</Button>
                </CardFooter>
                </>
                )}
            </Card>
        </div>
    );
}
