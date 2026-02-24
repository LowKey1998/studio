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
import { PlusCircle, Loader2, Search, Pencil, Save, X, KeyRound, Mail, Send, ClipboardList, UserPlus, CheckCircle2, Banknote, Link as LinkIcon, GraduationCap, Wallet } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, push, query, orderByChild, equalTo, update, onValue, remove, serverTimestamp } from 'firebase/database';
import { db, createNotification } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { initializeApp, deleteApp } from 'firebase/app';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { updateUserAccount } from '@/ai/flows/update-user-account';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

type User = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    paymentPlan?: string;
    programmeId?: string;
    programmeName?: string;
    year?: number;
    semesterId?: string;
    intakeId?: string;
    scholarshipId?: string;
    dob?: string;
    gender?: string;
    nationalId?: string;
    passport?: string;
    address?: string;
    guardian?: { name: string; contact: string; email?: string; relationship?: string; };
    educationBackground?: { school: string; qualifications: string; };
    medicalHistory?: string;
};

type CreationRequest = {
    id: string;
    tempId: string;
    tempName: string;
    targetSemesterId: string;
    amountPaid: number;
    comment: string;
    status: 'pending' | 'completed';
    timestamp: number;
};

type Scholarship = { id: string; name: string; percentage: number; };
type PaymentPlan = { id: string; name: string; installments: number; archived?: boolean; };

