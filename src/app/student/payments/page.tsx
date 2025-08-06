
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
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, History, DollarSign, AlertCircle, Download, GraduationCap, Trash2, Banknote, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { format, parseISO, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, createNotification } from '@/lib/firebase';
import { ref, get, update, push, set, remove, onValue } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

type Invoice = {
  invoiceId: string;
  totalTuition: number;
  totalMandatoryFees: number;
  totalOptionalFees: number;
  lateFee?: number;
  paymentPlan: string;
  dateCreated: string;
  semester: string; // Semester Name
  semesterId: string;
  courses: string[];
  optionalFees: string[];
  applyScholarship?: boolean;
};

type Transaction = {
    transactionId: string;
    invoiceId: string;
    amount: number;
    paymentDate: string;
    status: 'successful' | 'failed';
    semesterId: string;
    userId: string;
}

type Registration = {
    courses: string[];
    originalCourses?: string[];
    optionalFees: string[];
    invoiceId: string;
    status: 'Pending Approval' | 'Pending Payment' | 'Completed';
    paymentPlan: string;
    programmeId: string;
    applyScholarship?: boolean;
    invoiceDetails?: Invoice;
    semesterName: string;
    installmentsPaid?: number;
    totalInstallments?: number;
}

type DuePayment = {
    installmentName: string;
    dueDate: string | null;
    amountDue: number;
    amountPaid: number;
    balance: number;
    status: 'Paid' | 'Partially Paid' | 'Due' | 'Overdue' | 'Upcoming';
    invoice: Invoice;
    isPayable: boolean;
    registration: Registration;
};

type UserData = {
    name: string;
    email: string;
    id: string;
};

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
};

type Fee = {
    id: string;
    name: string;
    amount: number;
}

type PaymentPlan = {
    id: string;
    name: string;
    installments: number;
    installmentPercentages: number[];
}

type Semester = {
    id: string;
    name: string;
    mandatoryFees: Record<string, Omit<Fee, 'id'>>;
    optionalFees: Record<string, Omit<Fee, 'id'>>;
}

type GroupedData<T> = Record<string, T[]>;

