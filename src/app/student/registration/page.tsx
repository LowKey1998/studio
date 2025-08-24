
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, AlertCircle, CheckCircle, Info, HandCoins, GraduationCap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, set, push, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

type UserData = {
    id: string;
    name: string;
    intakeId: string;
    programmeId: string;
    exemptedCourses?: Record<string, boolean>;
};

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
    cost: number;
};

type Semester = {
    id: string;
    name: string;
    paymentPlanIds: Record<string, boolean>;
    mandatoryFees: Record<string, {name: string, amount: number}>;
    optionalFees: Record<string, {name: string, amount: number}>;
};

type PaymentPlan = {
    id: string;
    name: string;
};

type Scholarship = {
    id: string;
    name: string;
    percentage: number;
};

type CoursePath = {
    semesters: Record<string, { courses: string[] }>;
};

export default function StudentRegistrationPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    const [openSemesters, setOpenSemesters] = React.useState<Semester[]>([]);
    const [availableCourses, setAvailableCourses] = React.useState<Course[]>([]);
    const [paymentPlans, setPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [scholarships, setScholarships] = React.useState<Scholarship[]>([]);
    const [alreadyRegisteredSemesters, setAlreadyRegisteredSemesters] = React.useState<string[]>([]);

    // Form state
    const [selectedSemesterId, setSelectedSemesterId] = React.useState('');
    const [selectedCourseIds, setSelectedCourseIds] = React.useState<string[]>([]);
    const [selectedOptionalFees, setSelectedOptionalFees] = React.useState<Record<string, boolean>>({});
    const [selectedPaymentPlan, setSelectedPaymentPlan] = React.useState('');
    const [applyScholarship, setApplyScholarship] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, snapshot => setUserData(snapshot.val()));

                const regRef = ref(db, `registrations/${user.uid}`);
                onValue(regRef, snapshot => {
                    if(snapshot.exists()) setAlreadyRegisteredSemesters(Object.keys(snapshot.val()));
                });
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!userData) return;
        setLoading(true);
        
        const fetchData = async () => {
            try {
                const [semestersSnap, coursePathsSnap, coursesSnap, paymentPlansSnap, scholarshipsSnap] = await Promise.all([
                    get(ref(db, 'semesters')),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings/paymentPlans')),
                    get(ref(db, 'scholarships'))
                ]);

                if (semestersSnap.exists()) {
                    setOpenSemesters(Object.entries(semestersSnap.val())
                        .filter(([id, sem]: [string, any]) => sem.status === 'Open')
                        .map(([id, sem]: [string, any]) => ({ id, ...sem }))
                        .sort((a,b) => b.name.localeCompare(a.name)));
                }

                if (coursePathsSnap.exists() && coursesSnap.exists()) {
                    const allPaths: CoursePath[] = Object.values(coursePathsSnap.val());
                    const userPath = allPaths.find(p => p.intakeId === userData.intakeId && p.programmeId === userData.programmeId);

                    if (userPath) {
                        const allCourseData = coursesSnap.val();
                        const semesterCourses = Object.values(userPath.semesters).flatMap(s => s.courses);
                        setAvailableCourses(semesterCourses.map(id => ({ id, ...allCourseData[id] })).filter(Boolean));
                    }
                }
                
                if (paymentPlansSnap.exists()) {
                    setPaymentPlans(Object.entries(paymentPlansSnap.val()).filter(([,p]: [string, any]) => !p.archived).map(([id, p]: [string, any]) => ({ id, ...p })));
                }

                if (scholarshipsSnap.exists()) {
                     setScholarships(Object.values(scholarshipsSnap.val() as Record<string, any>).filter((s: any) => s.semesterIds?.[selectedSemesterId]));
                }
            } catch (error) {
                console.error("Error fetching registration data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userData, selectedSemesterId]);

    const selectedSemester = React.useMemo(() => openSemesters.find(s => s.id === selectedSemesterId), [openSemesters, selectedSemesterId]);

    const coursesForSemester = React.useMemo(() => {
        const semesterYear = selectedSemester?.name.match(/Year (\d+)/)?.[1];
        if (!semesterYear) return [];
        return availableCourses.filter(c => c.year === Number(semesterYear));
    }, [selectedSemester, availableCourses]);
    
    const handleCourseSelection = (courseId: string) => {
        setSelectedCourseIds(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };

    const handleFeeSelection = (feeId: string) => {
        setSelectedOptionalFees(prev => ({...prev, [feeId]: !prev[feeId]}));
    }
    
    const handleSubmit = async () => {
        if (!currentUser || !userData || !selectedSemester || !selectedPaymentPlan || selectedCourseIds.length === 0) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
        try {
            const registrationRef = ref(db, `registrations/${currentUser.uid}/${selectedSemester.id}`);
            const invoiceRef = push(ref(db, `invoices/${currentUser.uid}`));
            
            const totalTuition = selectedCourseIds.reduce((sum, id) => sum + (coursesForSemester.find(c=>c.id===id)?.cost || 0), 0);
            const totalMandatoryFees = selectedSemester.mandatoryFees ? Object.values(selectedSemester.mandatoryFees).reduce((sum, fee) => sum + fee.amount, 0) : 0;
            const finalOptionalFees = selectedSemester.optionalFees ? Object.entries(selectedSemester.optionalFees).filter(([id]) => selectedOptionalFees[id]).map(([,fee])=>fee.amount).reduce((sum,amt) => sum+amt, 0) : 0;

            await set(registrationRef, {
                status: 'Pending Approval',
                courses: selectedCourseIds,
                optionalFees: Object.keys(selectedOptionalFees).filter(key => selectedOptionalFees[key]),
                paymentPlan: selectedPaymentPlan,
                programmeId: userData.programmeId,
                applyScholarship,
                invoiceId: invoiceRef.key,
                registrationDate: new Date().toISOString()
            });

            await set(invoiceRef, {
                invoiceId: invoiceRef.key,
                dateCreated: new Date().toISOString(),
                semester: selectedSemester.name,
                semesterId: selectedSemester.id,
                totalTuition,
                totalMandatoryFees,
                totalOptionalFees: finalOptionalFees,
                courses: selectedCourseIds,
                optionalFees: Object.keys(selectedOptionalFees).filter(key => selectedOptionalFees[key]),
                paymentPlan: selectedPaymentPlan,
                applyScholarship,
            });

            const registrarIds = await get(ref(db, 'users')).then(snap => {
                 if(!snap.exists()) return [];
                 return Object.keys(snap.val()).filter(uid => snap.val()[uid].subRoles?.includes('Registrar'));
            });

            const notificationPromises = registrarIds.map(id => createNotification(id, `${userData.name} has submitted a new course registration.`, '/admin/approve-registrations'));
            await Promise.all(notificationPromises);

            toast({ title: 'Registration Submitted!', description: 'Your course selection is pending approval.' });
            setSelectedSemesterId('');
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setSaving(false);
        }
    }


    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Course Registration</CardTitle>
                    <CardDescription>Select a semester to register for your courses.</CardDescription>
                </CardHeader>
                <CardContent>
                    {openSemesters.filter(s => !alreadyRegisteredSemesters.includes(s.id)).length > 0 ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="semester-select">Select Semester</Label>
                                <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                                    <SelectTrigger id="semester-select"><SelectValue placeholder="Select an open semester..."/></SelectTrigger>
                                    <SelectContent>
                                        {openSemesters.filter(s => !alreadyRegisteredSemesters.includes(s.id)).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Open Registrations</AlertTitle>
                            <AlertDescription>
                                There are no semesters currently open for registration, or you have already registered. Please check back later.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {selectedSemester && (
            <Card>
                <CardHeader>
                    <CardTitle>Register for {selectedSemester.name}</CardTitle>
                    <CardDescription>Select the courses you wish to take this semester.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <Accordion type="multiple" defaultValue={['courses']} className="w-full">
                        <AccordionItem value="courses">
                            <AccordionTrigger className="text-lg font-semibold">Courses</AccordionTrigger>
                            <AccordionContent>
                                {coursesForSemester.map(course => (
                                    <div key={course.id} className="flex items-center space-x-2 py-2 border-b">
                                        <Checkbox id={course.id} onCheckedChange={() => handleCourseSelection(course.id)} />
                                        <Label htmlFor={course.id} className="flex-1 cursor-pointer">{course.name} ({course.code})</Label>
                                        <span className="text-sm font-mono">ZMW {course.cost.toFixed(2)}</span>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="fees">
                            <AccordionTrigger className="text-lg font-semibold">Other Fees</AccordionTrigger>
                            <AccordionContent>
                                <p className="font-semibold text-sm mb-2">Mandatory Fees:</p>
                                <ul className="list-disc pl-5 mb-4 text-sm">
                                    {selectedSemester.mandatoryFees ? Object.values(selectedSemester.mandatoryFees).map((fee,i) => <li key={i}>{fee.name} - ZMW {fee.amount.toFixed(2)}</li>) : <li>None</li>}
                                </ul>
                                 <p className="font-semibold text-sm mb-2">Optional Fees:</p>
                                  {selectedSemester.optionalFees ? Object.entries(selectedSemester.optionalFees).map(([id, fee]) => (
                                    <div key={id} className="flex items-center space-x-2 py-2 border-b">
                                        <Checkbox id={id} onCheckedChange={() => handleFeeSelection(id)} />
                                        <Label htmlFor={id} className="flex-1 cursor-pointer">{fee.name}</Label>
                                        <span className="text-sm font-mono">ZMW {fee.amount.toFixed(2)}</span>
                                    </div>
                                  )) : <p className="text-sm text-muted-foreground">None</p>}
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="payment">
                             <AccordionTrigger className="text-lg font-semibold">Payment Options</AccordionTrigger>
                             <AccordionContent className="space-y-4">
                                <div><Label>Payment Plan</Label><Select onValueChange={setSelectedPaymentPlan} value={selectedPaymentPlan}><SelectTrigger><SelectValue placeholder="Select a plan..."/></SelectTrigger><SelectContent>
                                    {(paymentPlans || []).filter(p => selectedSemester.paymentPlanIds?.[p.id]).map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                                </SelectContent></Select></div>
                                {scholarships.length > 0 && <div className="flex items-center space-x-2 pt-2"><Checkbox id="scholarship" onCheckedChange={(c) => setApplyScholarship(!!c)}/><Label htmlFor="scholarship">Apply for available scholarship (<span className="font-bold">{scholarships[0].name} - {scholarships[0].percentage}%</span>)</Label></div>}
                             </AccordionContent>
                        </AccordionItem>
                     </Accordion>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                        Submit Registration
                    </Button>
                </CardFooter>
            </Card>
            )}

        </div>
    );
}
