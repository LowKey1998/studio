
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, MoreVertical, Search, Loader2, UserX, UserCheck, Trash2, Pencil, Copy, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, child, push, serverTimestamp, update, onValue, remove, query, orderByChild, equalTo } from 'firebase/database';
import { app, auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { onAuthStateChanged } from 'firebase/auth';
import { updateUserStatus } from '@/ai/flows/update-user-status';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { DialogTrigger } from '@radix-ui/react-dialog';


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
    guardian?: { name: string; contact: string; };
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
    status: string;
};

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
}

type CurrentAdmin = {
    name: string;
    id: string;
}

type Intake = {
    id: string;
    name: string;
}

type SubRole = {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
}

export default function AddStudentPage() {
    const [open, setOpen] = React.useState(true); // Default dialog to open
    
    // State for creating a user
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const role = 'student'; // Hardcoded role
    const [programme, setProgramme] = React.useState('');
    const [year, setYear] = React.useState('');
    const [semesterInYear, setSemesterInYear] = React.useState('');
    const [isTransfer, setIsTransfer] = React.useState(false);
    const [exemptedCourses, setExemptedCourses] = React.useState<Record<string, boolean>>({});
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [manualId, setManualId] = React.useState('');
    const [isManualId, setIsManualId] = React.useState(false);
    
    const [dob, setDob] = React.useState('');
    const [gender, setGender] = React.useState('');
    const [nationalId, setNationalId] = React.useState('');
    const [passport, setPassport] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [guardianName, setGuardianName] = React.useState('');
    const [guardianContact, setGuardianContact] = React.useState('');
    const [emergencyName, setEmergencyName] = React.useState('');
    const [emergencyRelationship, setEmergencyRelationship] = React.useState('');
    const [emergencyContact, setEmergencyContact] = React.useState('');
    const [previousSchool, setPreviousSchool] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');
    const [medicalHistory, setMedicalHistory] = React.useState('');
    
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    
    // Data for dialogs
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
    
    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
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

    const fetchInitialData = React.useCallback(async () => {
        setTableLoading(true);
        try {
            const [programmesSnap, coursesSnap, intakesSnap, settingsSnap, semestersSnap] = await Promise.all([
                get(child(ref(db), 'programmes')),
                get(child(ref(db), 'courses')),
                get(child(ref(db), 'intakes')),
                get(child(ref(db), 'settings/idPrefixes')),
                get(child(ref(db), 'semesters')),
            ]);

            if (programmesSnap.exists()) setAllProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] }))); else setAllProgrammes([]);
            if (coursesSnap.exists()) setAllCourses(Object.keys(coursesSnap.val()).map(id => ({ id, ...coursesSnap.val()[id] }))); else setAllCourses([]);
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] }))); else setAllIntakes([]);
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val()); else setIdSettings({ student: 'STU', staff: 'STF', admin: 'ADM' });
            if (semestersSnap.exists()) setAllSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] }))); else setAllSemesters([]);

        } catch (error) {
            console.error("Error fetching data:", error);
             toast({ variant: 'destructive', title: 'Failed to fetch data', description: 'Could not load data from the database.' });
        } finally {
            setTableLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setProgramme(''); setYear(''); setSemesterInYear(''); setIsTransfer(false); setExemptedCourses({}); setSelectedIntake('');
        setManualId(''); setIsManualId(false);
        setDob(''); setGender(''); setNationalId(''); setPassport(''); setAddress('');
        setGuardianName(''); setGuardianContact('');
        setEmergencyName(''); setEmergencyRelationship(''); setEmergencyContact('');
        setPreviousSchool(''); setQualifications(''); setMedicalHistory('');
    };
    
    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const intakeName = allIntakes.find(i => i.id === selectedIntake)?.name;
        const fullSemesterName = `${intakeName} Year ${year} Semester ${semesterInYear}`;
        const semester = allSemesters.find(s => s.name === fullSemesterName);

        if (!name || !email || !password || !role) { toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required fields.' }); return; }
        if (!programme || !year || !selectedIntake || !semesterInYear) { toast({ variant: 'destructive', title: 'Missing Student Info', description: 'Please assign an intake, programme, year, and semester for the student.' }); return; }
        if(!semester) { toast({ variant: 'destructive', title: 'Invalid Semester', description: `The semester "${fullSemesterName}" could not be found. Please check your inputs or create it in Semester Management.` }); return; }
        if (isManualId && !manualId.trim()) { toast({ variant: 'destructive', title: 'Manual ID cannot be empty.'}); return; }

        setLoading(true);
        
        const tempAppName = `temp-user-creation-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            let newId = '';
            const prefixes = idSettings || { student: 'STU', staff: 'STF', admin: 'ADM' };
            
            const isIdTaken = async (id: string) => {
                 const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(id));
                 const snapshot = await get(userQuery);
                 return snapshot.exists();
            };

            if (isManualId) {
                newId = manualId.trim();
                if (await isIdTaken(newId)) {
                    toast({ variant: 'destructive', title: 'ID already exists', description: 'This User ID is already in use. Please choose another.' });
                    setLoading(false);
                    await deleteApp(tempApp);
                    return;
                }
            } else {
                const counterRef = ref(db, `userCounters/student`);
                let isUniqueIdFound = false;

                while (!isUniqueIdFound) {
                    await runTransaction(counterRef, (currentCount) => {
                        const count = (currentCount || 0) + 1;
                        const basePrefix = prefixes.student;
                        let datePart = '';
                        const now = new Date();
                        if(idSettings.includeYear) datePart += format(now, 'yy');
                        if(idSettings.includeMonth) datePart += format(now, 'MM');
                        newId = `${basePrefix}${datePart}${String(count).padStart(3, '0')}`;
                        return count;
                    });

                    if (!(await isIdTaken(newId))) {
                        isUniqueIdFound = true;
                    }
                }
            }
            
            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const user = userCredential.user;
            
            const newUserRole = role.charAt(0).toUpperCase() + role.slice(1);
            const newUser: Omit<User, 'uid'> = { 
                id: newId, name, email, phoneNumber, role: newUserRole, status: 'active'
            };
            
            Object.assign(newUser, {
                programmeId: programme, year: Number(year), semesterId: semester.id, intakeId: selectedIntake,
                dob, gender, nationalId, passport, address, medicalHistory,
                guardian: { name: guardianName, contact: guardianContact },
                emergencyContact: { name: emergencyName, relationship: emergencyRelationship, contact: emergencyContact },
                educationBackground: { school: previousSchool, qualifications: qualifications }
            });
            if(isTransfer && Object.keys(exemptedCourses).length > 0) newUser.exemptedCourses = exemptedCourses;

            await set(ref(db, `users/${user.uid}`), newUser);
            await set(ref(db, `userRoles/${user.uid}`), { role: role });
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { user: currentAdmin?.name || 'Admin', userId: currentAdmin?.id || 'N/A', action: `created a new ${newUser.role} account for '${name}' (**${newId}**).`, timestamp: serverTimestamp() });
            toast({ variant: 'success', title: 'User Created Successfully', description: `${name} has been created with User ID: ${newId}` });
            resetForm(); 
            setOpen(false); // Close dialog on success
        } catch (error: any) {
            console.error("Error creating user:", error);
            toast({ variant: 'destructive', title: 'User Creation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            await deleteApp(tempApp); setLoading(false);
        }
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

    const handlePastePrefix = () => {
        const prefixes = idSettings || { student: 'STU' };
        const basePrefix = prefixes.student;
        
        let datePart = '';
        const now = new Date();
        if(idSettings.includeYear) datePart += format(now, 'yy');
        if(idSettings.includeMonth) datePart += format(now, 'MM');
        setManualId(`${basePrefix}${datePart}`);
    };

    return (
        <>
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Add New Student</CardTitle>
                    <CardDescription>Create a new account for a student. An ID will be generated unless you provide one.</CardDescription>
                </CardHeader>
                <form id="add-student-form" onSubmit={handleCreateUser}>
                    <CardContent>
                        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger className="text-lg font-semibold">Basic Information</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>User ID</Label>
                                            <div className="flex items-center space-x-2">
                                                <Switch id="manual-id-switch" checked={isManualId} onCheckedChange={setIsManualId} />
                                                <Label htmlFor="manual-id-switch">{isManualId ? 'Manual ID' : 'Auto-generate ID'}</Label>
                                            </div>
                                            {isManualId && <div className="flex gap-2">
                                                <Input placeholder="Enter custom User ID" value={manualId} onChange={(e) => setManualId(e.target.value)} />
                                                <Button type="button" variant="outline" size="icon" onClick={handlePastePrefix} title="Paste current prefix"><Copy className="h-4 w-4"/></Button>
                                            </div>}
                                        </div>
                                        <div className="space-y-1"><Label>Full Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Phone Number (Optional)</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                                        <div className="space-y-1"><Label>Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/></div>
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
                                    <div className="space-y-4 rounded-md border p-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Intake</Label><Select onValueChange={setSelectedIntake} value={selectedIntake} disabled={loading}><SelectTrigger><SelectValue placeholder="Select an intake" /></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label>Programme</Label><Select onValueChange={setProgramme} value={programme} disabled={loading}><SelectTrigger><SelectValue placeholder="Select a programme" /></SelectTrigger><SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label>Year of Study</Label><Input type="number" placeholder="e.g. 1" value={year} onChange={e => setYear(e.target.value)} disabled={loading}/></div>
                                            <div className="space-y-1"><Label>Semester in Year</Label><Input type="number" placeholder="e.g., 1 or 2" value={semesterInYear} onChange={e => setSemesterInYear(e.target.value)} disabled={loading} /></div>
                                        </div>
                                        <div className="flex items-center space-x-2 pt-2"><Checkbox id="isTransfer" checked={isTransfer} onCheckedChange={(checked) => setIsTransfer(checked as boolean)} disabled={loading}/><Label htmlFor="isTransfer">This is a transfer student (grant course exemptions)</Label></div>
                                        {isTransfer && (<Accordion type="single" collapsible className="w-full"><AccordionItem value="exemptions"><AccordionTrigger>Course Exemptions</AccordionTrigger><AccordionContent>{coursesForSelectedProgramme.length > 0 ? coursesForSelectedProgramme.map(course => (<div key={course.id} className="flex items-center gap-2"><Checkbox id={`exempt-${course.id}`} checked={!!exemptedCourses[course.id]} onCheckedChange={() => handleExemptionChange(course.id)}/><Label htmlFor={`exempt-${course.id}`} className="font-normal">{course.name} ({course.code})</Label></div>)) : <p className="text-sm text-muted-foreground">Select a programme to see courses.</p>}</AccordionContent></AccordionItem></Accordion>)}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="item-3">
                                <AccordionTrigger className="text-lg font-semibold">Other Details</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 rounded-md border p-3"><Label>Parent/Guardian</Label><div className="space-y-2 pt-1"><Input placeholder="Full Name" value={guardianName} onChange={e => setGuardianName(e.target.value)} /><Input placeholder="Contact Number" value={guardianContact} onChange={e => setGuardianContact(e.target.value)} /></div></div>
                                        <div className="space-y-2 rounded-md border p-3"><Label>Emergency Contact</Label><div className="space-y-2 pt-1"><Input placeholder="Full Name" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} /><Input placeholder="Relationship" value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} /><Input placeholder="Contact Number" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} /></div></div>
                                    </div>
                                    <div className="space-y-2 rounded-md border p-3"><Label>Education Background</Label><div className="space-y-2 pt-1"><Input placeholder="Previous School" value={previousSchool} onChange={e => setPreviousSchool(e.target.value)} /><Textarea placeholder="Qualifications / Certificates" value={qualifications} onChange={e => setQualifications(e.target.value)} /></div></div>
                                    <div className="space-y-2 rounded-md border p-3"><Label>Medical History &amp; Special Needs</Label><Textarea placeholder="e.g., Allergies, disabilities, etc." value={medicalHistory} onChange={e => setMedicalHistory(e.target.value)} /></div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" form="add-student-form" disabled={loading || tableLoading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            Create Student Account
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </>
    );
}
