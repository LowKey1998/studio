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
import { Badge } from '@/components/ui/badge';


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
};

type Programme = { id: string; name: string; courseIds?: Record<string, boolean>; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; year: number; semesterInYear: number; intakeId: string; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, { courses: string[] }>; };

export default function AddStudentPage() {
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
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<CoursePath[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>(null);
    
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
            const [programmesSnap, intakesSnap, settingsSnap, semestersSnap, coursePathsSnap, usersSnap] = await Promise.all([
                get(ref(db, 'programmes')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/idPrefixes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'users')),
            ]);

            const programmesData = programmesSnap.exists() ? programmesSnap.val() : {};
            if (programmesSnap.exists()) setAllProgrammes(Object.keys(programmesData).map(id => ({ id, ...programmesData[id] })));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (settingsSnap.exists()) setIdSettings(settingsSnap.val());
            if (semestersSnap.exists()) {
                const sData = semestersSnap.val();
                setAllSemesters(Object.keys(sData).map(id => ({ id, ...sData[id] })));
            }
            if (coursePathsSnap.exists()) {
                setAllCoursePaths(Object.values(coursePathsSnap.val()));
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
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setTableLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchInitialData(); }, [fetchInitialData]);
    
    // Cascade Logic
    React.useEffect(() => {
        if (!selectedIntake || !programme || allCoursePaths.length === 0) { setAvailableYears([]); return; }
        const path = allCoursePaths.find(p => p.intakeId === selectedIntake && p.programmeId === programme);
        if (!path || !path.semesters) { setAvailableYears([]); return; }
        const years = new Set<number>();
        Object.keys(path.semesters).forEach(semId => {
            const sem = allSemesters.find(s => s.id === semId);
            if(sem) years.add(sem.year);
        });
        setAvailableYears(Array.from(years).sort((a,b) => a - b));
    }, [selectedIntake, programme, allCoursePaths, allSemesters]);

    React.useEffect(() => {
        if (!selectedIntake || !selectedYear || !programme) { setAvailableSemesters([]); return; }
        const path = allCoursePaths.find(p => p.intakeId === selectedIntake && p.programmeId === programme);
        if (!path || !path.semesters) { setAvailableSemesters([]); return; }
        const semsInPath = Object.keys(path.semesters);
        const semsForYear = allSemesters.filter(s => s.intakeId === selectedIntake && s.year === selectedYear && semsInPath.includes(s.id));
        setAvailableSemesters(semsForYear.sort((a,b) => a.semesterInYear - b.semesterInYear));
    }, [selectedYear, selectedIntake, programme, allCoursePaths, allSemesters]);


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
                role: 'Student',
                programmeId: programme, year: Number(selectedYear), semesterId: selectedSemester, intakeId: selectedIntake,
                dob, gender, nationalId, passport, address, medicalHistory,
                guardian: { name: guardianName, contact: guardianContact, email: guardianEmail, relationship: guardianRelationship },
                emergencyContact: { name: emergencyName, relationship: emergencyRelationship, contact: emergencyContact },
                educationBackground: { school: previousSchool, qualifications: qualifications }
            };
            if(isTransfer) userDataPayload.exemptedCourses = exemptedCourses;

            if (editingUid) {
                if (isManualId) {
                    const newId = manualId.trim();
                    if (await isIdTaken(newId)) { toast({ variant: 'destructive', title: 'ID already taken' }); setLoading(false); return; }
                    userDataPayload.id = newId;
                }
                await updateUserAccount({ uid: editingUid, name, email, phoneNumber, dbData: userDataPayload });
                toast({ title: 'Student Updated' });
                resetForm(); fetchInitialData();
            } else {
                const tempAppName = `temp-user-${Date.now()}`;
                const tempApp = initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, tempAppName);
                const tempAuth = getAuth(tempApp);

                let newId = '';
                if (isManualId) {
                    newId = manualId.trim();
                    if (await isIdTaken(newId)) { toast({ variant: 'destructive', title: 'ID already exists' }); setLoading(false); await deleteApp(tempApp); return; }
                } else {
                    const counterRef = ref(db, `userCounters/Student`);
                    let uniqueFound = false;
                    while (!uniqueFound) {
                        await runTransaction(counterRef, (current) => {
                            const count = (current || 0) + 1;
                            const prefix = idSettings?.student || 'STU';
                            newId = `${prefix}${String(count).padStart(3, '0')}`;
                            return count;
                        });
                        if (!(await isIdTaken(newId))) uniqueFound = true;
                    }
                }

                const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
                userDataPayload.id = newId;
                await set(ref(db, `users/${userCredential.user.uid}`), userDataPayload);
                await set(ref(db, `userRoles/${userCredential.user.uid}`), { role: 'student' });
                
                await sendEmail({
                    to: [email],
                    subject: `Welcome to the Portal!`,
                    body: `<h2>Welcome!</h2><p>Your account is ready. Access the portal at <a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></p><ul><li><strong>User ID:</strong> ${newId}</li><li><strong>Password:</strong> ${password}</li></ul><p><strong>Note:</strong> If you have trouble logging in, please try using <strong>12345678</strong> as your temporary password.</p>`
                });

                toast({ title: 'Student Created', description: `ID: ${newId}` });
                await deleteApp(tempApp); resetForm(); fetchInitialData();
            }
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); }
        finally { setLoading(false); }
    };
    
    const handleEditStudent = (student: User) => {
        setEditingUid(student.uid);
        setName(student.name); setEmail(student.email); setPhoneNumber(student.phoneNumber || '');
        setProgramme(student.programmeId || ''); setSelectedIntake(student.intakeId || '');
        setSelectedYear(student.year || ''); setSelectedSemester(student.semesterId || '');
        setDob(student.dob || ''); setGender(student.gender || '');
        setNationalId(student.nationalId || ''); setPassport(student.passport || '');
        setAddress(student.address || ''); setGuardianName(student.guardian?.name || '');
        setGuardianContact(student.guardian?.contact || ''); setGuardianEmail(student.guardian?.email || '');
        setGuardianRelationship(student.guardian?.relationship || '');
        setEmergencyName(student.emergencyContact?.name || '');
        setEmergencyRelationship(student.emergencyContact?.relationship || '');
        setEmergencyContact(student.emergencyContact?.contact || '');
        setPreviousSchool(student.educationBackground?.school || '');
        setQualifications(student.educationBackground?.qualifications || '');
        setMedicalHistory(student.medicalHistory || '');
        setManualId(student.id); setIsManualId(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openCredentialsPreview = (user: User) => {
        setSelectedStudentForCreds(user);
        setCredSubject('Your Portal Login Details');
        setCredBody(`<h2>Login Details</h2><p>Hello ${user.name},</p><p>Access your portal at <a href="https://edutrack36.vercel.app">https://edutrack36.vercel.app</a></p><ul><li><strong>User ID:</strong> ${user.id}</li></ul><p><strong>Note:</strong> If you have trouble logging in, please try using <strong>12345678</strong> as your temporary password.</p>`);
        setIsCredentialsOpen(true);
    };

    const handleSendCredentials = async () => {
        if (!selectedStudentForCreds) return;
        setLoading(true);
        try {
            await sendEmail({ to: [selectedStudentForCreds.email], subject: credSubject, body: credBody });
            toast({ title: 'Credentials Sent' }); setIsCredentialsOpen(false);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to Send' }); }
        finally { setLoading(false); }
    };

    const filteredStudents = students.filter(s => !listSearchTerm || s.name.toLowerCase().includes(listSearchTerm.toLowerCase()) || s.id.toLowerCase().includes(listSearchTerm.toLowerCase()));

    return (
        <div className="space-y-8">
            <Card className="max-w-4xl mx-auto border-primary/20 shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-headline text-2xl">{editingUid ? 'Edit Student' : 'Add New Student'}</CardTitle>
                            <CardDescription>Fill in the form to manage student accounts.</CardDescription>
                        </div>
                        {editingUid && <Button variant="ghost" onClick={resetForm}><X className="mr-2 h-4 w-4"/> Cancel</Button>}
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
                                            <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4"/> User ID</Label>
                                            <div className="flex items-center space-x-2"><Switch id="manual-id" checked={isManualId} onCheckedChange={setIsManualId} /><Label htmlFor="manual-id">Manual Edit</Label></div>
                                            {isManualId ? <Input value={manualId} onChange={(e) => setManualId(e.target.value.toUpperCase())} /> : <div className="text-xs text-muted-foreground p-2 bg-muted rounded italic">Auto-generated.</div>}
                                        </div>
                                        <div className="space-y-1"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} required/></div>
                                        <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></div>
                                        <div className="space-y-1"><Label>Phone</Label><Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}/></div>
                                        {!editingUid && <div className="space-y-1"><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required/></div>}
                                        <div className="space-y-1"><Label>DOB</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)}/></div>
                                        <div className="space-y-1"><Label>Gender</Label><Select onValueChange={setGender} value={gender}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select></div>
                                    </div>
                                    <div className="space-y-1"><Label>Address</Label><Textarea value={address} onChange={e => setAddress(e.target.value)}/></div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                                <AccordionTrigger className="text-lg font-semibold">Academic Info</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label>Programme</Label><Select onValueChange={setProgramme} value={programme}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="space-y-1"><Label>Intake</Label><Select onValueChange={setSelectedIntake} value={selectedIntake}><SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="space-y-1"><Label>Year</Label><Select onValueChange={(v) => setSelectedYear(Number(v))} value={String(selectedYear)}><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{availableYears.map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="space-y-1"><Label>Semester</Label><Select onValueChange={setSelectedSemester} value={selectedSemester}><SelectTrigger><SelectValue placeholder="Semester"/></SelectTrigger><SelectContent>{availableSemesters.map(s => <SelectItem key={s.id} value={s.id}>Semester {s.semesterInYear}</SelectItem>)}</SelectContent></Select></div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </CardContent>
                    <CardFooter className="justify-end"><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingUid ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}{editingUid ? 'Save' : 'Create'}</Button></CardFooter>
                </form>
            </Card>

            <Card className="max-w-4xl mx-auto shadow-md">
                <CardHeader>
                    <CardTitle>Registered Students</CardTitle>
                    <div className="relative pt-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-8" value={listSearchTerm} onChange={(e) => setListSearchTerm(e.target.value)} /></div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Programme</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {tableLoading ? Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)) : 
                            filteredStudents.map(student => (
                                <TableRow key={student.uid}>
                                    <TableCell className="font-mono text-xs">{student.id}</TableCell>
                                    <TableCell><div>{student.name}</div><div className="text-xs text-muted-foreground">{student.email}</div></TableCell>
                                    <TableCell className="text-xs">{student.programmeName}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="sm" onClick={() => openCredentialsPreview(student)}><Mail className="h-4 w-4 mr-2" /> Creds</Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditStudent(student)}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Preview Email</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1"><Label>Subject</Label><Input value={credSubject} onChange={e => setCredSubject(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Body (HTML)</Label><Textarea value={credBody} onChange={e => setCredBody(e.target.value)} rows={10} className="font-mono text-xs" /></div>
                    </div>
                    <DialogFooter><Button onClick={handleSendCredentials} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Send</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}