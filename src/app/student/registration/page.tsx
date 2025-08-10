
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
import { Loader2, Trash2, Clock, DollarSign, GraduationCap, MinusCircle, PlusCircle, ShieldAlert, GripVertical, HelpCircle, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, child, push, remove, onValue, query, equalTo, orderByChild } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';


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
    year: number;
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
    coursePriority: string[]; // New field
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
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<number, { courses: string[] }> };

type RegistrationPolicy = {
    lateRegistrationFee: number;
}

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
}

function SortableCourseItem({ course }: { course: Course }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: course.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <TableRow ref={setNodeRef} style={style} {...attributes} >
            <TableCell className="w-8 p-2"><Button variant="ghost" {...listeners} className="cursor-grab"><GripVertical className="h-5 w-5"/></Button></TableCell>
            <TableCell className="font-medium">{course.code}</TableCell>
            <TableCell>{course.name}</TableCell>
            <TableCell className="text-right font-medium">{course.cost.toFixed(2)}</TableCell>
        </TableRow>
    );
}

export default function RegistrationPage() {
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [semesterOptionalFees, setSemesterOptionalFees] = React.useState<Fee[]>([]);
    const [semesterMandatoryFees, setSemesterMandatoryFees] = React.useState<Fee[]>([]);
    
    const [availableCourses, setAvailableCourses] = React.useState<Course[]>([]);
    
    const [selectedCourses, setSelectedCourses] = React.useState<Course[]>([]);
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

    const [existingRegistration, setExistingRegistration] = React.useState<Registration | null>(null);
    const [registeredCourses, setRegisteredCourses] = React.useState<Course[]>([]);
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
        const coursePathsRef = ref(db, 'coursePaths');

        const unsubPaymentPlans = onValue(paymentPlansRef, (snapshot) => {
            if (snapshot.exists()) setAllPaymentPlans(Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })));
            else setAllPaymentPlans([]);
        });
        const unsubRegPolicy = onValue(regPolicyRef, (snapshot) => {
            if(snapshot.exists()) setRegistrationPolicy(snapshot.val());
        });
        const unsubCourses = onValue(coursesRef, (snapshot) => {
             if(snapshot.exists()) {
                const coursesData = snapshot.val();
                setAllCourses(Object.keys(coursesData).map(id => ({id, ...coursesData[id]})));
            }
        });
         const unsubCoursePaths = onValue(coursePathsRef, (snapshot) => {
            if (snapshot.exists()) setAllCoursePaths(Object.values(snapshot.val()));
            else setAllCoursePaths([]);
        });
        
        return () => {
            unsubPaymentPlans();
            unsubRegPolicy();
            unsubCourses();
            unsubCoursePaths();
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
            const [regSnap, invoiceSnap] = await Promise.all([
                get(registrationRef),
                get(ref(db, `invoices/${user.uid}`))
            ]);

            const regData = regSnap.exists() ? regSnap.val() : null;
            if (regData) {
                 const courseIds = regData.courses || [];
                 const regCourses = allCourses.filter(c => courseIds.includes(c.id));
                 const invoice = invoiceSnap.exists() ? Object.values(invoiceSnap.val() as any).find((inv: any) => inv.invoiceId === regData.invoiceId) : null;
                 setExistingRegistration({...regData, invoiceDetails: invoice});
                 setRegisteredCourses(regCourses);
            } else { 
                 setExistingRegistration(null);
                 setRegisteredCourses([]);
                 
                 const semesterOfferingsSnap = await get(ref(db, `semesterOfferings/${openSemesters.find(s => s.id === selectedSemesterId)?.name}/courseIds`));
                 const availableCourseIds = semesterOfferingsSnap.exists() ? semesterOfferingsSnap.val() : [];
                 
                 setAvailableCourses(allCourses.filter(c => availableCourseIds.includes(c.id) && c.year === uData.year));
                 setSelectedCourses([]);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Error loading data' });
        } finally {
            setLoading(false);
        }
    }, [selectedSemesterId, openSemesters, toast, allCourses]);


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
             setSemesterMandatoryFees(semester.mandatoryFees ? Object.keys(semester.mandatoryFees).map(id => ({ id, ...semester.mandatoryFees![id] })) : []);

            if (semester.paymentPlanIds && allPaymentPlans.length > 0) {
                const planIds = Object.keys(semester.paymentPlanIds);
                const semesterPlans = allPaymentPlans.filter(p => planIds.includes(p.id) && !p.archived);
                setSemesterPaymentPlans(semesterPlans);
                 if (semesterPlans.length > 0) {
                    setSelectedPaymentPlanId(semesterPlans[0].id);
                }
            } else {
                setSemesterPaymentPlans([]);
            }
        }
    }, [selectedSemesterId, openSemesters, allPaymentPlans]);

    const handleSelectCourse = (courseId: string) => {
        const course = availableCourses.find(c => c.id === courseId);
        if(!course) return;

        setSelectedCourses(prev => {
            if (prev.some(c => c.id === courseId)) {
                return prev.filter(c => c.id !== courseId);
            } else {
                return [...prev, course];
            }
        });
    };
    
    function handleDragEnd(event: DragEndEvent) {
        const {active, over} = event;
        if (active.id !== over?.id) {
          setSelectedCourses((items) => {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over?.id);
            return arrayMove(items, oldIndex, newIndex);
          });
        }
    }


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

            const tuitionCost = selectedCourses.reduce((acc, course) => acc + (course.cost || 0), 0);
            const optionalFeesCost = selectedFees.reduce((acc, feeId) => acc + (semesterOptionalFees.find(f => f.id === feeId)?.amount || 0), 0);
            const mandatoryFeesCost = semesterMandatoryFees.reduce((acc, fee) => acc + fee.amount, 0);

            const selectedPlan = allPaymentPlans.find(p => p.id === selectedPaymentPlanId);
            if (!selectedPlan) { toast({ variant: 'destructive', title: 'Invalid payment plan selected.' }); setSubmitting(false); return; }

            const invoiceRef = push(ref(db, `invoices/${currentUser.uid}`));
            const invoiceId = invoiceRef.key!;
            const coursePriority = selectedCourses.map(c => c.id);

            await set(invoiceRef, {
                invoiceId, courses: selectedCourses.map(c => c.id), optionalFees: selectedFees,
                totalTuition: tuitionCost, totalOptionalFees: optionalFeesCost, totalMandatoryFees: mandatoryFeesCost, lateFee,
                paymentPlan: selectedPlan.name, amountPaid: 0, status: 'pending', dateCreated: new Date().toISOString(),
                semester: selectedSemester.name, semesterId: selectedSemester.id, applyScholarship
            });

            const registrationRef = ref(db, `registrations/${currentUser.uid}/${selectedSemester.id}`);
            await set(registrationRef, {
                courses: selectedCourses.map(c => c.id), coursePriority, optionalFees: selectedFees, invoiceId, paymentPlan: selectedPlan.name, programmeId: userData.programmeId,
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
        if (!currentUser || !selectedSemesterId || !existingRegistration) return;
        if (!window.confirm("Are you sure you want to cancel this registration? All payment records for this semester will also be deleted.")) return;
        setSubmitting(true);
        try {
            await remove(ref(db, `invoices/${currentUser.uid}/${existingRegistration.invoiceId}`));
            await remove(ref(db, `registrations/${currentUser.uid}/${selectedSemesterId}`));
            
            // Optional: remove related transactions if necessary
            // This would require querying transactions by invoiceId, which can be complex.
            // For now, we leave them for auditing purposes.

            toast({ title: "Registration Canceled" });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Cancellation Failed', description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    const selectedSemesterData = openSemesters.find(s => s.id === selectedSemesterId);
    const isLateRegistration = selectedSemesterData?.lateRegistrationActive ?? false;
    const lateFeeAmount = registrationPolicy?.lateRegistrationFee || 0;

    const {tuitionCost, feesCost, totalCost, payableAmount} = React.useMemo(() => {
        const tuition = selectedCourses.reduce((acc, course) => acc + (course.cost || 0), 0);
        const optional = selectedFees.reduce((acc, feeId) => acc + (semesterOptionalFees.find(f => f.id === feeId)?.amount || 0), 0);
        const mandatory = semesterMandatoryFees.reduce((acc, fee) => acc + fee.amount, 0);
        const lateFee = isLateRegistration ? lateFeeAmount : 0;

        const total = tuition + optional + mandatory + lateFee;
        
        const payableBase = applyScholarship ? optional + mandatory + lateFee : total;
        
        const selectedPlan = allPaymentPlans.find(p => p.id === selectedPaymentPlanId);
        const firstInstallmentMultiplier = selectedPlan ? (selectedPlan.installmentPercentages?.[0] || 100) / 100 : 1;
        
        const payable = payableBase * firstInstallmentMultiplier;

        return { tuitionCost: tuition, feesCost: optional + mandatory, totalCost: total, payableAmount: payable };
    }, [selectedCourses, selectedFees, semesterOptionalFees, semesterMandatoryFees, selectedPaymentPlanId, allPaymentPlans, applyScholarship, isLateRegistration, lateFeeAmount]);

    const recommendedCourseIds = React.useMemo(() => {
        if (!userData || !selectedSemesterData) return [];
        const path = allCoursePaths.find(p => p.intakeId === userData.intakeId && p.programmeId === userData.programmeId);
        if(!path || !path.semesters) return [];
        
        // This is a simplification. A real implementation would need to know which semester of study this is (e.g., Year 2, Sem 1)
        // For now, we'll just check against the student's overall year.
        const semesterKeys = Object.keys(path.semesters);
        const relevantSemesterKey = semesterKeys[ (userData.year - 1) * 2 ] || semesterKeys[ (userData.year - 1) * 2 + 1 ];
        if (relevantSemesterKey && path.semesters[Number(relevantSemesterKey)]) {
            return path.semesters[Number(relevantSemesterKey)].courses;
        }
        return [];
    }, [userData, selectedSemesterData, allCoursePaths]);

    if (loading) {
        return (
            <div className="space-y-6">
                <Card><CardHeader><Skeleton className="h-8 w-1/3"/><Skeleton className="h-4 w-1/2 mt-2"/></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Course Registration</CardTitle>
                    <CardDescription>{openSemesters.length > 0 ? "Select a semester, choose your courses, and set their priority." : "Course registration is not currently open."}</CardDescription>
                </CardHeader>
                {openSemesters.length > 0 ? (
                <>
                <CardContent className="space-y-6">
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

                    {existingRegistration ? (
                         <div>
                            <h3 className="font-bold text-lg mb-2">My Current Registration for {existingRegistration.semesterName}</h3>
                             <Card className="bg-muted/50">
                                <CardHeader><CardTitle>Status: {existingRegistration.status}</CardTitle><CardDescription>Your registration is currently being processed. You can view payment details on the Payments page.</CardDescription></CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Course Code</TableHead><TableHead>Course Name</TableHead></TableRow></TableHeader>
                                        <TableBody>{registeredCourses.map(c => (<TableRow key={c.id}><TableCell>{c.code}</TableCell><TableCell>{c.name}</TableCell></TableRow>))}</TableBody>
                                    </Table>
                                </CardContent>
                                <CardFooter className="justify-between">
                                    <Button asChild variant="secondary"><Link href="/student/payments">Go to Payments</Link></Button>
                                    {(existingRegistration.status === 'Pending Approval' || existingRegistration.status === 'Pending Payment') && (
                                        <Button variant="destructive" onClick={handleCancelRegistration} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}Cancel Registration</Button>
                                    )}
                                </CardFooter>
                            </Card>
                        </div>
                    ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Available Courses */}
                        <div>
                            <h3 className="font-bold text-lg mb-2">Available Courses</h3>
                            <div className="max-h-96 overflow-y-auto border rounded-md p-2">
                                <Table>
                                     <TableHeader><TableRow><TableHead className="w-[50px]"></TableHead><TableHead>Course</TableHead></TableRow></TableHeader>
                                     <TableBody>
                                        {availableCourses.map((course) => (
                                            <TableRow key={course.id}>
                                                <TableCell><Checkbox id={`course-${course.id}`} checked={selectedCourses.some(c => c.id === course.id)} onCheckedChange={() => handleSelectCourse(course.id)}/></TableCell>
                                                <TableCell>
                                                    <Label htmlFor={`course-${course.id}`}>{course.name} ({course.code})</Label>
                                                    {recommendedCourseIds.includes(course.id) && <Badge variant="secondary" className="ml-2">Recommended</Badge>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                     </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Selected Courses with Priority */}
                        <div>
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">My Selected Courses (Prioritized) 
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5"><HelpCircle className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Drag and drop courses to set their unlock priority.<br/> Courses at the top will be unlocked first as you pay.</p></TooltipContent></Tooltip></TooltipProvider>
                            </h3>
                            <div className="max-h-96 overflow-y-auto border rounded-md p-2">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <Table>
                                         <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                                        <SortableContext items={selectedCourses} strategy={verticalListSortingStrategy}>
                                            <TableBody>
                                                {selectedCourses.map((course) => <SortableCourseItem key={course.id} course={course} />)}
                                            </TableBody>
                                        </SortableContext>
                                    </Table>
                                </DndContext>
                                {selectedCourses.length === 0 && <p className="text-center text-sm text-muted-foreground p-4">Select courses from the left to add them here.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Fees Section */}
                     {semesterOptionalFees.length > 0 && (<div className="pt-4"><h3 className="font-bold text-lg mb-2">Optional Fees</h3><div className="space-y-2 rounded-md border p-4">{semesterOptionalFees.map(fee => (<div key={fee.id} className="flex items-center justify-between"><div className="flex items-center gap-2"><Checkbox id={`fee-${fee.id}`} checked={selectedFees.includes(fee.id)} onCheckedChange={() => handleSelectFee(fee.id)}/><Label htmlFor={`fee-${fee.id}`}>{fee.name}</Label></div><span className="font-medium">ZMW {fee.amount.toFixed(2)}</span></div>))}</div></div>)}
                    </>
                    )}
                </CardContent>
                
                { !existingRegistration && (
                <CardFooter className="flex flex-col items-end gap-4 border-t pt-6">
                    <div className="w-full space-y-4">
                         <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="payment-plan">Payment Plan</Label><Select onValueChange={setSelectedPaymentPlanId} value={selectedPaymentPlanId} disabled={semesterPaymentPlans.length === 0}><SelectTrigger id="payment-plan"><SelectValue placeholder="Select a payment plan" /></SelectTrigger><SelectContent>{semesterPaymentPlans.map(plan => (<SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>))}</SelectContent></Select>{semesterPaymentPlans.length === 0 && !loading && (<p className="text-xs text-destructive">No valid payment plans for this semester. Deadlines may be missing.</p>)}</div><div className="flex items-end pb-1"><div className="flex items-center gap-2"><Checkbox id="scholarship" checked={applyScholarship} onCheckedChange={(checked) => setApplyScholarship(checked as boolean)} /><Label htmlFor="scholarship">Apply for Scholarship (100% tuition waiver)</Label></div></div></div>
                        <Separator />
                        <div className="space-y-1 text-right text-sm w-full">
                            <div className="flex justify-between">
                                <span>Tuition Cost:</span>
                                <span>ZMW {tuitionCost.toFixed(2)}</span>
                            </div>
                            {Object.values(semesterMandatoryFees).map(fee => (
                                <div key={fee.id} className="flex justify-between">
                                    <span>Mandatory Fee: {fee.name}</span>
                                    <span>ZMW {fee.amount.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between">
                                <span>Optional Fees:</span>
                                <span>ZMW {selectedFees.reduce((acc, feeId) => acc + (semesterOptionalFees.find(f => f.id === feeId)?.amount || 0), 0).toFixed(2)}</span>
                            </div>
                            {isLateRegistration && 
                                <div className="flex justify-between text-destructive">
                                    <span>Late Registration Fee:</span> 
                                    <span>ZMW {lateFeeAmount.toFixed(2)}</span>
                                </div>
                            }
                            <Separator className="my-1"/>
                            <div className="flex justify-between font-bold">
                                <span>Total Invoice Value:</span>
                                <span>ZMW {totalCost.toFixed(2)}</span>
                            </div>
                            {applyScholarship && 
                                <div className="flex justify-between font-bold text-blue-600">
                                    <span>Scholarship Applied:</span>
                                    <span>- ZMW {tuitionCost.toFixed(2)}</span>
                                </div>
                            }
                        </div>
                        <Alert variant={applyScholarship ? 'default' : 'destructive'} className={applyScholarship ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}>
                            <DollarSign className={applyScholarship ? 'text-blue-700' : ''} />
                            <AlertTitle className={applyScholarship ? 'text-blue-900' : ''}>Amount Due for First Installment</AlertTitle>
                            <AlertDescription className={applyScholarship ? 'text-blue-700' : ''}>
                                Your initial amount payable is ZMW {payableAmount.toFixed(2)}.
                                {applyScholarship && " Your scholarship application will be reviewed. If not approved, the standard tuition amount will become due."}
                            </AlertDescription>
                        </Alert>
                    </div>
                    <Button onClick={handleRegister} disabled={submitting || loading || selectedCourses.length === 0} size="lg" className="mt-4">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? 'Submitting...' : 'Submit for Approval'}</Button>
                </CardFooter>
                )}
                </>
                ) : (
                <CardContent><div className="text-center py-12"><Clock className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">Registration Closed</h3><p className="mt-2 text-sm text-muted-foreground">There are no semesters currently open for registration.</p></div></CardContent>
                )}
            </Card>
        </div>
    );
}