function PayNowSection({ 
    payment, 
    userData, 
    onPaymentSuccess
}: { 
    payment: DuePayment, 
    userData: UserData | null, 
    onPaymentSuccess: (payment: DuePayment, response: any) => Promise<void>
}) {
    const [isPaying, setIsPaying] = React.useState(false);
    const [customAmount, setCustomAmount] = React.useState<number | string>('');
    
    const paymentAmount = Number(customAmount) > 0 ? Number(customAmount) : 0;
    const finalAmount = Math.min(paymentAmount, payment.balance);

    const config = {
        public_key: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY!,
        tx_ref: `edutrack360-${payment.invoice.invoiceId}-${Date.now()}`,
        amount: finalAmount,
        currency: 'ZMW',
        payment_options: 'mobilemoneyzambia',
        customer: {
            email: userData?.email || '',
            name: userData?.name || '',
        },
        customizations: {
            title: 'Edutrack360 Course Payment',
            description: `Payment for ${payment.installmentName} - ${payment.invoice.semester}`,
            logo: 'https://placehold.co/100x100.png',
        },
    };

    const handleFlutterwavePayment = useFlutterwave(config);
    
    if (payment.registration.status === 'Pending Approval') {
        return <Button size="sm" disabled>Awaiting Approval</Button>
    }
    
    if (!payment.isPayable) {
        return <Button size="sm" variant="outline" disabled>Pay</Button>
    }

    return (
        <div className="w-full space-y-4 pt-2">
             <div className="p-4 border rounded-lg bg-background">
                <Label htmlFor={`amount-${payment.invoice.invoiceId}`}>Payment Amount</Label>
                <Input 
                    id={`amount-${payment.invoice.invoiceId}`}
                    type="number"
                    placeholder={`Up to ZMW ${payment.balance.toFixed(2)}`}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    max={payment.balance}
                    min="1"
                />
                 <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm space-y-2">
                    <h4 className="font-semibold">Coverage Summary</h4>
                    <p className="text-xs text-muted-foreground">Paying this installment contributes to your total semester fees. Once the installment is fully paid, you will be enrolled in all courses and services for this semester.</p>
                 </div>
                 <Button className="w-full mt-4" onClick={() => {
                    setIsPaying(true);
                    handleFlutterwavePayment({
                        callback: async (response) => {
                            if (response.status === 'successful') {
                                await onPaymentSuccess(payment, response);
                            }
                            closePaymentModal();
                            setIsPaying(false);
                        },
                        onClose: () => setIsPaying(false),
                    });
                }} disabled={isPaying || finalAmount <= 0}>
                    {isPaying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Pay ZMW ${finalAmount.toFixed(2)}`}
                </Button>
             </div>
        </div>
    );
}

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
}


export default function PaymentsPage() {
    // Final processed data for UI
    const [groupedDuePayments, setGroupedDuePayments] = React.useState<GroupedData<DuePayment>>({});
    const [groupedInvoices, setGroupedInvoices] = React.useState<GroupedData<Invoice>>({});
    const [groupedTransactions, setGroupedTransactions] = React.useState<GroupedData<Transaction>>({});
    
    // Raw data from Firebase
    const [rawRegistrations, setRawRegistrations] = React.useState<Record<string, Registration> | null>(null);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [rawInvoices, setRawInvoices] = React.useState<Invoice[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [calendarEvents, setCalendarEvents] = React.useState<{title: string, date: string}[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [institutionSettings, setInstitutionSettings] = React.useState({ name: 'Edutrack360', logoUrl: '' });
    
    // Component state
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<UserData | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setCurrentUser(user);
            const userRef = ref(db, `users/${user.uid}`);
            onValue(userRef, (snapshot) => {
              if (snapshot.exists()) setUserData(snapshot.val());
            });
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
    }, []);

    const processData = React.useCallback(() => {
        if (!rawRegistrations || !currentUser) return;
    
        const allDuePayments: DuePayment[] = [];
        const newGroupedInvoices: GroupedData<Invoice> = {};
    
        for (const invoice of rawInvoices) {
            const reg = Object.values(rawRegistrations).find(r => r.invoiceId === invoice.invoiceId);
            if (!reg) continue;
    
            if (!newGroupedInvoices[invoice.semesterId]) newGroupedInvoices[invoice.semesterId] = [];
            newGroupedInvoices[invoice.semesterId].push(invoice);
    
            const totalPayable = invoice.applyScholarship
                ? (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0)
                : (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0);
    
            const plan = allPaymentPlans.find(p => p.name === invoice.paymentPlan) || { name: 'Full Payment', installments: 1, installmentPercentages: [100] };
            const semesterTransactions = rawTransactions.filter(t => t.invoiceId === invoice.invoiceId);
            let totalPaidForInvoice = semesterTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    
            for (let i = 0; i < plan.installments; i++) {
                const installmentName = plan.installments > 1 ? `${getOrdinalSuffix(i + 1)} Installment` : 'Full Payment';
                const deadlineTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${invoice.semester}`;
                const deadlineEvent = calendarEvents.find(e => e.title.trim() === deadlineTitle.trim());
    
                const percentage = plan.installmentPercentages?.[i] || (100 / plan.installments);
                const amountDueForThis = totalPayable * (percentage / 100);
                const paidForThis = Math.min(totalPaidForInvoice, amountDueForThis);
                const balance = Math.max(0, amountDueForThis - paidForThis);
    
                let status: DuePayment['status'] = 'Upcoming';
                const today = new Date(); today.setHours(0,0,0,0);
                const dueDate = deadlineEvent ? parseISO(deadlineEvent.date) : null;
    
                if (balance <= 0.01) status = 'Paid';
                else if (paidForThis > 0) status = 'Partially Paid';
                else if (dueDate && isBefore(dueDate, today)) status = 'Overdue';
    
                allDuePayments.push({ installmentName, dueDate: deadlineEvent?.date || null, amountDue: amountDueForThis, amountPaid: paidForThis, balance, status, invoice, isPayable: false, registration: reg });
                totalPaidForInvoice = Math.max(0, totalPaidForInvoice - paidForThis);
            }
        }
    
        const finalDuePayments: GroupedData<DuePayment> = {};
        const semesterIdsWithRegs = Object.keys(rawRegistrations);
    
        for (const semesterId of semesterIdsWithRegs) {
            if (!finalDuePayments[semesterId]) finalDuePayments[semesterId] = [];
            const semesterPayments = allDuePayments.filter(p => p.invoice.semesterId === semesterId);
    
            let firstUnpaidFound = false;
            for (const payment of semesterPayments) {
                let isPayableNow = false;
                let currentStatus = payment.status;
    
                if (currentStatus !== 'Paid' && !firstUnpaidFound) {
                    isPayableNow = true;
                    if (currentStatus === 'Upcoming') {
                        currentStatus = 'Due';
                    }
                    firstUnpaidFound = true;
                }
    
                finalDuePayments[semesterId].push({ ...payment, isPayable: isPayableNow, status: currentStatus });
            }
        }
    
        const newGroupedTransactions: GroupedData<Transaction> = {};
        for (const tx of rawTransactions) {
            const invoice = rawInvoices.find(inv => inv.invoiceId === tx.invoiceId);
            if (invoice) {
                if (!newGroupedTransactions[invoice.semesterId]) newGroupedTransactions[invoice.semesterId] = [];
                newGroupedTransactions[invoice.semesterId].push(tx);
            }
        }
    
        setGroupedDuePayments(finalDuePayments);
        setGroupedInvoices(newGroupedInvoices);
        setGroupedTransactions(newGroupedTransactions);
    
    }, [rawRegistrations, currentUser, rawInvoices, allPaymentPlans, rawTransactions, calendarEvents]);

    React.useEffect(() => {
        if (!currentUser) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                const [regsSnap, calendarSnap, coursesSnap, settingsSnap, invoicesSnap, semestersSnap, allTxSnap] = await Promise.all([
                    get(ref(db, `registrations/${currentUser.uid}`)),
                    get(ref(db, 'calendarEvents')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'settings')),
                    get(ref(db, `invoices/${currentUser.uid}`)),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'transactions'))
                ]);
                
                setRawRegistrations(regsSnap.val() || {});
                setCalendarEvents(calendarSnap.exists() ? Object.values(calendarSnap.val()) : []);
                setAllCourses(coursesSnap.val() || {});
                const settingsData = settingsSnap.val() || {};
                setAllPaymentPlans(settingsData.paymentPlans ? Object.values(settingsData.paymentPlans) : []);
                if (settingsData.institution) setInstitutionSettings(settingsData.institution);
                setRawInvoices(invoicesSnap.exists() ? Object.values(invoicesSnap.val()) : []);
                setSemesters(semestersSnap.exists() ? Object.values(semestersSnap.val()) : []);
                
                const userTransactions = Object.values(allTxSnap.exists() ? allTxSnap.val() : {}).filter((tx: any) => tx.userId === currentUser.uid);
                setRawTransactions(userTransactions as Transaction[]);

            } catch (e) {
                console.error("Failed to fetch payment data:", e);
                toast({ variant: 'destructive', title: "Error", description: "Could not load your payment information." });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, toast]);

    React.useEffect(() => {
        if (!loading) {
            processData();
        }
    }, [loading, processData]);
  
    const generateInvoicePDF = (invoice: Invoice) => {
        const doc = new jsPDF();
        const semester = semesters.find(s => s.id === invoice.semesterId);
        const plan = allPaymentPlans.find(p => p.name === invoice.paymentPlan) || { name: 'Full Payment', installments: 1, installmentPercentages: [100]};

        if (institutionSettings.logoUrl) doc.addImage(institutionSettings.logoUrl, 'PNG', 14, 15, 20, 20);
        doc.setFontSize(20); doc.text(institutionSettings.name, 40, 25);
        doc.setFontSize(12); doc.text('Student Invoice', 190, 25, { align: 'right' });
        doc.setFontSize(10);
        doc.text(`Student: ${userData?.name || ''} (${userData?.id || ''})`, 14, 40);
        doc.text(`Invoice ID: ${invoice.invoiceId}`, 190, 40, { align: 'right' });
        doc.text(`Date Issued: ${format(new Date(invoice.dateCreated), 'PPP')}`, 190, 45, { align: 'right' });
        doc.text(`Semester: ${invoice.semester}`, 14, 45);

        const courseItems = invoice.courses.map(id => [allCourses[id]?.code || 'N/A', `Tuition: ${allCourses[id]?.name || 'Unknown Course'}`, `ZMW ${(allCourses[id]?.cost || 0).toFixed(2)}`]);
        const mandatoryFeeItems = semester?.mandatoryFees ? Object.values(semester.mandatoryFees).map(fee => ['', `Mandatory Fee: ${fee.name}`, `ZMW ${(fee.amount || 0).toFixed(2)}`]) : [];
        const optionalFeeItems = semester?.optionalFees && invoice.optionalFees ? invoice.optionalFees.map(id => ['', `Optional Fee: ${semester.optionalFees[id]?.name || 'Unknown Fee'}`, `ZMW ${(semester.optionalFees[id]?.amount || 0).toFixed(2)}`]) : [];
        
        const body = [...courseItems, ...mandatoryFeeItems, ...optionalFeeItems];
        const totalAmount = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0);
        
        const foot: (string | number)[][] = [['', 'Subtotal', `ZMW ${totalAmount.toFixed(2)}`]];
        if(invoice.applyScholarship) {
            foot.push(['', 'Scholarship Waived', `(ZMW ${(invoice.totalTuition || 0).toFixed(2)})`]);
            foot.push(['', 'Total Due', `ZMW ${(totalAmount - (invoice.totalTuition || 0)).toFixed(2)}`]);
        } else {
            foot.push(['', 'Total Due', `ZMW ${totalAmount.toFixed(2)}`]);
        }
        
        const installmentBody = [];
        const payableAmount = totalAmount - (invoice.applyScholarship ? (invoice.totalTuition || 0) : 0);
        for (let i = 0; i < plan.installments; i++) {
            const percentage = plan.installmentPercentages?.[i] || (100 / plan.installments);
            const installmentAmount = payableAmount * (percentage / 100);
            const installmentName = plan.installments > 1 ? `${getOrdinalSuffix(i + 1)} Installment` : 'Full Payment';
            installmentBody.push([installmentName, `${percentage}%`, `ZMW ${installmentAmount.toFixed(2)}`]);
        }

        (doc as any).autoTable({ startY: 55, head: [['Course Code', 'Description', 'Amount']], body, foot, theme: 'striped', headStyles: { fillColor: [34, 34, 34] } });
        (doc as any).autoTable({
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Installment Plan', 'Percentage', 'Amount']],
            body: installmentBody,
            theme: 'grid'
        });

        doc.save(`invoice-${invoice.invoiceId}.pdf`);
    };

    const handleSuccessfulPayment = async (payment: DuePayment, paymentResponse: any) => {
        if (!currentUser) return;
        try {
            const transactionRef = push(ref(db, `transactions`));
            await set(transactionRef, {
                transactionId: paymentResponse.transaction_id,
                invoiceId: payment.invoice.invoiceId,
                userId: currentUser.uid,
                amount: paymentResponse.amount,
                currency: paymentResponse.currency,
                status: paymentResponse.status,
                paymentDate: new Date().toISOString(),
            });
            
            // Check if this payment completes the installment
            const newTotalPaid = payment.amountPaid + paymentResponse.amount;
            if (newTotalPaid >= payment.amountDue && payment.registration.status !== 'Completed') {
                await update(ref(db, `registrations/${currentUser.uid}/${payment.invoice.semesterId}`), {
                    status: 'Completed'
                });
                 await createNotification(
                    currentUser.uid,
                    `You are now fully enrolled for ${payment.invoice.semester}! Access to your courses has been granted.`,
                    '/student/classes'
                );
            }
    
            await createNotification(
                currentUser.uid,
                `Payment of ZMW ${paymentResponse.amount.toFixed(2)} for ${payment.installmentName} was successful.`,
                '/student/payments'
            );
    
            toast({ title: 'Payment Successful', description: 'Your payment has been recorded.' });
    
        } catch(error) {
            console.error("Error updating database after payment:", error);
            toast({ variant: 'destructive', title: "Update Error", description: "Payment was successful but records may not be updated. Contact support."});
        }
      }

    const handleCancelRegistration = async (payment: DuePayment) => {
        if (!currentUser) return;
        setActionLoading(true);
        try {
            await remove(ref(db, `invoices/${currentUser.uid}/${payment.invoice.invoiceId}`));
            await remove(ref(db, `registrations/${currentUser.uid}/${payment.invoice.semesterId}`));
            toast({ title: 'Registration Canceled', description: `Your registration for ${payment.invoice.semester} has been canceled.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Cancellation Failed'});
        } finally {
            setActionLoading(false);
        }
    };
  
    const statusVariant: { [key in DuePayment['status']]: 'destructive' | 'secondary' | 'default' | 'outline' } = {
        Due: 'secondary', Paid: 'default', Overdue: 'destructive', Upcoming: 'outline', 'Partially Paid': 'secondary',
    };
  
    const hasDuePayments = Object.values(groupedDuePayments).some(arr => arr.some(p => p.status !== 'Paid'));
    const semesterMap = semesters.reduce((acc, sem) => {
        acc[sem.id] = sem.name;
        return acc;
    }, {} as Record<string, string>);

    return (
        <div className="space-y-6">
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="font-headline text-2xl">Due Payments</CardTitle><CardDescription>View and pay your pending installments.</CardDescription></CardHeader>
            <CardContent>
            {loading ? ( <Skeleton className="h-24 w-full" /> ) :
            hasDuePayments ? (
                <Accordion type="multiple" defaultValue={Object.keys(groupedDuePayments).filter(key => groupedDuePayments[key].some(p => p.status !== 'Paid'))}>
                {Object.entries(groupedDuePayments).map(([semesterId, payments]) => {
                    const unpaidPayments = payments.filter(p => p.status !== 'Paid');
                    if (unpaidPayments.length === 0) return null;

                    return (
                    <AccordionItem value={semesterId} key={semesterId}>
                    <AccordionTrigger>{semesterMap[semesterId] || 'Semester'}</AccordionTrigger>
                    <AccordionContent>
                        {payments.some(p => p.invoice.applyScholarship && p.registration.status === 'Pending Approval') && (
                            <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200 text-blue-800">
                                <GraduationCap className="h-4 w-4 text-blue-700" /><AlertTitle className="text-blue-900">Scholarship Application Pending</AlertTitle><AlertDescription className="text-blue-700">Your scholarship application for this semester is under review. Payment obligations will be updated upon approval or denial.</AlertDescription></Alert>
                        )}
                        <Table>
                        <TableHeader><TableRow><TableHead>Installment</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount Due (ZMW)</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {payments.map((payment, index) => (
                                <Collapsible asChild key={index}>
                                    <>
                                    <TableRow>
                                        <TableCell className="font-medium">{payment.installmentName}</TableCell>
                                        <TableCell>{payment.dueDate ? format(parseISO(payment.dueDate), 'PPP') : 'N/A'}</TableCell>
                                        <TableCell><Badge variant={statusVariant[payment.status]}>{payment.status}</Badge></TableCell>
                                        <TableCell className="text-right font-medium">{payment.balance.toFixed(2)}</TableCell>
                                    </TableRow>
                                    {payment.isPayable && (
                                        <tr>
                                            <TableCell colSpan={4} className="p-0">
                                                 <PayNowSection 
                                                    payment={payment} 
                                                    userData={userData} 
                                                    onPaymentSuccess={handleSuccessfulPayment}
                                                />
                                            </TableCell>
                                        </tr>
                                    )}
                                    </>
                                </Collapsible>
                            ))}
                        </TableBody>
                        </Table>
                    </AccordionContent>
                    </AccordionItem>
                )})}
                </Accordion>
            ) : (
                <div className="text-center py-12">
                    <Banknote className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">All Clear!</h3>
                    <p className="mt-2 text-sm text-muted-foreground">You have no pending payments at the moment.</p>
                    <Button asChild className="mt-4"><Link href="/student/registration">Register for New Semester</Link></Button>
                </div>
            )}
            </CardContent>
        </Card>
      
        <Card className="shadow-lg">
           <Accordion type="single" collapsible>
            <AccordionItem value="history" className="border-b-0">
                <AccordionTrigger className="p-6">
                    <div className="flex items-center gap-3"><History className="h-6 w-6" /><h3 className="font-headline text-2xl">Invoice &amp; Transaction History</h3></div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 space-y-4">
                    {Object.keys(groupedInvoices).length > 0 ? (
                        <Accordion type="multiple" defaultValue={Object.keys(groupedInvoices)}>
                            {Object.entries(groupedInvoices).map(([semesterId, invoices]) => {
                                const semester = semesters.find(s => s.id === semesterId);
                                const plan = allPaymentPlans.find(p => p.name === invoices[0].paymentPlan) || { name: 'Full Payment', installments: 1, installmentPercentages: [100]};
                                const totalAmount = (invoices[0].totalTuition || 0) + (invoices[0].totalMandatoryFees || 0) + (invoices[0].totalOptionalFees || 0) + (invoices[0].lateFee || 0);
                                const payableAmount = totalAmount - (invoices[0].applyScholarship ? (invoices[0].totalTuition || 0) : 0);

                                return (
                                <AccordionItem value={semesterId} key={semesterId}>
                                    <AccordionTrigger className="font-semibold">{semesterMap[semesterId] || 'Semester'}</AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <Collapsible>
                                            <CollapsibleTrigger asChild>
                                                 <Button variant="link" className="p-0 h-auto text-sm">
                                                    View Invoice Details <ChevronDown className="h-4 w-4 ml-1" />
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                 <Table>
                                                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {invoices[0].totalTuition > 0 && <TableRow><TableCell>Total Tuition</TableCell><TableCell className="text-right">{invoices[0].totalTuition.toFixed(2)}</TableCell></TableRow>}
                                                        {semester?.mandatoryFees && Object.values(semester.mandatoryFees).map((fee, i) => (<TableRow key={`mand-${i}`}><TableCell>Mandatory Fee: {fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>))}
                                                        {semester?.optionalFees && (invoices[0].optionalFees || []).map(feeId => (<TableRow key={feeId}><TableCell>Optional Fee: {semester.optionalFees[feeId]?.name || "Unknown"}</TableCell><TableCell className="text-right">{(semester.optionalFees[feeId]?.amount || 0).toFixed(2)}</TableCell></TableRow>))}
                                                        {invoices[0].lateFee && invoices[0].lateFee > 0 && <TableRow className="text-destructive"><TableCell>Late Registration Fee</TableCell><TableCell className="text-right">{invoices[0].lateFee.toFixed(2)}</TableCell></TableRow>}
                                                        <TableRow className="font-bold bg-muted/50"><TableCell>Total Invoice Value</TableCell><TableCell className="text-right">ZMW {totalAmount.toFixed(2)}</TableCell></TableRow>
                                                        {invoices[0].applyScholarship && <TableRow className="font-bold text-blue-600"><TableCell>Scholarship Applied</TableCell><TableCell className="text-right">- ZMW {(invoices[0].totalTuition || 0).toFixed(2)}</TableCell></TableRow>}
                                                        <TableRow className="font-bold"><TableCell>Final Amount Due</TableCell><TableCell className="text-right">ZMW {payableAmount.toFixed(2)}</TableCell></TableRow>
                                                        <TableRow className="font-bold"><TableCell>Payment Plan</TableCell><TableCell className="text-right">{invoices[0].paymentPlan}</TableCell></TableRow>
                                                    </TableBody>
                                                </Table>
                                                <h4 className="font-semibold mt-4 mb-2">Installment Plan</h4>
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Installment</TableHead><TableHead>%</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {Array.from({length: plan.installments}).map((_, i) => {
                                                            const percentage = plan.installmentPercentages?.[i] || (100 / plan.installments);
                                                            const installmentAmount = payableAmount * (percentage / 100);
                                                            const installmentName = plan.installments > 1 ? `${getOrdinalSuffix(i + 1)} Installment` : 'Full Payment';
                                                            return (<TableRow key={i}><TableCell>{installmentName}</TableCell><TableCell>{percentage}%</TableCell><TableCell className="text-right">ZMW {installmentAmount.toFixed(2)}</TableCell></TableRow>)
                                                        })}
                                                    </TableBody>
                                                </Table>
                                                <Button variant="outline" size="sm" className="mt-4" onClick={() => generateInvoicePDF(invoices[0])}>
                                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                                </Button>
                                            </CollapsibleContent>
                                        </Collapsible>
                                        
                                        <h4 className="font-semibold pt-4">Transactions</h4>
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Transaction ID</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {groupedTransactions[semesterId] && groupedTransactions[semesterId].length > 0 ? (
                                                    groupedTransactions[semesterId].map((tx) => (
                                                        <TableRow key={tx.transactionId}>
                                                            <TableCell className="font-mono text-xs">{tx.transactionId}</TableCell>
                                                            <TableCell>{format(new Date(tx.paymentDate), 'PPP p')}</TableCell>
                                                            <TableCell className="text-right font-medium">{tx.amount.toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : <TableRow><TableCell colSpan={3} className="h-24 text-center">No transactions for this semester.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            )})}
                        </Accordion>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No history to display.</p>}
                </AccordionContent>
            </AccordionItem>
           </Accordion>
      </Card>
    </div>
  );
}
