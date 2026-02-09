'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Receipt, History, DollarSign, ChevronDown, CheckCircle2, GraduationCap, Loader2, Download, Mail } from 'lucide-react';
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
import { sendEmail } from '@/ai/flows/send-email-flow';

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
};

export default function StudentPaymentsPage() {
    const [payments, setPayments] = React.useState<PaymentSummary[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [allSemesters, setAllSemesters] = React.useState<Record<string, Semester>>({});
    const [institutionSettings, setInstitutionSettings] = React.useState({ name: 'Edutrack360', logoUrl: '' });
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
            const [invoicesSnap, transactionsSnap, semestersSnap, coursesSnap, institutionSnap] = await Promise.all([
                get(ref(db, `invoices/${currentUser.uid}`)),
                get(ref(db, 'transactions')),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/institution')),
            ]);

            const semestersData = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            setAllCourses(coursesData);
            setAllSemesters(semestersData);
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

            const summaries: PaymentSummary[] = invoices.map(invoice => {
                const semesterId = invoice.semesterId;
                const totalDue = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0) - (invoice.applyScholarship ? (invoice.totalTuition || 0) : 0);
                const invoiceTransactions = allTransactions.filter(t => t.invoiceId === invoice.invoiceId);
                const totalPaid = invoiceTransactions.reduce((sum, t) => sum + t.amount, 0);
                const balance = Math.max(0, totalDue - totalPaid);

                return {
                    semesterId,
                    semesterName: invoice.semester,
                    invoice,
                    totalDue,
                    totalPaid,
                    balance,
                    status: balance <= 0.01 ? 'Paid' : 'Pending',
                    transactions: invoiceTransactions.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                };
            });

            setPayments(summaries.sort((a, b) => b.invoice.dateCreated.localeCompare(a.invoice.dateCreated)));
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to load payments', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);

    React.useEffect(() => {
        if (currentUser) fetchData();
    }, [currentUser, fetchData]);

    const generateInvoicePDF = async (p: PaymentSummary): Promise<jsPDF | null> => {
        const semester = allSemesters[p.semesterId];
        if (!semester) return null;

        const doc = new jsPDF();
        if (institutionSettings.logoUrl) {
            try {
                doc.addImage(institutionSettings.logoUrl, 'PNG', 14, 15, 20, 20);
            } catch (e) {
                console.warn("Logo failed to load for PDF:", e);
            }
        }
        doc.setFontSize(20); doc.text(institutionSettings.name, 40, 25);
        doc.setFontSize(12); doc.text('Student Invoice', 190, 25, { align: 'right' });
        doc.setFontSize(10);
        doc.text(`Student: ${currentUser?.displayName || 'Student'}`, 14, 40);
        doc.text(`Invoice ID: ${p.invoice.invoiceId}`, 190, 40, { align: 'right' });
        doc.text(`Date Issued: ${format(new Date(p.invoice.dateCreated), 'PPP')}`, 190, 45, { align: 'right' });
        doc.text(`Semester: ${semester.name}`, 14, 45);

        const courseItems = (p.invoice.courses || []).map(id => [allCourses[id]?.code || 'N/A', `Tuition: ${allCourses[id]?.name || 'Unknown Course'}`, `ZMW ${(allCourses[id]?.cost || 0).toFixed(2)}`]);
        const mandatoryFeeItems = semester?.mandatoryFees ? Object.values(semester.mandatoryFees).map(fee => ['', `Mandatory Fee: ${fee.name}`, `ZMW ${(fee.amount || 0).toFixed(2)}`]) : [];
        const optionalFeeItems = semester?.optionalFees && p.invoice.optionalFees ? p.invoice.optionalFees.map(id => ['', `Optional Fee: ${semester.optionalFees![id]?.name || 'Unknown Fee'}`, `ZMW ${(semester.optionalFees![id]?.amount || 0).toFixed(2)}`]) : [];
        const lateFeeItem = p.invoice.lateFee && p.invoice.lateFee > 0 ? [['', 'Late Registration Fee', `ZMW ${p.invoice.lateFee.toFixed(2)}`]] : [];

        const body = [...courseItems, ...mandatoryFeeItems, ...optionalFeeItems, ...lateFeeItem];
        const subtotal = (p.invoice.totalTuition || 0) + (p.invoice.totalMandatoryFees || 0) + (p.invoice.totalOptionalFees || 0) + (p.invoice.lateFee || 0);
        
        const foot: (string | number)[][] = [['', 'Subtotal', `ZMW ${subtotal.toFixed(2)}`]];
        if(p.invoice.applyScholarship) {
            foot.push(['', 'Scholarship Waived', `(ZMW ${(p.invoice.totalTuition || 0).toFixed(2)})`]);
            foot.push(['', 'Total Due', `ZMW ${p.totalDue.toFixed(2)}`]);
        } else {
            foot.push(['', 'Total Due', `ZMW ${p.totalDue.toFixed(2)}`]);
        }
        
        autoTable(doc, { startY: 55, head: [['Code', 'Description', 'Amount']], body, foot, theme: 'striped', headStyles: { fillColor: [34, 34, 34] } });
        return doc;
    };

    const handleDownloadInvoice = async (p: PaymentSummary) => {
        setActionLoading(`dl-${p.invoice.invoiceId}`);
        try {
            const doc = await generateInvoicePDF(p);
            if (doc) {
                doc.save(`invoice-${p.invoice.invoiceId}.pdf`);
                toast({ title: 'Invoice Downloaded' });
            } else {
                toast({ variant: 'destructive', title: 'Invoice Not Found' });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Download Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Payments & Invoices</CardTitle>
                    <CardDescription>View your billing history and payment records.</CardDescription>
                </CardHeader>
            </Card>

            {payments.length > 0 ? (
                <div className="space-y-4">
                    {payments.map((payment) => (
                        <Card key={payment.invoice.invoiceId} className="overflow-hidden border-0 shadow-lg">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <CardTitle className="text-xl">{payment.semesterName}</CardTitle>
                                        <CardDescription>Invoice ID: {payment.invoice.invoiceId} &middot; Issued: {format(parseISO(payment.invoice.dateCreated), 'PPP')}</CardDescription>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant={payment.status === 'Paid' ? 'default' : 'secondary'}>
                                            {payment.status === 'Paid' ? <CheckCircle2 className="mr-1 h-3 w-3"/> : null}
                                            {payment.status}
                                        </Badge>
                                        {payment.balance > 0 && <span className="text-xs font-bold text-destructive">Balance: ZMW {payment.balance.toFixed(2)}</span>}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-bold flex items-center gap-2"><Receipt className="h-4 w-4 text-primary"/> Invoice Breakdown</h4>
                                        <div className="rounded-md border p-4 bg-card shadow-sm space-y-3">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Academic Fees</p>
                                                {(payment.invoice.courses || []).map(id => {
                                                    const course = allCourses[id];
                                                    return course ? (
                                                        <div key={id} className="flex justify-between text-xs">
                                                            <span>Tuition: {course.name}</span>
                                                            <span className="font-mono">ZMW {course.cost.toFixed(2)}</span>
                                                        </div>
                                                    ) : null;
                                                })}
                                                {payment.invoice.applyScholarship && (
                                                    <div className="flex justify-between text-xs text-green-600 font-medium italic">
                                                        <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3"/> Scholarship Applied</span>
                                                        <span className="font-mono">-(ZMW {payment.invoice.totalTuition?.toFixed(2)})</span>
                                                    </div>
                                                )}
                                            </div>
                                            <Separator />
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Institutional Fees</p>
                                                {Object.values(allSemesters[payment.semesterId]?.mandatoryFees || {}).map((fee, i) => (
                                                    <div key={i} className="flex justify-between text-xs">
                                                        <span>{fee.name} (Mandatory)</span>
                                                        <span className="font-mono">ZMW {fee.amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {(payment.invoice.optionalFees || []).map(id => {
                                                    const fee = allSemesters[payment.semesterId]?.optionalFees?.[id];
                                                    return fee ? (
                                                        <div key={id} className="flex justify-between text-xs">
                                                            <span>{fee.name} (Optional)</span>
                                                            <span className="font-mono">ZMW {fee.amount.toFixed(2)}</span>
                                                        </div>
                                                    ) : null;
                                                })}
                                                {(payment.invoice.lateFee || 0) > 0 && (
                                                    <div className="flex justify-between text-xs text-destructive">
                                                        <span>Late Registration Fee</span>
                                                        <span className="font-mono">ZMW {payment.invoice.lateFee?.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <Separator />
                                            <div className="flex justify-between font-bold pt-1">
                                                <span>Total Payable</span>
                                                <span className="text-lg">ZMW {payment.totalDue.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-bold flex items-center gap-2"><History className="h-4 w-4 text-primary"/> Transaction History</h4>
                                        <div className="rounded-md border bg-muted/20 min-h-[100px]">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="h-10 text-[10px] uppercase">Date</TableHead>
                                                        <TableHead className="h-10 text-[10px] uppercase">Method</TableHead>
                                                        <TableHead className="h-10 text-right text-[10px] uppercase">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {payment.transactions.length > 0 ? payment.transactions.map((tx) => (
                                                        <TableRow key={tx.key} className="hover:bg-transparent">
                                                            <TableCell className="py-2 text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                            <TableCell className="py-2 text-xs">{tx.method || 'Online'}</TableCell>
                                                            <TableCell className="py-2 text-right font-mono font-medium text-xs">ZMW {tx.amount.toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    )) : (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="h-24 text-center text-xs text-muted-foreground italic">No payments recorded yet.</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/10 border-t justify-between p-4">
                                <div className="text-xs">
                                    <span className="text-muted-foreground">Payment Plan:</span> <span className="font-semibold">{payment.invoice.paymentPlan}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => handleDownloadInvoice(payment)}
                                        disabled={actionLoading === `dl-${payment.invoice.invoiceId}`}
                                    >
                                        {actionLoading === `dl-${payment.invoice.invoiceId}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                        Download PDF
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href="/student/dashboard"><DollarSign className="mr-2 h-4 w-4"/>Make a Payment</Link>
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                        <DollarSign className="mx-auto h-12 w-12 opacity-20 mb-4" />
                        <h3 className="text-lg font-semibold">No Billing History</h3>
                        <p className="text-sm max-w-xs mx-auto">You haven't been issued any invoices yet.</p>
                        <Button className="mt-6" asChild variant="outline">
                            <Link href="/student/registration">Go to Registration</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}