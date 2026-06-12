'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    GraduationCap, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    Loader2, 
    Download, 
    Library, 
    DollarSign, 
    Building, 
    FileText, 
    ShieldCheck, 
    RefreshCw, 
    Award,
    AlertCircle
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type DepartmentClearance = {
    status: 'Not Started' | 'Pending' | 'Cleared' | 'Rejected';
    notes?: string;
    updatedAt?: string;
};

type ClearanceRecord = {
    academic: DepartmentClearance;
    finance: DepartmentClearance;
    library: DepartmentClearance;
    hostel: DepartmentClearance;
    registry: DepartmentClearance;
    overallStatus: 'Not Started' | 'Pending' | 'Cleared' | 'Rejected';
    submittedAt?: string;
    clearanceDate?: string;
};

export default function StudentClearancePage() {
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    
    // Dynamic statuses
    const [feeBalance, setFeeBalance] = React.useState<number>(0);
    const [libraryOutstanding, setLibraryOutstanding] = React.useState<number>(0);
    
    // Clearance record state
    const [clearance, setClearance] = React.useState<ClearanceRecord>({
        academic: { status: 'Not Started' },
        finance: { status: 'Not Started' },
        library: { status: 'Not Started' },
        hostel: { status: 'Not Started' },
        registry: { status: 'Not Started' },
        overallStatus: 'Not Started'
    });

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                // Fetch profile
                get(ref(db, `users/${user.uid}`)).then(snap => {
                    if (snap.exists()) setUserProfile(snap.val());
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchClearanceAndSystemStatus = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Fetch clearance record
            const clearanceRef = ref(db, `graduationClearances/${currentUser.uid}`);
            onValue(clearanceRef, (snapshot) => {
                if (snapshot.exists()) {
                    setClearance(snapshot.val());
                }
            });

            // 2. Fetch dynamic Finance status
            const regsSnap = await get(ref(db, `registrations/${currentUser.uid}`));
            const invoicesSnap = await get(ref(db, `invoices/${currentUser.uid}`));
            const transactionsSnap = await get(ref(db, 'transactions'));
            
            let totalDue = 0;
            let totalPaid = 0;

            if (regsSnap.exists()) {
                const regs = regsSnap.val();
                const invoices = invoicesSnap.val() || {};
                
                Object.values(regs).forEach((reg: any) => {
                    if (reg.invoiceId && invoices[reg.invoiceId]) {
                        const inv = invoices[reg.invoiceId];
                        const tuition = Number(inv.totalTuition || 0);
                        const mandatory = Number(inv.totalMandatoryFees || 0);
                        const optional = Number(inv.totalOptionalFees || 0);
                        const late = Number(inv.lateFee || 0);
                        const scholPerc = Number(inv.scholarshipPercentage || 0);
                        
                        const scholarshipAmount = inv.applyScholarship ? (tuition * (scholPerc / 100)) : 0;
                        totalDue += (tuition - scholarshipAmount + mandatory + optional + late);
                    }
                });
            }

            if (transactionsSnap.exists()) {
                Object.values(transactionsSnap.val()).forEach((t: any) => {
                    if (t.userId === currentUser.uid && t.status === 'successful') {
                        totalPaid += (Number(t.amount) || 0);
                    }
                });
            }

            const currentBalance = Math.max(0, totalDue - totalPaid);
            setFeeBalance(currentBalance);

            // 3. Fetch dynamic Library status
            const bookRequestsSnap = await get(ref(db, 'bookRequests'));
            let activeLoans = 0;
            if (bookRequestsSnap.exists()) {
                Object.values(bookRequestsSnap.val()).forEach((req: any) => {
                    if (req.userId === currentUser.uid && req.status === 'Checked Out') {
                        activeLoans++;
                    }
                });
            }
            setLibraryOutstanding(activeLoans);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error loading clearance data' });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);

    React.useEffect(() => {
        if (currentUser) {
            fetchClearanceAndSystemStatus();
        }
    }, [currentUser, fetchClearanceAndSystemStatus]);

    const handleRequestClearance = async () => {
        if (!currentUser) return;
        setSubmitting(true);
        try {
            // Automatically set Finance to Cleared if balance is 0, otherwise keep it Not Started/Pending
            // Automatically set Library to Cleared if no active loans, otherwise keep it Not Started/Pending
            const financeStatus = feeBalance <= 0.01 ? 'Cleared' : 'Pending';
            const libraryStatus = libraryOutstanding === 0 ? 'Cleared' : 'Pending';

            const newClearance: ClearanceRecord = {
                academic: clearance.academic?.status === 'Cleared' ? clearance.academic : { status: 'Pending', notes: 'Awaiting academic audit verification.' },
                finance: { status: financeStatus, notes: financeStatus === 'Cleared' ? 'No outstanding fees found.' : `Outstanding balance: ZMW ${feeBalance.toFixed(2)}` },
                library: { status: libraryStatus, notes: libraryStatus === 'Cleared' ? 'No borrowed books held.' : `Outstanding library loans: ${libraryOutstanding} books` },
                hostel: clearance.hostel?.status === 'Cleared' ? clearance.hostel : { status: 'Pending', notes: 'Hostel room inspection and key return verification pending.' },
                registry: clearance.registry?.status === 'Cleared' ? clearance.registry : { status: 'Pending', notes: 'Verification of original academic certificate submissions pending.' },
                overallStatus: 'Pending',
                submittedAt: new Date().toISOString()
            };

            await set(ref(db, `graduationClearances/${currentUser.uid}`), {
                ...newClearance,
                studentName: userProfile?.name || currentUser.displayName || 'Graduating Student',
                studentEmail: userProfile?.email || currentUser.email || 'N/A'
            });

            toast({ title: 'Clearance Request Submitted', description: 'Your graduation clearance file is now under audit.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Submission failed', description: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadCertificate = () => {
        try {
            const doc = new jsPDF();
            
            // Header decoration
            doc.setFillColor(31, 41, 55);
            doc.rect(0, 0, 210, 40, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text("EDUTRACK360 UNIVERSITY", 105, 18, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text("OFFICIAL GRADUATION CLEARANCE CERTIFICATE", 105, 28, { align: 'center' });
            
            // Certificate body
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            
            const dateStr = clearance.clearanceDate 
                ? new Date(clearance.clearanceDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            
            doc.text(`Date of Issue: ${dateStr}`, 14, 55);
            doc.text(`Clearance File ID: GC-${currentUser?.uid.slice(0, 8).toUpperCase()}`, 196, 55, { align: 'right' });
            
            doc.line(14, 60, 196, 60);
            
            // Student details
            doc.setFontSize(12);
            doc.text("TO WHOM IT MAY CONCERN,", 14, 75);
            
            doc.setFont('helvetica', 'normal');
            const introText = `This is to certify that the student listed below has completed all institutional program requirements and has been officially cleared by all administrative, academic, and auxiliary departments for graduation.`;
            const splitIntro = doc.splitTextToSize(introText, 182);
            doc.text(splitIntro, 14, 85);
            
            // Student particulars table
            const particulars = [
                ['Student Name', userProfile?.name || currentUser?.displayName || 'N/A'],
                ['Student Email', userProfile?.email || currentUser?.email || 'N/A'],
                ['Student UID', currentUser?.uid || 'N/A'],
                ['Clearance Status', 'FULLY CLEARED']
            ];
            
            autoTable(doc, {
                startY: 105,
                body: particulars,
                theme: 'striped',
                styles: { fontSize: 11, cellPadding: 5 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
            });
            
            // Department Clearance Status Table
            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text("Departmental Clearance Audits", 14, finalY);
            
            const deptRows = [
                ['Academic Registry & Grades', 'CLEARED', clearance.academic?.notes || 'All requirements met.'],
                ['Bursar & Finance Office', 'CLEARED', clearance.finance?.notes || 'Account balanced.'],
                ['University Library System', 'CLEARED', clearance.library?.notes || 'No overdue loans.'],
                ['University Hostels & Housing', 'CLEARED', clearance.hostel?.notes || 'Room keys returned.'],
                ['Registry & Document Archives', 'CLEARED', clearance.registry?.notes || 'All credentials submitted.']
            ];
            
            autoTable(doc, {
                startY: finalY + 5,
                head: [['Department', 'Status', 'Verification Note']],
                body: deptRows,
                theme: 'grid',
                headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255] },
                styles: { fontSize: 9 }
            });
            
            // Footer, Seal & Signatures
            const sealY = (doc as any).lastAutoTable.finalY + 20;
            
            // Draw a mock seal
            doc.setDrawColor(31, 41, 55);
            doc.setLineWidth(1);
            doc.circle(50, sealY + 20, 15);
            doc.setFontSize(7);
            doc.text("OFFICIAL SEAL", 50, sealY + 20, { align: 'center' });
            doc.text("EDUTRACK360", 50, sealY + 23, { align: 'center' });
            
            // Signature line
            doc.setFontSize(10);
            doc.line(130, sealY + 25, 185, sealY + 25);
            doc.setFont('helvetica', 'bold');
            doc.text("Registrar of Academics", 157, sealY + 30, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text("Edutrack360 University", 157, sealY + 35, { align: 'center' });
            
            doc.save(`Graduation_Clearance_GC-${currentUser?.uid.slice(0, 8).toUpperCase()}.pdf`);
            toast({ title: 'Certificate Downloaded', description: 'Your official clearance letter has been downloaded.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to download certificate', description: e.message });
        }
    };

    if (loading) return <div className="p-6 space-y-4"><Loader2 className="animate-spin" /> Loading Clearance Profile...</div>;

    // Helper functions to count stats
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Cleared': return 'bg-green-500 text-white hover:bg-green-600';
            case 'Pending': return 'bg-amber-500 text-white hover:bg-amber-600';
            case 'Rejected': return 'bg-red-500 text-white hover:bg-red-600';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Cleared': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'Pending': return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
            case 'Rejected': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
        }
    };

    // Calculate progression percentage
    const statuses = [
        clearance.academic?.status,
        clearance.finance?.status,
        clearance.library?.status,
        clearance.hostel?.status,
        clearance.registry?.status
    ];
    
    const clearedCount = statuses.filter(s => s === 'Cleared').length;
    const progressPerc = (clearedCount / 5) * 100;

    return (
        <div className="space-y-6">
            <Card className="shadow-xl border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="font-headline text-3xl flex items-center gap-2">
                                <GraduationCap className="text-primary h-8 w-8" /> Graduation Clearance
                            </CardTitle>
                            <CardDescription>Track your academic and administrative clearance status for graduation.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 px-3 flex items-center gap-1.5"
                                onClick={fetchClearanceAndSystemStatus}
                            >
                                <RefreshCw className="h-4 w-4" /> Refresh Audit
                            </Button>
                            
                            {clearance.overallStatus === 'Cleared' ? (
                                <Button 
                                    size="sm" 
                                    className="h-9 px-4 font-bold flex items-center gap-1.5 shadow-md bg-green-600 hover:bg-green-700 text-white border-0"
                                    onClick={handleDownloadCertificate}
                                >
                                    <Download className="h-4 w-4" /> Download Certificate
                                </Button>
                            ) : (
                                <Button 
                                    size="sm" 
                                    className="h-9 px-4 font-bold"
                                    disabled={submitting || clearance.overallStatus === 'Pending'} 
                                    onClick={handleRequestClearance}
                                >
                                    {submitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                                    {clearance.overallStatus === 'Pending' ? 'Clearance File Pending' : 'Submit Clearance File'}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Overall Status Alert */}
                    {clearance.overallStatus === 'Cleared' && (
                        <div className="p-4 rounded-xl border-2 border-green-200 bg-green-50 flex items-start gap-3 shadow-md">
                            <Award className="h-6 w-6 text-green-600 shrink-0 mt-0.5 animate-bounce" />
                            <div className="space-y-1">
                                <h4 className="font-bold text-green-800 text-base">Congratulations! You are cleared for Graduation.</h4>
                                <p className="text-xs text-green-700 leading-relaxed">
                                    All relevant administrative, housing, academic, and financial reviews have cleared. You can now download your official Clearance Certificate to present at registry.
                                </p>
                            </div>
                        </div>
                    )}
                    {clearance.overallStatus === 'Pending' && (
                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                            <Loader2 className="h-6 w-6 text-amber-500 shrink-0 mt-0.5 animate-spin" />
                            <div className="space-y-1">
                                <h4 className="font-bold text-amber-800 text-sm">Graduation clearance audit is in progress.</h4>
                                <p className="text-xs text-amber-700 leading-relaxed">
                                    The university registries and departments are currently auditing your status. Please review the individual department statuses below.
                                </p>
                            </div>
                        </div>
                    )}
                    {clearance.overallStatus === 'Rejected' && (
                        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 flex items-start gap-3">
                            <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="font-bold text-red-800 text-sm">Clearance request rejected or updates required.</h4>
                                <p className="text-xs text-red-700 leading-relaxed">
                                    One or more departments have flagged outstanding issues. Please view details below, resolve any issues, and re-submit your clearance.
                                </p>
                            </div>
                        </div>
                    )}
                    {clearance.overallStatus === 'Not Started' && (
                        <div className="p-4 rounded-xl border border-muted bg-muted/20 flex items-start gap-3">
                            <AlertCircle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="font-bold text-muted-foreground text-sm">No clearance request submitted.</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    To begin graduation verification, please click "Submit Clearance File" above. Ensure you have returned all library books and cleared outstanding balances to expedite the process.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overall Clearance Progress</span>
                            <span className="text-sm font-black text-primary">{clearedCount} of 5 Departments Cleared ({progressPerc.toFixed(0)}%)</span>
                        </div>
                        <Progress value={progressPerc} className="h-2.5" />
                    </div>

                    {/* Department Grid */}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {/* Finance */}
                        <Card className="border border-muted/50 bg-background/50 hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
                                        <CardTitle className="text-base">Finance Office</CardTitle>
                                    </div>
                                    <Badge className={getStatusColor(clearance.finance?.status)}>{clearance.finance?.status || 'Not Started'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-3">
                                <p className="text-muted-foreground">Checks balance sheets, tuition records, and outstanding fees.</p>
                                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5">
                                    <div className="flex justify-between"><span>Database Balance:</span><span className={feeBalance > 0.01 ? "font-bold text-red-500" : "font-bold text-green-600"}>ZMW {feeBalance.toFixed(2)}</span></div>
                                    <div className="flex justify-between"><span>Audit Decision:</span><span className="font-bold flex items-center gap-1">{getStatusIcon(clearance.finance?.status || 'Not Started')}{clearance.finance?.status || 'Not Started'}</span></div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 text-[10px] text-muted-foreground">
                                {clearance.finance?.notes && <p className="italic">Note: "{clearance.finance.notes}"</p>}
                            </CardFooter>
                        </Card>

                        {/* Library */}
                        <Card className="border border-muted/50 bg-background/50 hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-blue-500/10"><Library className="h-5 w-5 text-blue-600" /></div>
                                        <CardTitle className="text-base">Library Audit</CardTitle>
                                    </div>
                                    <Badge className={getStatusColor(clearance.library?.status)}>{clearance.library?.status || 'Not Started'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-3">
                                <p className="text-muted-foreground">Verifies that all borrowed books have been returned and fines paid.</p>
                                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5">
                                    <div className="flex justify-between"><span>Books Currently Held:</span><span className={libraryOutstanding > 0 ? "font-bold text-red-500" : "font-bold text-green-600"}>{libraryOutstanding}</span></div>
                                    <div className="flex justify-between"><span>Audit Decision:</span><span className="font-bold flex items-center gap-1">{getStatusIcon(clearance.library?.status || 'Not Started')}{clearance.library?.status || 'Not Started'}</span></div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 text-[10px] text-muted-foreground">
                                {clearance.library?.notes && <p className="italic">Note: "{clearance.library.notes}"</p>}
                            </CardFooter>
                        </Card>

                        {/* Academic Registry */}
                        <Card className="border border-muted/50 bg-background/50 hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-indigo-500/10"><FileText className="h-5 w-5 text-indigo-600" /></div>
                                        <CardTitle className="text-base">Academic Records</CardTitle>
                                    </div>
                                    <Badge className={getStatusColor(clearance.academic?.status)}>{clearance.academic?.status || 'Not Started'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-3">
                                <p className="text-muted-foreground">Audits class transcripts, grade points, and graduation requirements.</p>
                                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5">
                                    <div className="flex justify-between"><span>Audit Decision:</span><span className="font-bold flex items-center gap-1">{getStatusIcon(clearance.academic?.status || 'Not Started')}{clearance.academic?.status || 'Not Started'}</span></div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 text-[10px] text-muted-foreground">
                                {clearance.academic?.notes && <p className="italic">Note: "{clearance.academic.notes}"</p>}
                            </CardFooter>
                        </Card>

                        {/* Hostel & Housing */}
                        <Card className="border border-muted/50 bg-background/50 hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-amber-500/10"><Building className="h-5 w-5 text-amber-600" /></div>
                                        <CardTitle className="text-base">Hostel Operations</CardTitle>
                                    </div>
                                    <Badge className={getStatusColor(clearance.hostel?.status)}>{clearance.hostel?.status || 'Not Started'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-3">
                                <p className="text-muted-foreground">Confirms hostel key returns, room status, and lack of property damages.</p>
                                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5">
                                    <div className="flex justify-between"><span>Audit Decision:</span><span className="font-bold flex items-center gap-1">{getStatusIcon(clearance.hostel?.status || 'Not Started')}{clearance.hostel?.status || 'Not Started'}</span></div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 text-[10px] text-muted-foreground">
                                {clearance.hostel?.notes && <p className="italic">Note: "{clearance.hostel.notes}"</p>}
                            </CardFooter>
                        </Card>

                        {/* Registry / Document Archives */}
                        <Card className="border border-muted/50 bg-background/50 hover:shadow-lg transition-all duration-300">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-rose-500/10"><FileText className="h-5 w-5 text-rose-600" /></div>
                                        <CardTitle className="text-base">Document Registry</CardTitle>
                                    </div>
                                    <Badge className={getStatusColor(clearance.registry?.status)}>{clearance.registry?.status || 'Not Started'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-3">
                                <p className="text-muted-foreground">Ensures original certificate submission and admission paperwork are verified.</p>
                                <div className="bg-muted/30 p-2.5 rounded-lg space-y-1.5">
                                    <div className="flex justify-between"><span>Audit Decision:</span><span className="font-bold flex items-center gap-1">{getStatusIcon(clearance.registry?.status || 'Not Started')}{clearance.registry?.status || 'Not Started'}</span></div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0 text-[10px] text-muted-foreground">
                                {clearance.registry?.notes && <p className="italic">Note: "{clearance.registry.notes}"</p>}
                            </CardFooter>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
