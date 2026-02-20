'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Receipt, 
    History, 
    DollarSign, 
    ChevronDown, 
    CheckCircle2, 
    GraduationCap, 
    Loader2, 
    Download, 
    Calculator, 
    AlertTriangle, 
    CheckCircle, 
    ShieldAlert, 
    Info, 
    XCircle,
    ArrowRight
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Invoice = { 
    invoiceId: string; 
    totalTuition: number; 
    totalMandatoryFees: number; 
    totalOptionalFees: number; 
    lateFee?: number; 
    paymentPlan: string; 
    dateCreated: string; 
    semester: string; 
    semesterId: string; 
    courses?: string[]; 
    optionalFees?: string[]; 
    applyScholarship?: boolean; 
};

type Transaction = { 
    key: string; 
    transactionId: string; 
    invoiceId: string; 
    amount: number; 
    paymentDate: string; 
    status: 'successful' | 'failed'; 
    method?: string; 
    userId: string;
};

type Semester = {
    id: string;
    name: string;
    intakeId: string;
    paymentThreshold?: number;
    mandatoryFees?: Record<string, { name: string; amount: number }>;
    optionalFees?: Record<string, { name: string; amount: number }>;
};

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
};

type PaymentSummary = {
    semesterId: string;
    semesterName: string;
    invoice: Invoice;
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'Paid' | 'Pending' | 'Overdue';
    transactions: Transaction[];
    threshold: number;
    paidPercentage: number;
    thresholdMet: boolean;
};

