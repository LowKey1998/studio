
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, AlertCircle, CheckCircle, Info, HandCoins, GraduationCap, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, set, push, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
    lateRegistrationActive?: boolean;
};

type PaymentPlan = {
    id: string;
    name: string;
};

type Scholarship = {
    id: string;
    name: string;
    percentage: number;
    semesterIds?: Record<string, boolean>;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};

type SemesterOffering = Record<string, Record<string, { active: boolean; showReason: boolean; }>>; // pathId -> semesterNumber -> {active, showReason}


export default function StudentRegistrationPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);
    
    const [availableCourses, setAvailableCourses] = React.useState<Course[]>([]);
    const [paymentPlans, setPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [scholarships, setScholarships] = React.useState<Scholarship[]>([]);
    const [alreadyRegisteredSemesters, setAlreadyRegisteredSemesters] = React.useState<string[]>([]);
    const [userPath, setUserPath] = React.useState<CoursePath | null>(null);
    const [allOfferings, setAllOfferings] = React.useState<SemesterOffering>({});
    const [allSemesters, setAllSemesters] = React.useState<Record<string, Semester>>({});


    // Form state
    const [selectedYear, setSelectedYear] = React.useState<number | null>(null);
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
                const [semestersSnap, coursePathsSnap, coursesSnap, paymentPlansSnap, scholarshipsSnap, semesterOfferingsSnap] = await Promise.all([
                    get(ref(db, 'semesters')),
                    get(ref(db, 'coursePaths')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings/paymentPlans')),
                    get(ref(db, 'scholarships')),
                    get(ref(db, 'semesterOfferings'))
                ]);

                const userCoursePath = coursePathsSnap.exists() ? Object.values(coursePathsSnap.val() as Record<string, CoursePath>).find(p => p.intakeId === userData.intakeId && p.programmeId === userData.programmeId) : null;
                setUserPath(userCoursePath || null);
                setAllSemesters(semestersSnap.exists() ? semestersSnap.val() : {});
                setAllOfferings(semesterOfferingsSnap.exists() ? semesterOfferingsSnap.val() : {});
                if (coursesSnap.exists()) setAvailableCourses(Object.values(coursesSnap.val()));
                if (paymentPlansSnap.exists()) setPaymentPlans(Object.entries(paymentPlansSnap.val()).filter(([,p]: [string, any]) => !p.archived).map(([id, p]: [string, any]) => ({ id, ...p })));
                if (scholarshipsSnap.exists()) setScholarships(Object.values(scholarshipsSnap.val() as Record<string, any>));

            } catch (error) {
                console.error("Error fetching registration data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userData, alreadyRegisteredSemesters]);

    const activeSemesterForYear = React.useMemo(() => {
        if (!selectedYear || !userPath || !userData) return null;

        const pathOfferings = userPath ? allOfferings[userPath.id] : null;
        if(!pathOfferings) return null;
        
        const semesterNumberForYear = Object.keys(userPath.semesters).find(semNum => {
            const yearOfPath = Math.floor((Number(semNum) - 1) / 2) + 1;
            const semesterInYear = ((Number(semNum) - 1) % 2) + 1;
            const semesterNameGuess = `${userData.intakeId} Year ${yearOfPath} Semester ${semesterInYear}`;
            const targetSemester = Object.values(allSemesters).find(s => s.name === semesterNameGuess);

            return yearOfPath === selectedYear && targetSemester && pathOfferings[semNum]?.active && !alreadyRegisteredSemesters.includes(targetSemester.id);
        });
        
        if(!semesterNumberForYear) return null;

        const semesterNameGuess = `${userData.intakeId} Year ${selectedYear} Semester ${((Number(semesterNumberForYear) - 1) % 2) + 1}`;
        return Object.values(allSemesters).find(s => s.name === semesterNameGuess) || null;

    }, [selectedYear, userPath, userData, allOfferings, allSemesters, alreadyRegisteredSemesters]);

    const coursesForSemester = React.useMemo(() => {
        if (!activeSemesterForYear || !userPath || !userData) return [];

        const pathSemesterKey = Object.keys(userPath.semesters).find(semNum => {
            const yearOfPath = Math.floor((Number(semNum) - 1) / 2) + 1;
            return yearOfPath === selectedYear;
        });

        if(!pathSemesterKey) return [];
        
        const courseIds = userPath.semesters[pathSemesterKey]?.courses || [];
        return availableCourses.filter(c => courseIds.includes(c.id));
    }, [activeSemesterForYear, availableCourses, userPath, userData, selectedYear]);

    React.useEffect(() => {
        setSelectedCourseIds(coursesForSemester.map(c => c.id).filter(id => !userData?.exemptedCourses?.[id]));
    }, [coursesForSemester, userData]);

    const handleCourseSelection = (courseId: string) => {
        setSelectedCourseIds(prev => prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]);
    };
    
    const handleSubmit = async () => {
        if (!currentUser || !userData || !activeSemesterForYear || !selectedPaymentPlan || selectedCourseIds.length === 0) {
            toast({ variant: 'destructive', title: 'Missing required fields' });
            return;
        }
        setSaving(true);
       
        try {
            const registrationRef = ref(db, `registrations/${currentUser.uid}/${activeSemesterForYear.id}`);
            const invoiceRef = push(ref(db, `invoices/${currentUser.uid}`));
            
            const totalTuition = selectedCourseIds.reduce((sum, id) => sum + (coursesForSemester.find(c=>c.id===id)?.cost || 0), 0);
            const totalMandatoryFees = activeSemesterForYear.mandatoryFees ? Object.values(activeSemesterForYear.mandatoryFees).reduce((sum, fee) => sum + fee.amount, 0) : 0;
            const finalOptionalFees = activeSemesterForYear.optionalFees ? Object.entries(activeSemesterForYear.optionalFees).filter(([id]) => selectedOptionalFees[id]).map(([,fee])=>fee.amount).reduce((sum,amt) => sum+amt, 0) : 0;

            await set(registrationRef, {
                status: 'Pending Approval',
                courses: selectedCourseIds,
                coursePriority: coursesForSemester.map(c => c.id), // Store course order
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
                semester: activeSemesterForYear.name,
                semesterId: activeSemesterForYear.id,
                totalTuition,
                totalMandatoryFees,
                totalOptionalFees: finalOptionalFees,
                courses: selectedCourseIds,
                optionalFees: Object.keys(selectedOptionalFees).filter(key => selectedOptionalFees[key]),
                paymentPlan: selectedPaymentPlan,
                applyScholarship,
            });

            const registrarIds = await getRegistrarIds();
            const notificationPromises = registrarIds.map(id => createNotification(id, `${userData.name} has submitted a new course registration.`, '/admin/approve-registrations'));
            await Promise.all(notificationPromises);

            toast({ title: 'Registration Submitted!', description: 'Your course selection is pending approval.' });
            setSelectedYear(null);
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
                    <CardDescription>Select a year of study to see available semesters and register for your courses.</CardDescription>
                </CardHeader>
                <CardContent>
                    {userPath ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="year-select">Select Year of Study</Label>
                                <Select value={selectedYear?.toString() || ''} onValueChange={(v) => setSelectedYear(v ? Number(v) : null)}>
                                    <SelectTrigger id="year-select"><SelectValue placeholder="Select your current year..."/></SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(userPath.semesters).map(num => Math.floor((Number(num) - 1) / 2) + 1).filter((v,i,a) => a.indexOf(v)===i).map(yearNum => <SelectItem key={yearNum} value={String(yearNum)}>Year {yearNum}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Course Path</AlertTitle>
                            <AlertDescription>
                                A course path has not been defined for your intake and programme. Please contact administration.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {activeSemesterForYear && (
            <Card>
                <CardHeader>
                    <CardTitle>Register for {activeSemesterForYear.name}</CardTitle>
                    <CardDescription>Select the courses you wish to take this semester.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <Accordion type="multiple" defaultValue={['courses']} className="w-full">
                        <AccordionItem value="courses">
                            <AccordionTrigger className="text-lg font-semibold">Courses</AccordionTrigger>
                            <AccordionContent>
                                {coursesForSemester.map(course => (
                                    <div key={course.id} className="flex items-center space-x-2 py-2 border-b">
                                        <Checkbox id={course.id} checked={selectedCourseIds.includes(course.id)} onCheckedChange={() => handleCourseSelection(course.id)} disabled={userData?.exemptedCourses?.[course.id]} />
                                        <Label htmlFor={course.id} className="flex-1 cursor-pointer">{course.name} ({course.code})</Label>
                                        <span className="text-sm font-mono">ZMW {course.cost.toFixed(2)}</span>
                                    </div>
                                ))}
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
