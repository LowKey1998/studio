
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import * as React from 'react';
import { UserPlus, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, push, serverTimestamp, query, orderByChild, equalTo } from 'firebase/database';
import { app, auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';

type Programme = { id: string; name: string; courseIds?: Record<string, boolean>; };
type Semester = { id: string; name: string; status: string; };
type Course = { id: string; name: string; code: string; year: number; }
type Intake = { id: string; name: string; };
type CurrentAdmin = { name: string; id: string; }

export default function AddStudentPage() {
    // Form state
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [programme, setProgramme] = React.useState('');
    const [year, setYear] = React.useState('');
    const [semester, setSemester] = React.useState('');
    const [isTransfer, setIsTransfer] = React.useState(false);
    const [exemptedCourses, setExemptedCourses] = React.useState<Record<string, boolean>>({});
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [manualId, setManualId] = React.useState('');
    const [isManualId, setIsManualId] = React.useState(false);
    
    // Detailed info state
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

    // Data for dropdowns
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });

    // System state
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    const [loading, setLoading] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
              setCurrentAdmin({ name: snapshot.val().name, id: snapshot.val().id });
            }
          }
        });
        
        const fetchDataForDropdowns = async () => {
            const [programmesSnap, coursesSnap, intakesSnap, semestersSnap, settingsSnap] = await Promise.all([
                get(ref(db, 'programmes')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/intakes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'settings/idPrefixes')),
            ]);
            if (programmesSnap.exists()) setAllProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] })));
            if (coursesSnap.exists()) setAllCourses(Object.keys(coursesSnap.val()).map(id => ({ id, ...coursesSnap.val()[id] })));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (semestersSnap.exists()) setAllSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id] })));
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val());
        };

        fetchDataForDropdowns();

        return () => { unsubscribe(); };
    }, []);

    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setProgramme(''); setYear(''); setSemester(''); setIsTransfer(false); setExemptedCourses({}); setSelectedIntake('');
        setManualId(''); setIsManualId(false);
        setDob(''); setGender(''); setNationalId(''); setPassport(''); setAddress('');
        setGuardianName(''); setGuardianContact('');
        setEmergencyName(''); setEmergencyRelationship(''); setEmergencyContact('');
        setPreviousSchool(''); setQualifications(''); setMedicalHistory('');
    };

    const handleCreateStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !programme || !year || !selectedIntake || !semester) { toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required academic and basic information fields.' }); return; }
        if (isManualId && !manualId.trim()) { toast({ variant: 'destructive', title: 'Manual ID cannot be empty.'}); return; }

        setLoading(true);
        const tempAppName = `temp-student-creation-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            let newId = '';
            const prefixes = idSettings || { student: 'STU' };
            const isIdTaken = async (id: string) => {
                 const userQuery = query(ref(db, 'users'), orderByChild('id'), equalTo(id));
                 const snapshot = await get(userQuery);
                 return snapshot.exists();
            };

            if (isManualId) {
                newId = manualId.trim();
                if (await isIdTaken(newId)) {
                    toast({ variant: 'destructive', title: 'ID already exists', description: 'This User ID is already in use. Please choose another.' });
                    setLoading(false); await deleteApp(tempApp); return;
                }
            } else {
                const counterRef = ref(db, 'userCounters/student');
                let isUniqueIdFound = false;
                while (!isUniqueIdFound) {
                    await runTransaction(counterRef, (currentCount) => {
                        const count = (currentCount || 0) + 1;
                        let datePart = '';
                        const now = new Date();
                        if(idSettings.includeYear) datePart += format(now, 'yy');
                        if(idSettings.includeMonth) datePart += format(now, 'MM');
                        newId = `${prefixes.student}${datePart}${String(count).padStart(3, '0')}`;
                        return count;
                    });
                    if (!(await isIdTaken(newId))) isUniqueIdFound = true;
                }
            }

            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const user = userCredential.user;
            
            const newStudentUser: any = { 
                id: newId, name, email, phoneNumber, role: 'Student', status: 'active',
                programmeId: programme, year: Number(year), semesterId: semester, intakeId: selectedIntake,
                dob, gender, nationalId, passport, address, medicalHistory,
                guardian: { name: guardianName, contact: guardianContact },
                emergencyContact: { name: emergencyName, relationship: emergencyRelationship, contact: emergencyContact },
                educationBackground: { school: previousSchool, qualifications }
            };
            if(isTransfer && Object.keys(exemptedCourses).length > 0) newStudentUser.exemptedCourses = exemptedCourses;

            await set(ref(db, `users/${user.uid}`), newStudentUser);
            await set(ref(db, `userRoles/${user.uid}`), { role: 'student' });
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { user: currentAdmin?.name || 'Admin', userId: currentAdmin?.id || 'N/A', action: `created a new student account for '${name}' (**${newId}**).`, timestamp: serverTimestamp() });
            toast({ variant: 'success', title: 'Student Created Successfully', description: `${name} has been created with User ID: ${newId}` });
            resetForm();
        } catch (error: any) {
            console.error("Error creating student user:", error);
            toast({ variant: 'destructive', title: 'User Creation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            await deleteApp(tempApp); setLoading(false);
        }
    };
    
    const handlePastePrefix = () => {
        const prefixes = idSettings || { student: 'STU' };
        let datePart = '';
        const now = new Date();
        if (idSettings.includeYear) datePart += format(now, 'yy');
        if (idSettings.includeMonth) datePart += format(now, 'MM');
        setManualId(`${prefixes.student}${datePart}`);
    };

    const availableSemesters = allSemesters.filter(s => {
        const intake = allIntakes.find(i => i.id === selectedIntake);
        const intakeYear = intake ? parseInt(intake.name.substring(0, 4), 10) : null;
        if (!intakeYear || !year) return false;
        
        const expectedYearInSemester = intakeYear + (Number(year) - 1);
        return s.name.includes(String(expectedYearInSemester));
    });

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl"><UserPlus/> Add New Student</CardTitle>
                <CardDescription>Create a new account for a student. An ID will be generated unless you provide one.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateStudent}>
            <CardContent>
                 <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-lg font-semibold">Basic & Academic Information</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-3">
                                    <Label>User ID</Label>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <Switch id="manual-id-switch" checked={isManualId} onCheckedChange={setIsManualId} />
                                        <Label htmlFor="manual-id-switch">{isManualId ? 'Manual ID' : 'Auto-generate ID'}</Label>
                                    </div>
                                    {isManualId && <div className="flex gap-2 mt-2">
                                        <Input placeholder="Enter custom User ID" value={manualId} onChange={(e) => setManualId(e.target.value)} />
                                        <Button type="button" variant="outline" size="icon" onClick={handlePastePrefix} title="Paste current prefix"><Copy className="h-4 w-4"/></Button>
                                    </div>}
                                </div>
                                <div className="space-y-1"><Label>Full Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading} required/></div>
                                <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} required/></div>
                                <div className="space-y-1"><Label>Phone Number (Optional)</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Initial Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required/></div>
                                
                                <div className="space-y-1"><Label>Intake</Label><Select onValueChange={setSelectedIntake} value={selectedIntake} disabled={loading} required><SelectTrigger><SelectValue placeholder="Select an intake" /></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1"><Label>Year of Study</Label><Input type="number" placeholder="e.g. 1" value={year} onChange={e => setYear(e.target.value)} disabled={loading || !selectedIntake} required/></div>
                                
                                <div className="space-y-1"><Label>Programme</Label><Select onValueChange={setProgramme} value={programme} disabled={loading} required><SelectTrigger><SelectValue placeholder="Select a programme" /></SelectTrigger><SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-1"><Label>Current Semester</Label><Select onValueChange={setSemester} value={semester} disabled={loading || !year} required><SelectTrigger><SelectValue placeholder="Select a semester" /></SelectTrigger><SelectContent>{availableSemesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger className="text-lg font-semibold">Other Details</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Gender</Label><Select onValueChange={setGender} value={gender} disabled={loading}><SelectTrigger><SelectValue placeholder="Select gender"/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1"><Label>National ID</Label><Input placeholder="e.g., 123456/78/9" value={nationalId} onChange={e => setNationalId(e.target.value)} disabled={loading}/></div>
                                <div className="lg:col-span-3 space-y-1"><Label>Passport Number</Label><Input placeholder="e.g., ZA12345" value={passport} onChange={e => setPassport(e.target.value)} disabled={loading}/></div>
                                <div className="lg:col-span-3 space-y-1"><Label>Address</Label><Textarea placeholder="Residential Address" value={address} onChange={e => setAddress(e.target.value)} disabled={loading}/></div>
                            </div>
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
            <CardFooter className="justify-end">
                 <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Create Student Account
                </Button>
            </CardFooter>
            </form>
        </Card>
    )
}
