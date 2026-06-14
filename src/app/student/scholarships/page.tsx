'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, FileText, Download, CheckCircle2, AlertTriangle, PenSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, update } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function StudentScholarshipsPage() {
    const { user, userProfile: userData } = useAuth();
    const [scholarships, setScholarships] = React.useState<Scholarship[]>([]);
    const [myApplications, setMyApplications] = React.useState<ScholarshipApplication[]>([]);
    const [activeScholarship, setActiveScholarship] = React.useState<Scholarship | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);

    // Application Dialog State
    const [isApplyOpen, setIsApplyOpen] = React.useState(false);
    const [selectedSchol, setSelectedSchol] = React.useState<Scholarship | null>(null);
    const [nrcNumber, setNrcNumber] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [city, setCity] = React.useState('');
    const [phone, setPhone] = React.useState('');

    // Signing Dialog State
    const [isSignOpen, setIsSignOpen] = React.useState(false);
    const [selectedApp, setSelectedApp] = React.useState<ScholarshipApplication | null>(null);
    const [studentSignature, setStudentSignature] = React.useState('');
    const [agreementChecked, setAgreementChecked] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        if (!userData?.uid) return;

        const scholarshipsRef = ref(db, 'scholarships');
        const unsubSchol = onValue(scholarshipsRef, (snapshot) => {
            const list: Scholarship[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(id => {
                    list.push({ id, ...data[id] });
                });
            }
            setScholarships(list);
            
            // Check student's current active scholarship (linked to profile)
            const profile = userData as any;
            if (profile?.scholarshipId) {
                const active = list.find(s => s.id === profile.scholarshipId) || null;
                setActiveScholarship(active);
            } else {
                setActiveScholarship(null);
            }
        });

        const appsRef = ref(db, 'scholarshipApplications');
        const unsubApps = onValue(appsRef, (snapshot) => {
            const list: ScholarshipApplication[] = [];
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(id => {
                    if (data[id].userId === userData.uid) {
                        list.push({ id, ...data[id] });
                    }
                });
            }
            setMyApplications(list.sort((a,b) => b.submittedAt - a.submittedAt));
            setLoading(false);
        });

        return () => { unsubSchol(); unsubApps(); };
    }, [userData?.uid, (userData as any)?.scholarshipId]);

    const handleOpenApply = (schol: Scholarship) => {
        setSelectedSchol(schol);
        setNrcNumber('');
        setAddress('');
        setCity('');
        setPhone((userData as any)?.phone || '');
        setIsApplyOpen(true);
    };

    const handleApplySubmit = async () => {
        if (!userData?.uid || !selectedSchol) return;
        if (!nrcNumber || !address || !city || !phone) {
            toast({ variant: 'destructive', title: 'All application fields are required.' });
            return;
        }
        setSubmitting(true);
        try {
            const newAppRef = push(ref(db, 'scholarshipApplications'));
            await set(newAppRef, {
                scholarshipId: selectedSchol.id,
                scholarshipName: selectedSchol.name,
                userId: userData.uid,
                studentName: userData.name,
                studentEmail: userData.email,
                nrcNumber,
                address,
                city,
                phone,
                status: 'pending',
                submittedAt: Date.now()
            });
            toast({ title: 'Application Submitted', description: 'Institutional review pending.' });
            setIsApplyOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to apply', description: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenSign = (app: ScholarshipApplication) => {
        const schol = scholarships.find(s => s.id === app.scholarshipId) || null;
        setSelectedSchol(schol);
        setSelectedApp(app);
        setStudentSignature('');
        setAgreementChecked(false);
        setIsSignOpen(true);
    };

    const handleSignSubmit = async () => {
        if (!selectedApp || !selectedSchol || !userData?.uid) return;
        if (!studentSignature) {
            toast({ variant: 'destructive', title: 'Signature name is required.' });
            return;
        }
        if (!agreementChecked) {
            toast({ variant: 'destructive', title: 'You must confirm acceptance checkbox.' });
            return;
        }
        setSubmitting(true);
        try {
            const updates: Record<string, any> = {};
            // 1. Update application status to signed & save signature
            updates[`scholarshipApplications/${selectedApp.id}/status`] = 'signed';
            updates[`scholarshipApplications/${selectedApp.id}/studentSignature`] = studentSignature;
            updates[`scholarshipApplications/${selectedApp.id}/signedAt`] = Date.now();
            updates[`scholarshipApplications/${selectedApp.id}/updatedAt`] = Date.now();

            // 2. Link scholarship directly on student profile (automatically handles invoicing waiver)
            updates[`users/${userData.uid}/scholarshipId`] = selectedSchol.id;

            await update(ref(db), updates);
            toast({ title: 'Scholarship Acceptance Confirmed', description: 'Waiver automatically applied to invoices.' });
            setIsSignOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Confirmation failed', description: e.message });
        } finally {
            setSubmitting(false);
        }
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

    if (loading) return <Skeleton className="h-screen w-full" />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-gray-900">Scholarships & Institutional Support</h2>
                <p className="text-xs text-gray-500">Apply for online scholarship schemes and manage your acceptance letters.</p>
            </div>

            {activeScholarship && (
                <Card className="border-l-4 border-l-green-500 bg-green-50/20">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-bold text-green-900 flex items-center gap-2">
                            <CheckCircle2 className="h-4.5 w-4.5 text-green-600"/> Current Standing: Active Award Recipient
                        </CardTitle>
                        <CardDescription className="text-green-800">
                            You are currently receiving the <strong>{activeScholarship.name}</strong>, which applies a tuition waiver of <strong>{activeScholarship.percentage}%</strong>.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-gray-900">Available Support Programs</CardTitle>
                            <CardDescription>Listed below are the financial programs open for registration.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {scholarships.filter(s => s.isOpenForApplication).map(schol => {
                                    const applied = myApplications.find(a => a.scholarshipId === schol.id);
                                    const isDeadlinePassed = schol.applicationDeadline ? new Date(schol.applicationDeadline).getTime() < Date.now() : false;
                                    
                                    return (
                                        <div key={schol.id} className="border p-4 rounded-xl hover:shadow-sm transition-shadow space-y-3 bg-white">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900">{schol.name}</h3>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">Sponsor: {schol.donor || 'Silver Maple College'}</p>
                                                </div>
                                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-bold">{schol.percentage}% Waiver</Badge>
                                            </div>
                                            <p className="text-xs text-gray-600 leading-relaxed">{schol.description}</p>
                                            
                                            {schol.applicationDeadline && (
                                                <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    Deadline: {new Date(schol.applicationDeadline).toLocaleDateString()}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                                {schol.fileUrl ? (
                                                    <a href={schol.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                                                        <Download className="h-3.5 w-3.5"/> Download official terms PDF
                                                    </a>
                                                ) : <span/>}
                                                
                                                {applied ? (
                                                    <Badge variant="secondary">Applied</Badge>
                                                ) : activeScholarship ? (
                                                    <Badge variant="outline" className="text-muted-foreground italic">Award active</Badge>
                                                ) : isDeadlinePassed ? (
                                                    <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">Deadline Passed</Badge>
                                                ) : (
                                                    <Button size="sm" onClick={() => handleOpenApply(schol)}>Apply Online</Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {scholarships.filter(s => s.isOpenForApplication).length === 0 && (
                                    <p className="text-xs text-muted-foreground italic p-4 text-center">No active scholarship programs available for registration at this moment.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-gray-900">My Application Ledger</CardTitle>
                            <CardDescription>Track the review states of your submissions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {myApplications.map((app) => {
                                    const schol = scholarships.find(s => s.id === app.scholarshipId) || null;
                                    return (
                                        <div key={app.id} className="border p-3.5 rounded-lg bg-card space-y-2.5">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-[11px] text-gray-800 block truncate max-w-[150px]">{app.scholarshipName}</span>
                                                {app.status === 'pending' && <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">Pending</Badge>}
                                                {app.status === 'approved' && <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">Approved</Badge>}
                                                {app.status === 'signed' && <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Awarded</Badge>}
                                                {app.status === 'denied' && <Badge variant="destructive" className="text-[10px]">Denied</Badge>}
                                            </div>
                                            <span className="text-[10px] text-gray-400 block font-medium">Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>
                                            
                                            {app.status === 'approved' && (
                                                <Button size="sm" className="w-full text-xs font-bold gap-1 bg-green-600 hover:bg-green-700 text-white h-8" onClick={() => handleOpenSign(app)}>
                                                    <PenSquare className="h-3.5 w-3.5" /> Sign Acceptance Letter
                                                </Button>
                                            )}

                                            {app.status === 'signed' && (
                                                <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => generateLetterPdf(app, schol)}>
                                                    <Download className="h-3.5 w-3.5 mr-1" /> Print Acceptance PDF
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                                {myApplications.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic text-center py-4">No applications logged.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Application Dialog */}
            <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apply for {selectedSchol?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="p-3 border rounded-xl bg-blue-50/30 text-blue-800 text-[11px] leading-relaxed font-medium">
                            Applying for this program covers tuition support. Please ensure all details below match your official admission credentials.
                        </div>
                        <div className="space-y-1">
                            <Label>National Registration Card (NRC)</Label>
                            <Input value={nrcNumber} onChange={e => setNrcNumber(e.target.value)} placeholder="e.g. 111111/11/1" />
                        </div>
                        <div className="space-y-1">
                            <Label>Residential Address</Label>
                            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Plot 123 Street" />
                        </div>
                        <div className="space-y-1">
                            <Label>City</Label>
                            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Luanshya" />
                        </div>
                        <div className="space-y-1">
                            <Label>Contact Phone Number</Label>
                            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0976101560" />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleApplySubmit} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit Application
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Acceptance Letter Signing Dialog */}
            <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col p-6">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-6 w-6"/>Acceptance Letter Signing Workspace</DialogTitle>
                    </DialogHeader>
                    {selectedApp && (
                        <div className="flex-1 py-6 space-y-6">
                            <div className="bg-white p-8 border rounded-lg shadow-sm text-xs text-gray-800 leading-relaxed font-sans">
                                <div className="flex flex-col items-center text-center border-b pb-4">
                                    <p className="font-bold text-[10px] text-gray-500">Plot 1375 Independence Street, H. Figov Building</p>
                                    <p className="font-bold text-[10px] text-gray-500">P O BOX 90413, LUANSHYA | Contacts: 0976 101560 / 0966 818849</p>
                                    <p className="font-bold text-[10px] text-gray-500">Email: admissions@silvermaplecollege.eduzm</p>
                                    <h3 className="font-extrabold text-sm text-gray-900 mt-2 tracking-wide uppercase">SILVER MAPLE COLLEGE OF EDUCATION AND HEALTH SCIENCES</h3>
                                </div>
                                
                                <h4 className="text-center font-extrabold text-sm uppercase underline mt-4">Scholarship Acceptance Letter</h4>
                                
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 py-3 border-b mt-4">
                                    <p><strong>Name:</strong> {selectedApp.studentName}</p>
                                    <p><strong>NRC Number:</strong> {selectedApp.nrcNumber}</p>
                                    <p><strong>Address:</strong> {selectedApp.address}</p>
                                    <p><strong>City:</strong> {selectedApp.city}</p>
                                    <p><strong>Phone Number:</strong> {selectedApp.phone}</p>
                                </div>

                                <div className="space-y-4 mt-4">
                                    <p>Dear <strong>{selectedApp.studentName}</strong>,</p>
                                    <p>
                                        We are pleased to inform you that you have been awarded the <strong>{selectedApp.scholarshipName}</strong> to support your studies at Silver Maple College of Education and Health Sciences in <strong>{selectedSchol?.programmeName || 'Diploma in Registered Nursing'}</strong>. This scholarship covers Tuition, Examinations, and Field Trips for the academic year <strong>{selectedSchol?.academicYear || '2026'}</strong>. This scholarship is renewable every semester.
                                    </p>
                                    <p>
                                        The Opening and Registration date for July Intake is on the <strong>8th July, 2026</strong>. Therefore, on this date you are required to report for school.
                                    </p>
                                    <p>
                                        The total payable amount for the first semester, after the scholarship has been applied, is <strong>{selectedSchol?.payableAmountPostScholarship || '6,000.00'} ZMW</strong>. To accept this scholarship, you are required to adhere to the following payment plan:
                                    </p>
                                </div>

                                <div className="space-y-2 mt-4">
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
                                                <TableCell>Due by {selectedSchol?.firstInstallmentDueDate || '30th June, 2026'}</TableCell>
                                                <TableCell className="text-right font-semibold">{selectedSchol?.firstInstallmentAmount?.toFixed(2) || '3,000.00'} ZMW</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Final Installment (50%)</TableCell>
                                                <TableCell>Due by {selectedSchol?.finalInstallmentDueDate || '30th July, 2026'}</TableCell>
                                                <TableCell className="text-right font-semibold">{selectedSchol?.finalInstallmentAmount?.toFixed(2) || '3,000.00'} ZMW</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <p className="text-[10px] text-gray-500 italic">Nmcz indexing and manual fees are done online as the portal opens in July.</p>
                                </div>

                                <div className="space-y-2 mt-4">
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
                                                <TableCell>{selectedSchol?.bankName || 'Zambia National Building Society'}</TableCell>
                                                <TableCell>{selectedSchol?.bankAccountName || 'Silver Maple college of education & health sciences(LUANSHYA BRANCH)'}</TableCell>
                                                <TableCell className="font-mono">{selectedSchol?.bankAccountNumber || '0671655833201'}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                    <p className="text-[10px] font-bold text-red-700 uppercase">NOTE: All fees must be paid through the bank account. No cash payment will be allowed.</p>
                                </div>

                                <p className="text-gray-600 mt-4">
                                    Failure to adhere to the payment plan may result in revocation of the scholarship. By signing this letter, you confirm your acceptance of the scholarship and commitment to fulfilling the required payment plan.
                                </p>
                            </div>

                            <div className="p-4 border rounded-xl bg-orange-50 border-orange-200/60 space-y-4">
                                <h5 className="font-bold text-orange-950 text-xs flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-orange-600"/> Acceptance Confirmation & Signature</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-orange-900">Type Your Full Name to Sign Acceptance</Label>
                                        <Input 
                                            value={studentSignature} 
                                            onChange={e => setStudentSignature(e.target.value)} 
                                            placeholder="e.g. Gerald Phiri"
                                            className="border-orange-300 font-serif italic text-sm" 
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-6">
                                        <Checkbox 
                                            id="agree" 
                                            checked={agreementChecked} 
                                            onCheckedChange={checked => setAgreementChecked(!!checked)} 
                                        />
                                        <Label htmlFor="agree" className="text-xs text-orange-950 cursor-pointer">
                                            I verify and confirm my commitment to the payment plan.
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" className="mr-2" onClick={() => setIsSignOpen(false)}>Cancel</Button>
                        <Button 
                            onClick={handleSignSubmit} 
                            disabled={submitting || !studentSignature || !agreementChecked} 
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Accept & Sign Scholarship
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
