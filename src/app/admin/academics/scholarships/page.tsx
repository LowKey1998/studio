'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Trash2, Calendar, FileUp, Download, CheckCircle2, XCircle, Info, Landmark, GraduationCap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Scholarship = {
    id: string;
    name: string;
    description: string;
    donor?: string;
    percentage: number;
    semesterIds?: Record<string, boolean>;
    
    // Application settings
    isOpenForApplication?: boolean;
    applicationDeadline?: string;
    programmeName?: string;
    academicYear?: string;
    payableAmountPostScholarship?: number;
    firstInstallmentAmount?: number;
    firstInstallmentDueDate?: string;
    finalInstallmentAmount?: number;
    finalInstallmentDueDate?: string;
    bankName?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    otherRequirements?: string;
    fileUrl?: string;
    fileName?: string;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
};

type ScholarshipApplication = {
    id: string;
    scholarshipId: string;
    scholarshipName: string;
    userId: string;
    studentName: string;
    studentEmail: string;
    nrcNumber: string;
    address: string;
    city: string;
    phone: string;
    status: 'pending' | 'approved' | 'denied' | 'signed';
    submittedAt: number;
    updatedAt?: number;
    signedAt?: number;
    studentSignature?: string;
};

export default function ScholarshipManagementPage() {
    const [scholarships, setScholarships] = React.useState<Scholarship[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [applications, setApplications] = React.useState<ScholarshipApplication[]>([]);
    
    const [activeTab, setActiveTab] = React.useState<'programs' | 'applications'>('programs');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingScholarship, setEditingScholarship] = React.useState<Scholarship | null>(null);
    
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [donor, setDonor] = React.useState('');
    const [percentage, setPercentage] = React.useState(50);

    // Application details
    const [isOpenForApplication, setIsOpenForApplication] = React.useState(false);
    const [applicationDeadline, setApplicationDeadline] = React.useState('');
    const [programmeName, setProgrammeName] = React.useState('');
    const [academicYear, setAcademicYear] = React.useState('');
    const [payableAmountPostScholarship, setPayableAmountPostScholarship] = React.useState(6000);
    const [firstInstallmentAmount, setFirstInstallmentAmount] = React.useState(3000);
    const [firstInstallmentDueDate, setFirstInstallmentDueDate] = React.useState('');
    const [finalInstallmentAmount, setFinalInstallmentAmount] = React.useState(3000);
    const [finalInstallmentDueDate, setFinalInstallmentDueDate] = React.useState('');
    const [bankName, setBankName] = React.useState('');
    const [bankAccountName, setBankAccountName] = React.useState('');
    const [bankAccountNumber, setBankAccountNumber] = React.useState('');
    const [otherRequirements, setOtherRequirements] = React.useState('');
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    
    // Assign Dialog state
    const [isAssignDialogOpen, setIsAssignDialogOpen] = React.useState(false);
    const [selectedSemesters, setSelectedSemesters] = React.useState<Record<string, boolean>>({});

    // View Letter Dialog
    const [isLetterOpen, setIsLetterOpen] = React.useState(false);
    const [selectedApp, setSelectedApp] = React.useState<ScholarshipApplication | null>(null);
    const [associatedSchol, setAssociatedSchol] = React.useState<Scholarship | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const scholarshipsRef = ref(db, 'scholarships');
        const unsubSchol = onValue(scholarshipsRef, (snapshot) => {
            if (snapshot.exists()) {
                setScholarships(Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })));
            } else {
                setScholarships([]);
                // Seed the Chief Machiya Scholarship preset
                const newRef = push(ref(db, 'scholarships'));
                set(newRef, {
                    name: "Chief Machiya Scholarship",
                    description: "Supports Diploma in Registered Nursing studies. Covers Tuition, Examinations, and Field Trips for the academic year 2026. Renewable every semester.",
                    donor: "Chief Machiya Foundation",
                    percentage: 50,
                    isOpenForApplication: true,
                    applicationDeadline: "2026-06-25",
                    programmeName: "Diploma in Registered Nursing",
                    academicYear: "2026",
                    payableAmountPostScholarship: 6000.00,
                    firstInstallmentAmount: 3000.00,
                    firstInstallmentDueDate: "2026-06-30",
                    finalInstallmentAmount: 3000.00,
                    finalInstallmentDueDate: "2026-07-30",
                    bankName: "Zambia National Building Society",
                    bankAccountName: "Silver Maple college of education & health sciences(LUANSHYA BRANCH)",
                    bankAccountNumber: "0671655833201",
                    otherRequirements: `Personal Documents:\n- National Registration Card (NRC) (Copy & Original)\n- Certified copies of Grade 12 results and academic certificates\n- Admission Letter from Silver Maple College\n- Scholarship Acceptance Letter (Signed)\n\nAcademic and Study Materials:\n- Not less than 10 notebooks\n- A scientific calculator\n- Laptop (recommended)\n\nOfficial Attire & Health:\n- Black or brown laced shoes\n- Navy blue or black cardigan\n- Stethoscope & Clinical thermometer\n- Theatre scrubs (Navy blue) & Theatre shoes (White)\n- Insecticide-Treated Mosquito Net\n\nCollege Requirements:\n- NHIMA proof of registration\n- 2 reams of A4 bond paper\n- 2 boxes of examination gloves, 1 box of sterile gloves\n- 2 bottles of 750ml Jik, 1 hand wash (500ml liquid soap)\n\nAccommodation Essentials:\n- Bed sheets, blankets, and pillows\n- Toiletries & personal hygiene items\n- Lockable suitcase\n- Rechargeable lamp/torch`
                });
            }
            setLoading(false);
        });
        
        const semestersRef = ref(db, 'semesters');
        const unsubSem = onValue(semestersRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSemesters(Object.keys(data).map(id => ({ id, ...data[id] })).filter(s => s.status !== 'Archived'));
            } else {
                setSemesters([]);
            }
        });

        const appsRef = ref(db, 'scholarshipApplications');
        const unsubApps = onValue(appsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setApplications(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.submittedAt - a.submittedAt));
            } else {
                setApplications([]);
            }
        });
        
        return () => { unsubSchol(); unsubSem(); unsubApps(); };
    }, []);
    
    const resetForm = () => {
        setName('');
        setDescription('');
        setDonor('');
        setPercentage(50);
        setEditingScholarship(null);

        setIsOpenForApplication(false);
        setApplicationDeadline('');
        setProgrammeName('');
        setAcademicYear('');
        setPayableAmountPostScholarship(6000);
        setFirstInstallmentAmount(3000);
        setFirstInstallmentDueDate('');
        setFinalInstallmentAmount(3000);
        setFinalInstallmentDueDate('');
        setBankName('');
        setBankAccountName('');
        setBankAccountNumber('');
        setOtherRequirements('');
        setSelectedFile(null);
    };

    const openDialog = (scholarship: Scholarship | null) => {
        if (scholarship) {
            setEditingScholarship(scholarship);
            setName(scholarship.name);
            setDescription(scholarship.description);
            setDonor(scholarship.donor || '');
            setPercentage(scholarship.percentage || 50);

            setIsOpenForApplication(!!scholarship.isOpenForApplication);
            setApplicationDeadline(scholarship.applicationDeadline || '');
            setProgrammeName(scholarship.programmeName || '');
            setAcademicYear(scholarship.academicYear || '');
            setPayableAmountPostScholarship(scholarship.payableAmountPostScholarship || 6000);
            setFirstInstallmentAmount(scholarship.firstInstallmentAmount || 3000);
            setFirstInstallmentDueDate(scholarship.firstInstallmentDueDate || '');
            setFinalInstallmentAmount(scholarship.finalInstallmentAmount || 3000);
            setFinalInstallmentDueDate(scholarship.finalInstallmentDueDate || '');
            setBankName(scholarship.bankName || '');
            setBankAccountName(scholarship.bankAccountName || '');
            setBankAccountNumber(scholarship.bankAccountNumber || '');
            setOtherRequirements(scholarship.otherRequirements || '');
            setSelectedFile(null);
        } else {
            resetForm();
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!name || !percentage) {
            toast({ variant: 'destructive', title: 'Name and waiver percentage are required' });
            return;
        }
        setSaving(true);
        try {
            let fileUrl = editingScholarship?.fileUrl || '';
            let fileName = editingScholarship?.fileName || '';
            
            if (selectedFile) {
                const storagePath = `scholarships/${Date.now()}_${selectedFile.name}`;
                const fileRef = storageRef(storage, storagePath);
                const snapshot = await uploadBytes(fileRef, selectedFile);
                fileUrl = await getDownloadURL(snapshot.ref);
                fileName = selectedFile.name;
            }

            const data = { 
                name, 
                description, 
                donor, 
                percentage, 
                semesterIds: editingScholarship?.semesterIds || {},
                isOpenForApplication,
                applicationDeadline,
                programmeName,
                academicYear,
                payableAmountPostScholarship,
                firstInstallmentAmount,
                firstInstallmentDueDate,
                finalInstallmentAmount,
                finalInstallmentDueDate,
                bankName,
                bankAccountName,
                bankAccountNumber,
                otherRequirements,
                fileUrl,
                fileName
            };

            if (editingScholarship) {
                await set(ref(db, `scholarships/${editingScholarship.id}`), data);
                toast({ title: 'Scholarship Updated' });
            } else {
                await push(ref(db, 'scholarships'), data);
                toast({ title: 'Scholarship Created' });
            }
            setIsDialogOpen(false);
            resetForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save', description: e.message });
        } finally {
            setSaving(false);
        }
    };
    
    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This will remove the scholarship program.")) return;
        await remove(ref(db, `scholarships/${id}`));
        toast({ title: 'Scholarship Deleted' });
    };
    
    const openAssignDialog = (scholarship: Scholarship) => {
        setEditingScholarship(scholarship);
        setSelectedSemesters(scholarship.semesterIds || {});
        setIsAssignDialogOpen(true);
    };
    
    const handleSemesterSelection = (semesterId: string) => {
        setSelectedSemesters(prev => {
            const newSelection = { ...prev };
            if (newSelection[semesterId]) delete newSelection[semesterId];
            else newSelection[semesterId] = true;
            return newSelection;
        });
    };

    const handleAssignToSemesters = async () => {
        if (!editingScholarship) return;
        setSaving(true);
        try {
            await update(ref(db, `scholarships/${editingScholarship.id}`), { semesterIds: selectedSemesters });
            toast({ title: 'Availability Updated' });
            setIsAssignDialogOpen(false);
        } catch(e: any) {
            toast({variant: 'destructive', title: 'Update failed'});
        } finally {
            setSaving(false);
        }
    };

    const handleApproveApp = async (app: ScholarshipApplication) => {
        if (!window.confirm(`Are you sure you want to approve ${app.studentName}'s application?`)) return;
        try {
            await update(ref(db, `scholarshipApplications/${app.id}`), {
                status: 'approved',
                updatedAt: Date.now()
            });
            toast({ title: "Application Approved", description: "Awaiting student signature acceptance." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Approval Failed", description: e.message });
        }
    };

    const handleRejectApp = async (app: ScholarshipApplication) => {
        if (!window.confirm(`Are you sure you want to reject ${app.studentName}'s application?`)) return;
        try {
            await update(ref(db, `scholarshipApplications/${app.id}`), {
                status: 'denied',
                updatedAt: Date.now()
            });
            toast({ title: "Application Denied" });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Rejection Failed", description: e.message });
        }
    };

    const openLetterView = (app: ScholarshipApplication) => {
        const schol = scholarships.find(s => s.id === app.scholarshipId) || null;
        setAssociatedSchol(schol);
        setSelectedApp(app);
        setIsLetterOpen(true);
    };

    const generateLetterPdf = (app: ScholarshipApplication, schol: Scholarship | null) => {
        const doc = new jsPDF();
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Plot 1375 Independence Street, H. Figov Building', 14, 15);
        doc.text('P O BOX 90413, LUANSHYA | Contacts: 0976 101560/0966 818849', 14, 20);
        doc.text('Email: admissions@silvermaplecollege.eduzm', 14, 25);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SILVER MAPLE COLLEGE OF EDUCATION AND HEALTH SCIENCES', 14, 32);
        doc.setLineWidth(0.5);
        doc.line(14, 35, 196, 35);
        
        doc.setFontSize(14);
        doc.text('Scholarship Acceptance Letter', 105, 45, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Name: ${app.studentName}`, 14, 55);
        doc.text(`NRC Number: ${app.nrcNumber}`, 14, 60);
        doc.text(`Address: ${app.address}`, 14, 65);
        doc.text(`City: ${app.city}`, 105, 65);
        doc.text(`Phone Number: ${app.phone}`, 14, 70);
        
        const text = `We are pleased to inform you that you have been awarded the ${app.scholarshipName} to support your studies at Silver Maple College of Education and Health Sciences in ${schol?.programmeName || 'Diploma in Registered Nursing'}. This scholarship covers Tuition, Examinations, and Field Trips for the academic year ${schol?.academicYear || '2026'}. This scholarship is renewable every semester.

The Opening and Registration date for July Intake is on the 8th July, 2026. Therefore, on this date you are required to report for school.

The total payable amount for the first semester, after the scholarship has been applied, is ${schol?.payableAmountPostScholarship || '6,000.00'} ZMW. To accept this scholarship, you are required to adhere to the following payment plan:`;
        
        const splitText = doc.splitTextToSize(text, 182);
        doc.text(splitText, 14, 80);
        
        let startY = 80 + (splitText.length * 5) + 5;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Payment Plan', 14, startY);
        
        autoTable(doc, {
            startY: startY + 2,
            head: [['Installment', 'Due Date', 'Amount (ZMW)']],
            body: [
                ['First Installment (50%)', `Due by ${schol?.firstInstallmentDueDate || '30th June, 2026'}`, `${schol?.firstInstallmentAmount || '3,000.00'} ZMW`],
                ['Final Installment (50%)', `Due by ${schol?.finalInstallmentDueDate || '30th July, 2026'}`, `${schol?.finalInstallmentAmount || '3,000.00'} ZMW`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [0, 51, 102] }
        });
        
        startY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont('helvetica', 'normal');
        doc.text('Nmcz indexing and manual fees are done online as the portal opens in July.', 14, startY);
        
        startY += 8;
        doc.setFont('helvetica', 'bold');
        doc.text('NOTE: All fees must be paid through the bank account: No cash payment will be allowed', 14, startY);
        
        autoTable(doc, {
            startY: startY + 2,
            head: [['Bank Name', 'Account Name', 'Account Number']],
            body: [[
                schol?.bankName || 'Zambia National Building Society',
                schol?.bankAccountName || 'Silver Maple college of education & health sciences(LUANSHYA BRANCH)',
                schol?.bankAccountNumber || '0671655833201'
            ]],
            theme: 'grid',
            headStyles: { fillColor: [51, 51, 51] }
        });
        
        startY = (doc as any).lastAutoTable.finalY + 8;
        doc.setFont('helvetica', 'normal');
        const warning = `Failure to adhere to the payment plan may result in revocation of the scholarship. By signing this letter, you confirm your acceptance of the scholarship and commitment to fulfilling the required payment plan.`;
        const splitWarn = doc.splitTextToSize(warning, 182);
        doc.text(splitWarn, 14, startY);
        
        startY += (splitWarn.length * 5) + 10;
        doc.text(`Student Name: ${app.studentName}`, 14, startY);
        doc.text(`Signature: ${app.studentSignature || 'Awaiting Signature'}`, 80, startY);
        doc.text(`Date: ${app.signedAt ? new Date(app.signedAt).toLocaleDateString() : 'Pending'}`, 150, startY);
        
        startY += 12;
        doc.text('Approved by:', 14, startY);
        doc.text('Registrar (Academics)', 14, startY + 5);
        doc.text('Silver Maple College of Education and Health Sciences', 14, startY + 10);
        doc.text('Signature: _______________________', 110, startY + 5);
        doc.text('Date: ________________', 110, startY + 10);
        
        doc.save(`Scholarship_Acceptance_${app.studentName.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex bg-gray-100 rounded-lg p-1 max-w-sm">
                <button 
                    onClick={() => setActiveTab('programs')} 
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'programs' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    Scholarship Programs
                </button>
                <button 
                    onClick={() => setActiveTab('applications')} 
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'applications' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    Applications Audit
                    {applications.filter(a => a.status === 'pending').length > 0 && (
                        <Badge className="ml-1.5 bg-red-500 hover:bg-red-600 text-[9px] px-1 h-3">{applications.filter(a => a.status === 'pending').length}</Badge>
                    )}
                </button>
            </div>

            {activeTab === 'programs' && (
                <Card>
                    <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Scholarship Management</CardTitle>
                            <CardDescription>Configure scholarship awards with tuition waiver settings and open online application processes.</CardDescription>
                        </div>
                        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open);}}>
                            <DialogTrigger asChild><Button onClick={() => openDialog(null)}><PlusCircle className="mr-2 h-4 w-4"/>New Scholarship</Button></DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>{editingScholarship ? 'Edit' : 'Create'} Scholarship Program</DialogTitle></DialogHeader>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                                    <div className="space-y-1"><Label>Program Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chief Machiya Scholarship" /></div>
                                    <div className="space-y-1">
                                        <Label>Tuition Waiver Percentage</Label>
                                        <div className="relative">
                                            <Input type="number" min="1" max="100" value={percentage} onChange={e => setPercentage(Number(e.target.value))} className="pr-8"/>
                                            <span className="absolute right-3 top-2.5 text-xs font-bold text-muted-foreground">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1"><Label>Donor / Sponsor (Optional)</Label><Input value={donor} onChange={e => setDonor(e.target.value)} placeholder="e.g. Chief Machiya Foundation" /></div>
                                    <div className="space-y-1"><Label>Academic Year</Label><Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="e.g. 2026" /></div>
                                    
                                    <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Summary of eligibility or terms" /></div>
                                    
                                    <div className="border-t pt-4 md:col-span-2 space-y-4">
                                        <h4 className="text-xs font-bold uppercase text-primary tracking-wider flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5"/>Online Application Setup</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex items-center gap-2 py-2">
                                                <Checkbox id="isOpen" checked={isOpenForApplication} onCheckedChange={checked => setIsOpenForApplication(!!checked)} />
                                                <Label htmlFor="isOpen">Allow students to apply online</Label>
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Application Deadline</Label>
                                                <Input type="date" value={applicationDeadline} onChange={e => setApplicationDeadline(e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Target Programme</Label>
                                                <Input value={programmeName} onChange={e => setProgrammeName(e.target.value)} placeholder="e.g. Diploma in Registered Nursing" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label>Uploaded Guideline/Acceptance PDF Template</Label>
                                                <Input type="file" accept=".pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                                                {editingScholarship?.fileName && (
                                                    <p className="text-[10px] text-muted-foreground italic mt-1">Current File: {editingScholarship.fileName}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4 md:col-span-2 space-y-4">
                                        <h4 className="text-xs font-bold uppercase text-primary tracking-wider flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5"/>Invoicing & Bank Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1"><Label>Payable Amount Post-Scholarship (ZMW)</Label><Input type="number" value={payableAmountPostScholarship} onChange={e => setPayableAmountPostScholarship(Number(e.target.value))} /></div>
                                            <div className="space-y-1"><Label>First Installment Amount (ZMW)</Label><Input type="number" value={firstInstallmentAmount} onChange={e => setFirstInstallmentAmount(Number(e.target.value))} /></div>
                                            <div className="space-y-1"><Label>First Installment Due Date</Label><Input type="date" value={firstInstallmentDueDate} onChange={e => setFirstInstallmentDueDate(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Final Installment Amount (ZMW)</Label><Input type="number" value={finalInstallmentAmount} onChange={e => setFinalInstallmentAmount(Number(e.target.value))} /></div>
                                            <div className="space-y-1"><Label>Final Installment Due Date</Label><Input type="date" value={finalInstallmentDueDate} onChange={e => setFinalInstallmentDueDate(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Bank Name</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Zambia National Building Society" /></div>
                                            <div className="space-y-1 md:col-span-2"><Label>Account Name</Label><Input value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="Silver Maple college of education..." /></div>
                                            <div className="space-y-1"><Label>Account Number</Label><Input value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} placeholder="0671655833201" /></div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4 md:col-span-2 space-y-1">
                                        <Label>Other Requirements (Checklist details to print on Letter)</Label>
                                        <Textarea rows={5} value={otherRequirements} onChange={e => setOtherRequirements(e.target.value)} placeholder="Certified Grade 12 results, scrubs, bedsheets, rechargeable lamp..." />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                    <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 animate-spin"/>}Save Program</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Name</TableHead>
                                    <TableHead>Waiver</TableHead>
                                    <TableHead>Donor</TableHead>
                                    <TableHead>Portal App</TableHead>
                                    <TableHead>Attached PDF</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-24"/></TableCell></TableRow> :
                                 scholarships.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-semibold">{s.name}</TableCell>
                                        <TableCell className="font-bold text-blue-700">{s.percentage}%</TableCell>
                                        <TableCell>{s.donor || '-'}</TableCell>
                                        <TableCell>
                                            {s.isOpenForApplication ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-300">Open (Deadline: {s.applicationDeadline || 'None'})</Badge>
                                            ) : (
                                                <Badge variant="secondary">Closed</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {s.fileUrl ? (
                                                <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                                                    <Download className="h-3 w-3" /> Download
                                                </a>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground italic">None uploaded</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => openAssignDialog(s)} className="mr-2">Assign Semesters</Button>
                                            <Button variant="ghost" size="sm" onClick={() => openDialog(s)}>Edit</Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </TableCell>
                                    </TableRow>
                                 ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'applications' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Scholarship Applications Audit</CardTitle>
                        <CardDescription>Verify student details and approve applications to link fee waivers automatically.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Student</TableHead>
                                    <TableHead>Award Applied For</TableHead>
                                    <TableHead>NRC Number</TableHead>
                                    <TableHead>Submission Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {applications.map((app) => (
                                    <TableRow key={app.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{app.studentName}</span>
                                                <span className="text-[10px] text-muted-foreground">{app.studentEmail} | {app.phone}</span>
                                                <span className="text-[10px] text-muted-foreground italic">{app.address}, {app.city}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-blue-700">{app.scholarshipName}</TableCell>
                                        <TableCell className="font-mono text-xs">{app.nrcNumber}</TableCell>
                                        <TableCell className="text-xs">{new Date(app.submittedAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {app.status === 'pending' && <Badge className="bg-orange-100 text-orange-800 border-orange-300">Awaiting Approval</Badge>}
                                            {app.status === 'approved' && <Badge className="bg-blue-100 text-blue-800 border-blue-300">Approved, Awaiting Sign</Badge>}
                                            {app.status === 'signed' && <Badge className="bg-green-100 text-green-800 border-green-300">Awarded & Signed</Badge>}
                                            {app.status === 'denied' && <Badge variant="destructive">Denied</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {app.status === 'pending' && (
                                                    <>
                                                        <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50 h-8" onClick={() => handleApproveApp(app)}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/>Approve</Button>
                                                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-red-50 h-8" onClick={() => handleRejectApp(app)}><XCircle className="mr-1.5 h-3.5 w-3.5"/>Reject</Button>
                                                    </>
                                                )}
                                                {(app.status === 'approved' || app.status === 'signed') && (
                                                    <Button size="sm" variant="outline" className="h-8" onClick={() => openLetterView(app)}><GraduationCap className="mr-1.5 h-3.5 w-3.5"/>View Acceptance Letter</Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {applications.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground italic">No applications submitted yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Letter View Dialog */}
            <Dialog open={isLetterOpen} onOpenChange={setIsLetterOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col p-6">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary"/>Official Scholarship Acceptance Letter</DialogTitle>
                    </DialogHeader>
                    {selectedApp && (
                        <div className="flex-1 py-6 space-y-6 text-xs text-gray-800 leading-relaxed font-sans max-w-3xl mx-auto bg-white p-8 border rounded-lg shadow-inner">
                            <div className="flex flex-col items-center text-center border-b pb-4">
                                <p className="font-bold text-[10px] text-gray-500">Plot 1375 Independence Street, H. Figov Building</p>
                                <p className="font-bold text-[10px] text-gray-500">P O BOX 90413, LUANSHYA | Contacts: 0976 101560 / 0966 818849</p>
                                <p className="font-bold text-[10px] text-gray-500">Email: admissions@silvermaplecollege.eduzm</p>
                                <h3 className="font-extrabold text-sm text-gray-900 mt-2 tracking-wide uppercase">SILVER MAPLE COLLEGE OF EDUCATION AND HEALTH SCIENCES</h3>
                            </div>
                            
                            <h4 className="text-center font-extrabold text-sm uppercase underline">Scholarship Acceptance Letter</h4>
                            
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 py-2 border-b">
                                <p><strong>Student Name:</strong> {selectedApp.studentName}</p>
                                <p><strong>NRC Number:</strong> {selectedApp.nrcNumber}</p>
                                <p><strong>Address:</strong> {selectedApp.address}</p>
                                <p><strong>City:</strong> {selectedApp.city}</p>
                                <p><strong>Phone Number:</strong> {selectedApp.phone}</p>
                            </div>

                            <div className="space-y-4">
                                <p>Dear <strong>{selectedApp.studentName}</strong>,</p>
                                <p>
                                    We are pleased to inform you that you have been awarded the <strong>{selectedApp.scholarshipName}</strong> to support your studies at Silver Maple College of Education and Health Sciences in <strong>{associatedSchol?.programmeName || 'Diploma in Registered Nursing'}</strong>. This scholarship covers Tuition, Examinations, and Field Trips for the academic year <strong>{associatedSchol?.academicYear || '2026'}</strong>. This scholarship is renewable every semester.
                                </p>
                                <p>
                                    The Opening and Registration date for July Intake is on the <strong>8th July, 2026</strong>. Therefore, on this date you are required to report for school.
                                </p>
                                <p>
                                    The total payable amount for the first semester, after the scholarship has been applied, is <strong>{associatedSchol?.payableAmountPostScholarship || '6,000.00'} ZMW</strong>. To accept this scholarship, you are required to adhere to the following payment plan:
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="font-bold uppercase text-[10px] text-primary">Payment Plan</p>
                                <Table className="border">
                                    <TableHeader>
                                        <TableRow className="bg-gray-50">
                                            <TableHead className="font-bold">Installment</TableHead>
                                            <TableHead className="font-bold">Due Date</TableHead>
                                            <TableHead className="font-bold text-right">Amount (ZMW)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>First Installment (50%)</TableCell>
                                            <TableCell>Due by {associatedSchol?.firstInstallmentDueDate || '30th June, 2026'}</TableCell>
                                            <TableCell className="text-right font-semibold">{associatedSchol?.firstInstallmentAmount?.toFixed(2) || '3,000.00'} ZMW</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Final Installment (50%)</TableCell>
                                            <TableCell>Due by {associatedSchol?.finalInstallmentDueDate || '30th July, 2026'}</TableCell>
                                            <TableCell className="text-right font-semibold">{associatedSchol?.finalInstallmentAmount?.toFixed(2) || '3,000.00'} ZMW</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <p className="text-[10px] text-gray-500 italic">Nmcz indexing and manual fees are done online as the portal opens in July.</p>
                            </div>

                            <div className="space-y-2">
                                <p className="font-bold uppercase text-[10px] text-red-600">Bank Details & Policies</p>
                                <Table className="border">
                                    <TableHeader>
                                        <TableRow className="bg-gray-50">
                                            <TableHead className="font-bold">Bank Name</TableHead>
                                            <TableHead className="font-bold">Account Name</TableHead>
                                            <TableHead className="font-bold">Account Number</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>{associatedSchol?.bankName || 'Zambia National Building Society'}</TableCell>
                                            <TableCell>{associatedSchol?.bankAccountName || 'Silver Maple college of education & health sciences(LUANSHYA BRANCH)'}</TableCell>
                                            <TableCell className="font-mono">{associatedSchol?.bankAccountNumber || '0671655833201'}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <p className="text-[10px] font-bold text-red-700 uppercase">NOTE: All fees must be paid through the bank account. No cash payment will be allowed.</p>
                            </div>

                            <p className="text-gray-600">
                                Failure to adhere to the payment plan may result in revocation of the scholarship. By signing this letter, you confirm your acceptance of the scholarship and commitment to fulfilling the required payment plan.
                            </p>

                            <div className="grid grid-cols-3 gap-4 border-t pt-4 font-semibold">
                                <div><p>Student Signature:</p><p className="font-serif italic text-blue-700 text-sm mt-1">{selectedApp.studentSignature || 'Awaiting signature...'}</p></div>
                                <div><p>Date Signed:</p><p className="mt-1">{selectedApp.signedAt ? new Date(selectedApp.signedAt).toLocaleDateString() : 'Awaiting sign...'}</p></div>
                                <div><p>Clearance Status:</p><Badge className="mt-1 bg-green-600">{selectedApp.status === 'signed' ? 'Acceptance Confirmed' : 'Approved, Pending Student Sign'}</Badge></div>
                            </div>

                            <div className="border-t pt-4">
                                <p className="font-bold">Approved by:</p>
                                <p>Registrar (Academics)</p>
                                <p>Silver Maple College of Education and Health Sciences</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="border-t pt-4 mt-auto">
                        <Button variant="outline" className="mr-2" onClick={() => selectedApp && generateLetterPdf(selectedApp, associatedSchol)}><Download className="mr-2 h-4 w-4"/>Download signed PDF</Button>
                        <Button variant="secondary" onClick={() => setIsLetterOpen(false)}>Close Acceptance View</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Assign "{editingScholarship?.name}" to Semesters</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-4 max-h-80 overflow-y-auto">
                        {semesters.map(semester => (
                            <div key={semester.id} className="flex items-center gap-2 p-2 border rounded-md">
                                <Checkbox id={semester.id} checked={!!selectedSemesters[semester.id]} onCheckedChange={() => handleSemesterSelection(semester.id)} />
                                <Label htmlFor={semester.id}>{semester.name}</Label>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignToSemesters} disabled={saving}>{saving && <Loader2 className="mr-2 animate-spin"/>}Save Assignments</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