export default function StudentPaymentsPage() {
    const [payments, setPayments] = React.useState<PaymentSummary[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allSemesters, setAllSemesters] = React.useState<Record<string, Semester>>({});
    const [institutionSettings, setInstitutionSettings] = React.useState({ name: 'Edutrack360', logoUrl: '' });
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) setCurrentUser(user);
            else setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [userSnap, invoicesSnap, transactionsSnap, semestersSnap, coursesSnap, institutionSnap, financialSnap] = await Promise.all([
                get(ref(db, `users/${currentUser.uid}`)),
                get(ref(db, `invoices/${currentUser.uid}`)),
                get(ref(db, 'transactions')),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/institution')),
                get(ref(db, 'settings/financialSettings')),
            ]);

            const userProfile = userSnap.val() || {};
            const semestersData = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            const fSettings = financialSnap.val() || { paymentThreshold: 75, defaulterRestrictions: { registration: true, results: true, library: false, exams: false } };
            
            setAllCourses(coursesData);
            setAllSemesters(semestersData);
            setFinancialSettings(fSettings);
            if (institutionSnap.exists()) setInstitutionSettings(institutionSnap.val());

            if (!invoicesSnap.exists()) {
                setPayments([]);
                setLoading(false);
                return;
            }

            const invoices: Invoice[] = Object.values(invoicesSnap.val());
            const allTransactions: Transaction[] = Object.entries(transactionsSnap.val() || {})
                .map(([key, data]) => ({ key, ...(data as any) }))
                .filter(t => t.userId === currentUser.uid && t.status === 'successful');

            const summaries: PaymentSummary[] = invoices
                .map(invoice => {
                    const semesterId = invoice.semesterId;
                    const semesterInfo = semestersData[semesterId];
                    if (semesterInfo && semesterInfo.intakeId !== userProfile.intakeId) return null;

                    const totalDue = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0) - (invoice.applyScholarship ? (invoice.totalTuition || 0) : 0);
                    const invoiceTransactions = allTransactions.filter(t => t.invoiceId === invoice.invoiceId);
                    const totalPaid = invoiceTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                    const balance = Math.max(0, totalDue - totalPaid);
                    
                    const threshold = semesterInfo?.paymentThreshold || fSettings.paymentThreshold || 75;
                    const paidPercentage = totalDue > 0 ? (totalPaid / totalDue) * 100 : 100;
                    const thresholdMet = paidPercentage >= threshold;

                    return {
                        semesterId,
                        semesterName: invoice.semester,
                        invoice,
                        totalDue,
                        totalPaid,
                        balance,
                        status: balance <= 0.01 ? 'Paid' : 'Pending',
                        transactions: invoiceTransactions.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
                        threshold,
                        paidPercentage,
                        thresholdMet
                    };
                })
                .filter((s): s is PaymentSummary => s !== null);

            setPayments(summaries.sort((a, b) => b.invoice.dateCreated.localeCompare(a.invoice.dateCreated)));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to load payments' });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);

    React.useEffect(() => {
        if (currentUser) fetchData();
    }, [currentUser, fetchData]);

    const handleDownloadInvoice = async (p: PaymentSummary) => {
        setActionLoading(`dl-${p.invoice.invoiceId}`);
        try {
            const semester = allSemesters[p.semesterId];
            const doc = new jsPDF();
            if (institutionSettings.logoUrl) {
                try { doc.addImage(institutionSettings.logoUrl, 'PNG', 14, 15, 20, 20); } catch (e) {}
            }
            doc.setFontSize(20); doc.text(institutionSettings.name, 40, 25);
            doc.setFontSize(12); doc.text('Combined Invoice & Statement', 190, 25, { align: 'right' });
            doc.setFontSize(10);
            doc.text(`Student: ${currentUser?.displayName || 'Student'}`, 14, 40);
            doc.text(`Invoice ID: ${p.invoice.invoiceId}`, 190, 40, { align: 'right' });
            doc.text(`Semester: ${semester?.name || p.semesterName}`, 14, 45);

            const body = (p.invoice.courses || []).map(id => [allCourses[id]?.code || 'N/A', `Tuition: ${allCourses[id]?.name || 'Unknown'}`, `ZMW ${(allCourses[id]?.cost || 0).toFixed(2)}`]);
            const fees = semester?.mandatoryFees ? Object.values(semester.mandatoryFees).map(f => ['', `Mandatory Fee: ${f.name}`, `ZMW ${f.amount.toFixed(2)}`]) : [];
            const optional = semester?.optionalFees && p.invoice.optionalFees ? p.invoice.optionalFees.map(id => ['', `Optional Fee: ${semester.optionalFees![id]?.name}`, `ZMW ${semester.optionalFees![id]?.amount.toFixed(2)}`]) : [];
            const finalBody = [...body, ...fees, ...optional];
            
            autoTable(doc, { startY: 55, head: [['Code', 'Description', 'Amount']], body: finalBody, theme: 'striped', headStyles: { fillColor: [34, 34, 34] }});

            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFontSize(14); doc.text("Payments Received", 14, finalY);
            const txRows = p.transactions.map(t => [format(parseISO(t.paymentDate), 'dd MMM yyyy'), t.transactionId, t.method || 'Online', `ZMW ${t.amount.toFixed(2)}`]);
            autoTable(doc, { startY: finalY + 5, head: [['Date', 'Ref', 'Method', 'Amount']], body: txRows.length > 0 ? txRows : [['-', 'No payments', '-', 'ZMW 0.00']], theme: 'grid' });

            const summaryY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(12); doc.text(`Total Paid: ZMW ${p.totalPaid.toFixed(2)}`, 190, summaryY, { align: 'right' });
            doc.text(`BALANCE: ZMW ${p.balance.toFixed(2)}`, 190, summaryY + 8, { align: 'right' });

            doc.save(`invoice-${p.invoice.invoiceId}.pdf`);
            toast({ title: 'Invoice Downloaded' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Download Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

    const restrictions = financialSettings?.defaulterRestrictions || {};

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Payments & Invoices</CardTitle>
                    <CardDescription>View your billing history and payment records.</CardDescription>
                </CardHeader>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    {payments.map((payment) => (
                        <Card key={payment.invoice.invoiceId} className="overflow-hidden border-0 shadow-lg">
                            <CardHeader className="bg-muted/30">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>{payment.semesterName}</CardTitle>
                                        <CardDescription>Plan: {payment.invoice.paymentPlan}</CardDescription>
                                    </div>
                                    <Badge variant={payment.status === 'Paid' ? 'default' : 'secondary'}>{payment.status}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Receipt className="h-3 w-3" /> Billing Breakdown</h4>
                                        <div className="rounded-xl border p-4 bg-card space-y-3">
                                            <div className="flex justify-between text-sm"><span>Total Due</span><span className="font-bold">ZMW {payment.totalDue.toFixed(2)}</span></div>
                                            <div className="flex justify-between text-sm text-green-600"><span>Amount Paid</span><span className="font-bold">ZMW {payment.totalPaid.toFixed(2)}</span></div>
                                            <Separator />
                                            <div className="flex justify-between font-black text-destructive"><span>Balance</span><span>ZMW {payment.balance.toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Calculator className="h-3 w-3" /> Financial Standing</h4>
                                        <div className="p-4 rounded-xl border bg-primary/5 space-y-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-xs font-bold">Progress to Standing</span>
                                                <span className="text-lg font-black">{payment.paidPercentage.toFixed(0)}%</span>
                                            </div>
                                            <Progress value={payment.paidPercentage} className="h-2" />
                                            <Popover>
                                                <PopoverTrigger asChild><Button variant="ghost" className="w-full h-auto p-2 justify-between group"><span className="text-[10px] font-bold uppercase tracking-wider">{payment.thresholdMet ? "Good Standing" : "Below Threshold"}</span><ChevronDown className="h-3 w-3"/></Button></PopoverTrigger>
                                                <PopoverContent className="w-80 p-4 shadow-2xl">
                                                    <div className="space-y-4">
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2">Active Restrictions</h4>
                                                        <div className="grid gap-2 text-[10px] font-bold uppercase">
                                                            <div className="flex justify-between"><span>Reg. Block</span> {restrictions.registration && !payment.thresholdMet ? <AlertTriangle className="text-red-500 h-3 w-3"/> : <CheckCircle2 className="text-green-600 h-3 w-3"/>}</div>
                                                            <div className="flex justify-between"><span>Grade Block</span> {restrictions.results && !payment.thresholdMet ? <AlertTriangle className="text-red-500 h-3 w-3"/> : <CheckCircle2 className="text-green-600 h-3 w-3"/>}</div>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t justify-end p-4 gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(payment)} disabled={actionLoading === `dl-${payment.invoice.invoiceId}`}>
                                    {actionLoading === `dl-${payment.invoice.invoiceId}` ? <Loader2 className="animate-spin h-4 w-4"/> : <Download className="mr-2 h-4 w-4"/>}Statement
                                </Button>
                                <Button size="sm" asChild><Link href="/student/dashboard">Pay Fees</Link></Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
                <div className="space-y-6">
                    <Card className="border-2 border-primary/10 shadow-md">
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-lg">Policy Notice</CardTitle></CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <p className="text-xs text-muted-foreground leading-relaxed">Ensure you meet the minimum payment threshold ({financialSettings?.paymentThreshold || 75}%) by installment deadlines to avoid account restrictions.</p>
                            <Button variant="link" size="sm" asChild className="p-0 text-xs font-bold"><Link href="/contact">Contact Finance Team <ArrowRight className="ml-1 h-3 w-3"/></Link></Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