export default function AddStudentPage() {
    // Form State
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [programme, setProgramme] = React.useState('');
    const [scholarshipId, setScholarshipId] = React.useState('');
    const [paymentPlanName, setPaymentPlanName] = React.useState('');
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
    const [previousSchool, setPreviousSchool] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');
    const [medicalHistory, setMedicalHistory] = React.useState('');
    
    // Cascading Dropdown State
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState<number | ''>('');
    const [selectedSemester, setSelectedSemester] = React.useState('');
    const [availableYears, setAvailableYears] = React.useState<number[]>([]);
    const [availableSemesters, setAvailableSemesters] = React.useState<any[]>([]);

    const [editingUid, setEditingUid] = React.useState<string | null>(null);
    const [currentRequestId, setCurrentRequestId] = React.useState<string | null>(null);
    
    // Data
    const [allProgrammes, setAllProgrammes] = React.useState<any[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<any[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<any[]>([]);
    const [allCoursePaths, setAllCoursePaths] = React.useState<any[]>([]);
    const [allScholarships, setAllScholarships] = React.useState<Scholarship[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [pendingRequests, setPendingRequests] = React.useState<CreationRequest[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>(null);
    const [students, setStudents] = React.useState<User[]>([]);
    const [listSearchTerm, setListSearchTerm] = React.useState('');
    
    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    // Linking logic
    const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);
    const [linkingRequest, setLinkingRequest] = React.useState<CreationRequest | null>(null);
    const [linkSearchTerm, setLinkSearchTerm] = React.useState('');

    const fetchInitialData = React.useCallback(async () => {
        setTableLoading(true);
        try {
            const [p, i, pref, s, paths, u, reqs, schol, plans] = await Promise.all([
                get(ref(db, 'programmes')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/idPrefixes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'users')),
                get(ref(db, 'studentCreationRequests')),
                get(ref(db, 'scholarships')),
                get(ref(db, 'settings/paymentPlans'))
            ]);

            const pData = p.val() || {};
            setAllProgrammes(Object.keys(pData).map(id => ({ id, ...pData[id] })));
            setAllIntakes(i.exists() ? Object.keys(i.val()).map(id => ({ id, ...i.val()[id] })) : []);
            setIdSettings(pref.val());
            const semData = s.exists() ? Object.keys(s.val()).map(id => ({ id, ...s.val()[id] })) : [];
            setAllSemesters(semData);
            setAllCoursePaths(paths.exists() ? Object.values(paths.val()) : []);
            
            if (schol.exists()) setAllScholarships(Object.entries(schol.val()).map(([id, d]: [string, any]) => ({ id, ...d })));
            if (plans.exists()) setAllPaymentPlans(Object.entries(plans.val()).map(([id, d]: [string, any]) => ({ id, ...d })).filter(p => !p.archived));

            if (u.exists()) {
                const usersData = u.val();
                setStudents(Object.keys(usersData).filter(uid => usersData[uid].role === 'Student').map(uid => ({
                    uid, ...usersData[uid], programmeName: pData[usersData[uid].programmeId]?.name || 'N/A'
                })).sort((a,b) => b.id.localeCompare(a.id, undefined, { numeric: true })));
            }

            if (reqs.exists()) {
                setPendingRequests(Object.entries(reqs.val()).map(([id, d]:[string, any]) => ({ id, ...d })).filter(r => r.status === 'pending'));
            } else {
                setPendingRequests([]);
            }
        } catch (error) { console.error(error); }
        finally { setTableLoading(false); }
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
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setProgramme(''); setSelectedIntake('');
        setScholarshipId(''); setPaymentPlanName('');
        setManualId(''); setIsManualId(false);
        setDob(''); setGender(''); setNationalId(''); setPassport(''); setAddress('');
        setGuardianName(''); setGuardianContact(''); setGuardianEmail(''); setGuardianRelationship('');
        setPreviousSchool(''); setQualifications(''); setMedicalHistory('');
        setSelectedYear(''); setSelectedSemester('');
        setEditingUid(null);
        setCurrentRequestId(null);
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
                if (editingUid) return Object.keys(snapshot.val())[0] !== editingUid;
                return true;
            };

            const scholarship = allScholarships.find(s => s.id === scholarshipId);

            const userDataPayload: any = {
                name, email, phoneNumber, status: 'active',
                role: 'Student',
                programmeId: programme, year: Number(selectedYear), semesterId: selectedSemester, intakeId: selectedIntake,
                scholarshipId: scholarshipId || null,
                paymentPlan: paymentPlanName || null,
                dob, gender, nationalId, passport, address, medicalHistory,
                guardian: { name: guardianName, contact: guardianContact, email: guardianEmail, relationship: guardianRelationship },
                educationBackground: { school: previousSchool, qualifications }
            };

            if (editingUid) {
                if (isManualId) {
                    const newId = manualId.trim();
                    if (await isIdTaken(newId)) { toast({ variant: 'destructive', title: 'ID already taken' }); setLoading(false); return; }
                    userDataPayload.id = newId;
                }
                
                // Update specific registration node if phase is selected
                if (selectedSemester) {
                    const regRef = ref(db, `registrations/${editingUid}/${selectedSemester}`);
                    const regSnap = await get(regRef);
                    if (regSnap.exists()) {
                        await update(regRef, { paymentPlan: paymentPlanName || null, scholarshipId: scholarshipId || null });
                    }
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
                    await runTransaction(counterRef, (current) => {
                        const count = (current || 0) + 1;
                        const prefix = idSettings?.student || 'STU';
                        newId = `${prefix}${String(count).padStart(3, '0')}`;
                        return count;
                    });
                }

                const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
                const newUid = userCredential.user.uid;
                userDataPayload.id = newId;
                
                const updates: Record<string, any> = {};
                updates[`users/${newUid}`] = userDataPayload;
                updates[`userRoles/${newUid}`] = { role: 'student' };

                const txsSnap = await get(ref(db, 'transactions'));
                let foundUnlinkedTxId = null;
                if (txsSnap.exists()) {
                    const txs = txsSnap.val();
                    foundUnlinkedTxId = Object.keys(txs).find(k => 
                        txs[k].isUnlinked === true && 
                        (txs[k].senderName === name || txs[k].tempId === newId || txs[k].tempId === manualId)
                    );
                }

                if ((currentRequestId || foundUnlinkedTxId) && selectedSemester) {
                    const semester = allSemesters.find(s => s.id === selectedSemester);
                    const semesterName = semester?.name || 'Current Semester';
                    
                    const invRef = push(ref(db, `invoices/${newUid}`));
                    const newInvoiceId = invRef.key!;
                    
                    updates[`invoices/${newUid}/${newInvoiceId}`] = {
                        invoiceId: newInvoiceId,
                        semester: semesterName,
                        semesterId: selectedSemester,
                        dateCreated: new Date().toISOString(),
                        totalTuition: 0,
                        totalMandatoryFees: 0,
                        totalOptionalFees: 0,
                        courses: [],
                        optionalFees: [],
                        applyScholarship: !!scholarshipId,
                        scholarshipId: scholarshipId || null,
                        scholarshipPercentage: scholarship?.percentage || 0,
                        paymentPlan: paymentPlanName || null
                    };

                    updates[`registrations/${newUid}/${selectedSemester}`] = {
                        courses: [],
                        status: 'Pending Approval',
                        semesterName: semesterName,
                        registrationDate: new Date().toISOString(),
                        programmeId: programme,
                        intakeId: selectedIntake,
                        invoiceId: newInvoiceId,
                        source: 'manual',
                        applyScholarship: !!scholarshipId,
                        scholarshipId: scholarshipId || null,
                        scholarshipPercentage: scholarship?.percentage || 0,
                        paymentPlan: paymentPlanName || null
                    };

                    const txIdToLink = foundUnlinkedTxId || Object.keys(txsSnap.val()).find(k => txsSnap.val()[k].requestId === currentRequestId);
                    if (txIdToLink) {
                        updates[`transactions/${txIdToLink}/userId`] = newUid;
                        updates[`transactions/${txIdToLink}/invoiceId`] = newInvoiceId;
                        updates[`transactions/${txIdToLink}/isUnlinked`] = null;
                        updates[`transactions/${txIdToLink}/requestId`] = null;
                        updates[`transactions/${txIdToLink}/senderName`] = null;
                    }
                    if (currentRequestId) updates[`studentCreationRequests/${currentRequestId}`] = null;
                }

                await update(ref(db), updates);

                await sendEmail({
                    to: [email],
                    subject: `Welcome to the Portal!`,
                    body: `<h2>Welcome!</h2><p>Your account is ready.</p><ul><li><strong>User ID:</strong> ${newId}</li><li><strong>Password:</strong> ${password}</li></ul>`
                }).catch(() => {});

                toast({ title: 'Student Created', description: `ID: ${newId}` });
                await deleteApp(tempApp); resetForm(); fetchInitialData();
            }
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); }
        finally { setLoading(false); }
    };
    
    const handleProcessRequest = (req: CreationRequest) => {
        resetForm();
        setCurrentRequestId(req.id);
        setName(req.tempName);
        setManualId(req.tempId);
        setIsManualId(true);
        setSelectedIntake(allSemesters.find(s => s.id === req.targetSemesterId)?.intakeId || '');
        setSelectedSemester(req.targetSemesterId);
        toast({ title: 'Request Loaded', description: `Processing application for ${req.tempName}.` });
    };

    const handleLinkToExisting = async (existingStudentUid: string) => {
        if (!linkingRequest) return;
        setLoading(true);
        try {
            const txsSnap = await get(ref(db, 'transactions'));
            const updates: Record<string, any> = {};
            const now = new Date().toISOString();
            
            const targetSemId = linkingRequest.targetSemesterId;
            const semester = allSemesters.find(s => s.id === targetSemId);
            const semesterName = semester?.name || 'Current Semester';

            const studentRegSnap = await get(ref(db, `registrations/${existingStudentUid}/${targetSemId}`));
            let invoiceId = '';

            if (studentRegSnap.exists()) {
                invoiceId = studentRegSnap.val().invoiceId;
            } else {
                const newInvoiceRef = push(ref(db, `invoices/${existingStudentUid}`));
                invoiceId = newInvoiceRef.key!;
                
                updates[`invoices/${existingStudentUid}/${invoiceId}`] = {
                    invoiceId,
                    semester: semesterName,
                    semesterId: targetSemId,
                    dateCreated: now,
                    totalTuition: 0, totalMandatoryFees: 0, totalOptionalFees: 0,
                    courses: [], optionalFees: []
                };

                const studentInfo = students.find(s => s.uid === existingStudentUid);
                updates[`registrations/${existingStudentUid}/${targetSemId}`] = {
                    courses: [], status: 'Pending Approval', semesterName: semesterName, registrationDate: now,
                    programmeId: studentInfo?.programmeId || '', intakeId: studentInfo?.intakeId || '',
                    invoiceId: invoiceId, source: 'manual'
                };
            }
            
            if (txsSnap.exists()) {
                const txs = txsSnap.val();
                const targetTxId = Object.keys(txs).find(k => txs[k].requestId === linkingRequest.id);
                if (targetTxId) {
                    updates[`transactions/${targetTxId}/userId`] = existingStudentUid;
                    updates[`transactions/${targetTxId}/invoiceId`] = invoiceId;
                    updates[`transactions/${targetTxId}/isUnlinked`] = null;
                    updates[`transactions/${targetTxId}/requestId`] = null;
                    updates[`transactions/${targetTxId}/senderName`] = null;
                }
            }
            
            updates[`studentCreationRequests/${linkingRequest.id}`] = null;
            await update(ref(db), updates);
            
            await createNotification(existingStudentUid, `A deposit of ZMW ${linkingRequest.amountPaid.toFixed(2)} has been linked to your account.`, '/student/payments');
            toast({ title: 'Request Linked Successfully' });
            setIsLinkDialogOpen(false); setLinkingRequest(null); fetchInitialData();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Linking Failed', description: e.message }); }
        finally { existingStudentUid && setLoading(false); }
    };

    const handleOpenEdit = (student: User) => {
        setEditingUid(student.uid);
        setName(student.name);
        setEmail(student.email);
        setPhoneNumber(student.phoneNumber || '');
        setProgramme(student.programmeId || '');
        setScholarshipId(student.scholarshipId || '');
        setPaymentPlanName(student.paymentPlan || '');
        setSelectedIntake(student.intakeId || '');
        setSelectedYear(student.year ? Number(student.year) : '');
        setSelectedSemester(student.semesterId || '');
        setDob(student.dob || '');
        setGender(student.gender || '');
        setNationalId(student.nationalId || '');
        setPassport(student.passport || '');
        setAddress(student.address || '');
        setPreviousSchool(student.educationBackground?.school || '');
        setQualifications(student.educationBackground?.qualifications || '');
        setMedicalHistory(student.medicalHistory || '');
        setGuardianName(student.guardian?.name || '');
        setGuardianEmail(student.guardian?.email || '');
        setGuardianContact(student.guardian?.contact || '');
        setGuardianRelationship(student.guardian?.relationship || '');
        setIsEditOpen(true);
    };

    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const filteredStudents = students.filter(s => !listSearchTerm || s.name.toLowerCase().includes(listSearchTerm.toLowerCase()) || s.id.toLowerCase().includes(listSearchTerm.toLowerCase()));
    const linkingStudentsFiltered = students.filter(s => !linkSearchTerm || s.name.toLowerCase().includes(linkSearchTerm.toLowerCase()) || s.id.toLowerCase().includes(linkSearchTerm.toLowerCase()));

    return (
        <div className="space-y-8">
            <Tabs defaultValue="add">
                <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
                    <TabsTrigger value="add">Add Student</TabsTrigger>
                    <TabsTrigger value="pending" className="relative">
                        Pending Requests 
                        {pendingRequests.length > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-white border-2 border-background animate-pulse">{pendingRequests.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="list">Student List</TabsTrigger>
                </TabsList>

                <TabsContent value="add" className="pt-6">
                    <Card className="max-w-4xl mx-auto border-primary/20 shadow-lg">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="font-headline text-2xl">{editingUid ? 'Edit Student' : 'Add New Student'}</CardTitle>
                                    <CardDescription>Fill in the form to manage student accounts.</CardDescription>
                                </div>
                                {(editingUid || currentRequestId) && <Button variant="ghost" onClick={resetForm}><X className="mr-2 h-4 w-4"/> Cancel</Button>}
                            </div>
                        </CardHeader>
                        <form onSubmit={handleAction}>
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
                                                <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)}/></div>
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
                                                
                                                <div className="space-y-1">
                                                    <Label className="flex items-center gap-2 text-primary"><Wallet className="h-4 w-4"/> Installment Plan</Label>
                                                    <Select onValueChange={setPaymentPlanName} value={paymentPlanName}>
                                                        <SelectTrigger className="border-primary/20 bg-primary/5">
                                                            <SelectValue placeholder="Assign a payment plan..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Full Payment (No Plan)</SelectItem>
                                                            {allPaymentPlans.map(p => <SelectItem key={p.id} value={p.name}>{p.name} ({p.installments} Installments)</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="flex items-center gap-2 text-blue-700"><GraduationCap className="h-4 w-4"/> Assigned Scholarship (Optional)</Label>
                                                    <Select onValueChange={setScholarshipId} value={scholarshipId}>
                                                        <SelectTrigger className="border-blue-200 bg-blue-50/30">
                                                            <SelectValue placeholder="Select a scholarship to apply..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">No Scholarship</SelectItem>
                                                            {allScholarships.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.percentage}% Waiver)</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </CardContent>
                            <CardFooter className="justify-end"><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingUid ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}{editingUid ? 'Save' : 'Create'}</Button></CardFooter>
                        </form>
                    </Card>
                </TabsContent>

                <TabsContent value="pending" className="pt-6">
                    <Card className="max-w-4xl mx-auto shadow-md border-l-4 border-l-primary overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b pb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary rounded-lg shadow-md"><ClipboardList className="h-6 w-6 text-white" /></div>
                                <div><CardTitle className="font-headline text-2xl">Pending Finance Requests</CardTitle><CardDescription>Accounts requested by Finance after initial deposits.</CardDescription></div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {pendingRequests.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Applicant Name</TableHead><TableHead>Proposed ID</TableHead><TableHead>Deposit Paid</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {pendingRequests.map(req => (
                                            <TableRow key={req.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-bold">{req.tempName}</TableCell>
                                                <TableCell className="font-mono text-xs opacity-70 tracking-widest">{req.tempId}</TableCell>
                                                <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-black">ZMW {req.amountPaid.toFixed(2)}</Badge></TableCell>
                                                <TableCell className="text-right"><div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={() => { setLinkingRequest(req); setIsLinkDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" />Link Existing</Button><Button size="sm" onClick={() => handleProcessRequest(req)}><UserPlus className="mr-2 h-4 w-4" />Process New</Button></div></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (<div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5"><CheckCircle2 className="h-12 w-12 mx-auto opacity-10 mb-4" /><h3 className="text-lg font-bold">No Pending Requests</h3></div>)}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="list" className="pt-6">
                    <Card className="max-w-4xl mx-auto shadow-md">
                        <CardHeader>
                            <CardTitle>Registered Students</CardTitle>
                            <div className="relative pt-2"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search name or ID..." className="pl-8" value={listSearchTerm} onChange={(e) => setListSearchTerm(e.target.value)} /></div>
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
                                            <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => handleOpenEdit(student)}><Pencil className="h-4 w-4 mr-2" /> Edit</Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogContent className="max-w-md flex flex-col h-[80vh]">
                    <DialogHeader><DialogTitle>Link Deposit to Existing Student</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4 flex-1 flex flex-col min-h-0">
                        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search existing students..." className="pl-8" value={linkSearchTerm} onChange={e => setLinkSearchTerm(e.target.value)} /></div>
                        <ScrollArea className="flex-1 border rounded-md">
                            <div className="p-2 space-y-1">
                                {linkingStudentsFiltered.map(student => (
                                    <div key={student.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors border group">
                                        <div><p className="text-sm font-bold">{student.name}</p><p className="text-[10px] text-muted-foreground uppercase">{student.id}</p></div>
                                        <Button size="sm" variant="ghost" onClick={() => handleLinkToExisting(student.uid)} disabled={loading}>{loading ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-4 w-4 text-primary" />}</Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
