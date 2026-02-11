'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Loader2, Search, Pencil, Save, X, KeyRound, Mail, Send } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, push, query, orderByChild, equalTo, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { updateUserAccount } from '@/ai/flows/update-user-account';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';


type User = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    subRoles?: string[];
    programmeId?: string;
    programmeName?: string;
    year?: number;
    semesterId?: string;
    exemptedCourses?: Record<string, boolean>;
    status?: 'active' | 'disabled';
    intakeId?: string;
    dob?: string;
    gender?: string;
    nationalId?: string;
    passport?: string;
    address?: string;
    guardian?: { name: string; contact: string; email?: string; relationship?: string; };
    emergencyContact?: { name: string; relationship: string; contact: string; };
    educationBackground?: { school: string; qualifications: string; };
    medicalHistory?: string;
    baseSalary?: number;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type Semester = {
    id: string;
    name: string;
    intakeId: string;
    year: number;
    semesterInYear: number;
};

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
}

type Intake = {
    id: string;
    name: string;
}

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>;
};


export default function AddStudentPage() {
    const role = 'Student'; 
    
    // Form State
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [programme, setProgramme] = React.useState('');
    const [isTransfer, setIsTransfer] = React.useState(false);
    const [exemptedCourses, setExemptedCourses] = React.useState<Record<string, boolean>>({});
    const [manualId, setManualId] = React.useState('');
    const [isManualId, setIsManualId] = React.useState(false);
    
    const [dob, setDob] = React.useState('');
    const [gender, setGender] = React.useState('');
    const [nationalId, setNationalId] = React.useState('');
    const [passport, setPassport] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [guardianName, setGuardianName] = React.useState('');
    const [guardianContact, setGuardianContact] = React.useState('');
    const [guardianEmail, setGuardianEmail] = React.useState('');
    const [guardianRelationship, setGuardianRelationship] = React.useState('');
    const [emergencyName, setEmergencyName] = React.useState('');
    const [emergencyRelationship, setEmergencyRelationship] = React.useState('');
    const [emergencyContact, setEmergencyContact] = React.useState('');
    const [previousSchool, setPreviousSchool] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');
    const [medicalHistory, setMedicalHistory] = React.useState('');
    
    // Cascading Dropdown State
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState<number | ''>('');
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [availableYears, setAvailableYears] = React.useState<number[]>([]);
    const [availableSemesters, setAvailableSemesters] = React.useState<Semester[]>([]);

    const [editingUid, setEditingUid] = React.useState<string | null>(null);
    
    // Data for dialogs
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
    
    // Student list state
    const [students, setStudents] = React.useState<User[]>([]);
    const [listSearchTerm, setListSearchTerm] = React.useState('');
    
    // Credentials Preview State
    const [isCredentialsOpen, setIsCredentialsOpen] = React.useState(false);
    const [selectedStudentForCreds, setSelectedStudentForCreds] = React.useState<User | null>(null);
    const [credSubject, setCredSubject] = React.useState('Your Portal Login Details');
    const [credBody, setCredBody] = React.useState('');

    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchInitialData = React.useCallback(async () => {
        setTableLoading(true);
        try {
            const [programmesSnap, coursesSnap, intakesSnap, settingsSnap, semestersSnap, coursePathsSnap, usersSnap] = await Promise.all([
                get(ref(db, 'programmes')),
                get(ref(db, 'courses')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/idPrefixes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'users')),
            ]);

            const programmesData = programmesSnap.exists() ? programmesSnap.val() : {};
            if (programmesSnap.exists()) setAllProgrammes(Object.keys(programmesData).map(id => ({ id, ...programmesData[id] }))); else setAllProgrammes([]);
            if (coursesSnap.exists()) setAllCourses(Object.keys(coursesSnap.val()).map(id => ({ id, ...coursesSnap.val()[id] }))); else setAllCourses([]);
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] }))); else setAllIntakes([]);
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val()); else setIdSettings({ student: 'STU', staff: 'STF', admin: 'ADM' });
            if (semestersSnap.exists()) setAllSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] }))); else setAllSemesters([]);
            if (coursePathsSnap.exists()) {
                const pathsData = coursePathsSnap.val();
                setAllCoursePaths(Object.keys(pathsData).map(id => ({ id, ...pathsData[id] })));
            } else {
                setAllCoursePaths([]);
            }
            if (usersSnap.exists()) {
                const usersData = usersSnap.val();
                const studentList: User[] = [];
                 for (const uid in usersData) {
                    if (usersData[uid].role === 'Student') {
                        studentList.push({
                            uid,
                            ...usersData[uid],
                            programmeName: programmesData[usersData[uid].programmeId]?.name || 'N/A'
                        });
                    }
                }
                setStudents(studentList.sort((a,b) => b.id.localeCompare(a.id, undefined, { numeric: true })));
            } else {
                setStudents([]);
            }

        } catch (error) {
            console.error("Error fetching data:", error);
             toast({ variant: 'destructive', title: 'Failed to fetch data' });
        } finally {
            setTableLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);
    
    // EFFECT TO POPULATE YEARS
    React.useEffect(() => {
        setAvailableYears([]);
        if (!editingUid) setSelectedYear('');
    
        if (!selectedIntake || !programme || allCoursePaths.length === 0 || allSemesters.length === 0) return;
    
        const relevantPath = allCoursePaths.find(p => p.intakeId === selectedIntake && p.programmeId === programme);
        if (!relevantPath || !relevantPath.semesters) return;
    
        const semesterIdsInPath = Object.keys(relevantPath.semesters);
        const years = new Set<number>();
        allSemesters.forEach(sem => {
            if (semesterIdsInPath.includes(sem.id)) {
                years.add(sem.year);
            }
        });
        setAvailableYears(Array.from(years).sort((a, b) => a - b));
    }, [selectedIntake, programme, allCoursePaths, allSemesters, editingUid]);

    // EFFECT TO POPULATE SEMESTERS
    React.useEffect(() => {
        setAvailableSemesters([]);
        if (!editingUid) setSelectedSemester('');
    
        if (!selectedIntake || !selectedYear || !programme || !allCoursePaths.length || !allSemesters.length) return;
    
        const relevantPath = allCoursePaths.find(p => p.intakeId === selectedIntake && p.programmeId === programme);
        if (!relevantPath || !relevantPath.semesters) return;

        const semesterIdsInPath = Object.keys(relevantPath.semesters);
        const semestersForYear = allSemesters.filter(s =>
            s.intakeId === selectedIntake &&
            s.year === selectedYear &&
            semesterIdsInPath.includes(s.id)
        );
        setAvailableSemesters(semestersForYear.sort((a, b) => a.semesterInYear - b.semesterInYear));
    }, [selectedYear, selectedIntake, programme, allCoursePaths, allSemesters, editingUid]);


    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setProgramme(''); setIsTransfer(false); setExemptedCourses({}); setSelectedIntake('');
        setManualId(''); setIsManualId(false);
        setDob(''); setGender(''); setNationalId(''); setPassport(''); setAddress('');
        setGuardianName(''); setGuardianContact(''); setGuardianEmail(''); setGuardianRelationship('');
        setEmergencyName(''); setEmergencyRelationship(''); setEmergencyContact('');
        setPreviousSchool(''); setQualifications(''); setMedicalHistory('');
        setSelectedYear(''); setSelectedSemester('');
        setEditingUid(null);
    };
    
    const handleAction = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name || !email) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        if (!editingUid && !password) { toast({ variant: 'destructive', title: 'Password Required' }); return; }
        if (!programme || !selectedYear || !selectedIntake || !selectedSemester) { toast({ variant: 'destructive', title: 'Missing Student Info' }); return; }
        
        setLoading(true);

        try {
            const isIdTaken = async (id: string) => {
                const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(id));
                const snapshot = await get(userQuery);
                if (!snapshot.exists()) return false;
                if (editingUid) {
                    const foundUid = Object.keys(snapshot.val())[0];
                    return foundUid !== editingUid;
                }
                return true;
            };

            const userDataPayload: any = {
                name, email, phoneNumber, status: 'active',
                programmeId: programme, year: Number(selectedYear), semesterId: selectedSemester, intakeId: selectedIntake,
                dob, gender, nationalId, passport, address, medicalHistory,
                guardian: { name: guardianName, contact: guardianContact, email: guardianEmail, relationship: guardianRelationship },
                emergencyContact: { name: emergencyName, relationship: emergencyRelationship, contact: emergencyContact },
                educationBackground: { school: previousSchool, qualifications: qualifications }
            };
            if(isTransfer && Object.keys(exemptedCourses).length > 0) userDataPayload.exemptedCourses = exemptedCourses;

            if (editingUid) {
                if (isManualId) {
                    const newId = manualId.trim();
                    if (await isIdTaken(newId)) {
                        toast({ variant: 'destructive', title: 'ID already taken by another user' });
                        setLoading(false);
                        return;
                    }
                    userDataPayload.id = newId;
                }

                await updateUserAccount({
                    uid: editingUid,
                    name,
                    email,
                    phoneNumber,
                    dbData: userDataPayload
                });
                toast({ title: 'Student Updated' });
                resetForm();
                fetchInitialData();
            } else {
                const tempAppName = `temp-user-creation-${Date.now()}`;
                const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
                const tempApp = initializeApp(firebaseConfig, tempAppName);
                const tempAuth = getAuth(tempApp);

                let newId = '';
                if (isManualId) {
                    newId = manualId.trim();
                    if (await isIdTaken(newId)) {
                        toast({ variant: 'destructive', title: 'ID already exists' });
                        setLoading(false);
                        await deleteApp(tempApp);
                        return;
                    }
                } else {
                    const counterRef = ref(db, `userCounters/${role}`);
                    let isUniqueIdFound = false;
                    while (!isUniqueIdFound) {
                        await runTransaction(counterRef, (currentCount) => {
                            const count = (currentCount || 0) + 1;
                            const basePrefix = idSettings.student || 'STU';
                            let datePart = '';
                            const now = new Date();
                            if(idSettings.includeYear) datePart += format(now, 'yy');
                            if(idSettings.includeMonth) datePart += format(now, 'MM');
                            newId = `${basePrefix}${datePart}${String(count).padStart(3, '0')}`;
                            return count;
                        });
                        if (!(await isIdTaken(newId))) isUniqueIdFound = true;
                    }
                }

                const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
                const user = userCredential.user;
                userDataPayload.id = newId;
                userDataPayload.role = 'Student';

                await set(ref(db, `users/${user.uid}`), userDataPayload);
                await set(ref(db, `userRoles/${user.uid}`), { role: 'student' });
                
                await sendEmail({
                    to: [email],
                    subject: `Welcome to ${idSettings.name || 'Edutrack360'}!`,
                    body: `<h2>Welcome!</h2><p>Your account is ready.</p><p>You can access the portal using the credentials below.</p><ul><li><strong>Portal Link:</strong> <a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></li><li><strong>User ID:</strong> ${newId}</li><li><strong>Password:</strong> ${password}</li></ul><p><strong>Note:</strong> If you have trouble logging in, please try using <strong>12345678</strong> as your temporary password.</p><p>Best regards,<br/>The Administration</p>`
                });

                toast({ title: 'Student Account Created', description: `User ID: ${newId}` });
                await deleteApp(tempApp);
                resetForm();
                fetchInitialData();
            }
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
        } finally {
            setLoading(false);
        }
    };
    
    const handleEditStudent = (student: User) => {
        setEditingUid(student.uid);
        setName(student.name);
        setEmail(student.email);
        setPhoneNumber(student.phoneNumber || '');
        setProgramme(student.programmeId || '');
        setSelectedIntake(student.intakeId || '');
        setSelectedYear(student.year ? student.year : '');
        setSelectedSemester(student.semesterId || '');
        setDob(student.dob || '');
        setGender(student.gender || '');
        setNationalId(student.nationalId || '');
        setPassport(student.passport || '');
        setAddress(student.address || '');
        setGuardianName(student.guardian?.name || '');
        setGuardianContact(student.guardian?.contact || '');
        setGuardianEmail(student.guardian?.email || '');
        setGuardianRelationship(student.guardian?.relationship || '');
        setEmergencyName(student.emergencyContact?.name || '');
        setEmergencyRelationship(student.emergencyContact?.relationship || '');
        setEmergencyContact(student.emergencyContact?.contact || '');
        setPreviousSchool(student.educationBackground?.school || '');
        setQualifications(student.educationBackground?.qualifications || '');
        setMedicalHistory(student.medicalHistory || '');
        setIsTransfer(!!student.exemptedCourses);
        setExemptedCourses(student.exemptedCourses || {});
        
        // Setup manual ID for editing
        setManualId(student.id);
        setIsManualId(true);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleExemptionChange = (courseId: string) => {
        setExemptedCourses(prev => {
            const newExemptions = { ...prev };
            if (newExemptions[courseId]) delete newExemptions[courseId]; else newExemptions[courseId] = true;
            return newExemptions;
        });
    }

    const coursesForSelectedProgramme = React.useMemo(() => {
        if (!programme) return [];
        const prog = allProgrammes.find(p => p.id === programme);
        if (!prog || !prog.courseIds) return [];
        return allCourses.filter(c => prog.courseIds![c.id]);
    }, [programme, allProgrammes, allCourses]);

    const filteredStudents = React.useMemo(() => {
        return students.filter(student => {
            const lowerCaseSearch = listSearchTerm.toLowerCase();
            return !listSearchTerm ||
                student.name.toLowerCase().includes(lowerCaseSearch) ||
                student.id.toLowerCase().includes(lowerCaseSearch) ||
                student.email.toLowerCase().includes(lowerCaseSearch) ||
                student.programmeName?.toLowerCase().includes(lowerCaseSearch);
        });
    }, [students, listSearchTerm]);

    const openCredentialsPreview = (user: User) => {
        setSelectedStudentForCreds(user);
        setCredSubject('Your Portal Login Details');
        setCredBody(`<h2>Login Details Reminder</h2>
<p>Hello ${user.name},</p>
<p>Here are your login details for the student portal:</p>
<ul>
    <li><strong>Portal Link:</strong> <a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></li>
    <li><strong>User ID:</strong> ${user.id}</li>
</ul>
<p><strong>Note:</strong> If you have trouble logging in with your previous password, please try using <strong>12345678</strong> as your temporary password.</p>
<p>If you have forgotten your password entirely, you can use the "Forgot Password" link on the login page to reset it via email.</p>
<p>Best regards,<br/>The Administration</p>`);
        setIsCredentialsOpen(true);
    };

    const handleSendCredentials = async () => {
        if (!selectedStudentForCreds || !credBody) return;
        setLoading(true);
        try {
            await sendEmail({
                to: [selectedStudentForCreds.email],
                subject: credSubject,
                body: credBody,
            });
            toast({ title: 'Credentials Sent', description: `An email with login details has been sent to ${selectedStudentForCreds.name}.` });
            setIsCredentialsOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send Email', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <Card className="max-w-4xl mx-auto border-primary/20 shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-headline text-2xl">{editingUid ? 'Edit Student Details' : 'Add New Student'}</CardTitle>
                            <CardDescription>{editingUid ? `Updating record for ${name}` : 'Create a new account for a student.'}</CardDescription>
                        </div>
                        {editingUid && <Button variant="ghost" onClick={resetForm}><X className="mr-2 h-4 w-4"/> Cancel Edit</Button>}
                    </div>
                </CardHeader>
                <form id="student-form" onSubmit={handleAction}>
                    <CardContent>
                        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger className="text-lg font-semibold">Basic Information</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4"/> User ID (System ID)</Label>
                                            <div className="flex items-center space-x-2">
                                                <Switch id="manual-id-switch" checked={isManualId} onCheckedChange={setIsManualId} />
                                                <Label htmlFor="manual-id-switch">{isManualId ? 'Manual Edit' : 'Auto-generate'}</Label>
                                            </div>
                                            {isManualId && <Input placeholder="Enter custom User ID" value={manualId} onChange={(e) => setManualId(e.target.value.toUpperCase())} />}
                                            {!isManualId && <div className="text-xs text-muted-foreground p-2 bg-muted rounded italic">ID will be generated automatically upon creation.</div>}
                                        </div>
                                        <div className="space-y-1"><Label>Full Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Phone Number</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                                        {!editingUid && <div className="space-y-1"><Label>Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/></div>}
                                        <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Gender</Label><Select onValueChange={setGender} value={gender} disabled={loading}><SelectTrigger><SelectValue placeholder="Select gender"/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select></div>
                                        <div className="space-y-1"><Label>National ID</Label><Input placeholder="e.g., 123456/78/9" value={nationalId} onChange={e => setNationalId(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Passport Number (Optional)</Label><Input placeholder="e.g., ZA12345" value={passport} onChange={e => setPassport(e.target.value)} disabled={loading}/></div>
                                    </div>
                                    <div className="space-y-1"><Label>Address</Label><Textarea placeholder="Residential Address" value={address} onChange={e => setAddress(e.target.value)} disabled={loading}/></div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger className="text-lg font-semibold">Academic Information</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="space-y-4 rounded-md border p-3 bg-muted/20">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Programme</Label><Select onValueChange={setProgramme} value={programme} disabled={loading}><SelectTrigger><SelectValue placeholder="Select a programme" /></SelectTrigger><SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label>Intake</Label><Select onValueChange={setSelectedIntake} value={selectedIntake} disabled={loading}><SelectTrigger><SelectValue placeholder="Select an intake" /></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label>Year of Study</Label><Select onValueChange={(v) => setSelectedYear(Number(v))} value={String(selectedYear)} disabled={loading || !selectedIntake || !programme}><SelectTrigger><SelectValue placeholder="Select year..."/></SelectTrigger><SelectContent>{availableYears.map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label>Current Semester</Label><Select onValueChange={setSelectedSemester} value={selectedSemester} disabled={loading || !selectedYear}><SelectTrigger><SelectValue placeholder="Select semester..."/></SelectTrigger><SelectContent>{availableSemesters.map(s => <SelectItem key={s.id} value={s.id}>Semester {s.semesterInYear}</SelectItem>)}</SelectContent></Select></div>
                                        </div>
                                        <div className="flex items-center space-x-2 pt-2"><Checkbox id="isTransfer" checked={isTransfer} onCheckedChange={(checked) => setIsTransfer(checked as boolean)} disabled={loading}/><Label htmlFor="isTransfer">Grant course exemptions</Label></div>
                                        {isTransfer && (<Accordion type="single" collapsible className="w-full"><AccordionItem value="exemptions" className="border-none"><AccordionTrigger>Course Exemptions</AccordionTrigger><AccordionContent>{coursesForSelectedProgramme.length > 0 ? coursesForSelectedProgramme.map(course => (<div key={course.id} className="flex items-center gap-2 mb-1"><Checkbox id={`exempt-${course.id}`} checked={!!exemptedCourses[course.id]} onCheckedChange={() => handleExemptionChange(course.id)}/><Label htmlFor={`exempt-${course.id}`} className="font-normal">{course.name} ({course.code})</Label></div>)) : <p className="text-sm text-muted-foreground">Select a programme to see courses.</p>}</AccordionContent></AccordionItem></Accordion>)}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="item-3">
                                <AccordionTrigger className="text-lg font-semibold">Guardian & Background</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 rounded-md border p-3"><Label>Parent/Guardian</Label><div className="space-y-2 pt-1"><Input placeholder="Full Name" value={guardianName} onChange={e => setGuardianName(e.target.value)} /><Input placeholder="Contact Number" value={guardianContact} onChange={e => setGuardianContact(e.target.value)} /></div></div>
                                        <div className="space-y-2 rounded-md border p-3"><Label>Emergency Contact</Label><div className="space-y-2 pt-1"><Input placeholder="Full Name" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} /><Input placeholder="Relationship" value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} /><Input placeholder="Contact Number" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} /></div></div>
                                    </div>
                                    <div className="space-y-2 rounded-md border p-3"><Label>Education Background</Label><div className="space-y-2 pt-1"><Input placeholder="Previous School" value={previousSchool} onChange={e => setPreviousSchool(e.target.value)} /><Textarea placeholder="Qualifications / Certificates" value={qualifications} onChange={e => setQualifications(e.target.value)} /></div></div>
                                    <div className="space-y-2 rounded-md border p-3"><Label>Medical History & Special Needs</Label><Textarea placeholder="e.g., Allergies, disabilities, etc." value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} /></div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit" form="student-form" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingUid ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            {editingUid ? 'Save Changes' : 'Create Student Account'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <Card className="max-w-4xl mx-auto shadow-md">
                <CardHeader>
                    <CardTitle>Registered Students</CardTitle>
                    <CardDescription>Search and edit existing student records.</CardDescription>
                    <div className="relative pt-2">
                        <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, ID, or email..."
                            className="pl-8"
                            value={listSearchTerm}
                            onChange={(e) => setListSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Programme</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tableLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ))
                            ) : filteredStudents.length > 0 ? (
                                filteredStudents.map(student => (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-mono text-xs">{student.id}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{student.name}</div>
                                        <div className="text-xs text-muted-foreground">{student.email}</div>
                                    </TableCell>
                                    <TableCell className="text-xs">{student.programmeName}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => openCredentialsPreview(student)} title="Send Credentials Email">
                                            <Mail className="h-4 w-4 mr-2" /> Creds
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditStudent(student)}>
                                            <Pencil className="h-4 w-4 mr-2" /> Edit
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No students found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Preview Credentials Email</DialogTitle>
                        <DialogDescription>Review and edit the welcome message for {selectedStudentForCreds?.name} before sending.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4 space-y-4">
                        <div className="space-y-1"><Label>Subject</Label><Input value={credSubject} onChange={e => setCredSubject(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Message Body (HTML)</Label><Textarea value={credBody} onChange={e => setCredBody(e.target.value)} rows={15} className="font-mono text-xs" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCredentialsOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendCredentials} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Send Credentials
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
