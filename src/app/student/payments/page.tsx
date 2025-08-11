
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';


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
    coursePriority: string[];
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

type Fee = {
    id: string;
    name: string;
    amount: number;
};


type GroupedData<T> = Record<string, T[]>;

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
}

function PayNowSection({
    payment,
    userData,
    onPaymentSuccess,
    totalPaidForInvoice,
    allCourses,
    paymentPlan,
}: {
    payment: DuePayment,
    userData: UserData | null,
    onPaymentSuccess: (payment: DuePayment, response: any, amount: number) => Promise<void>,
    totalPaidForInvoice: number,
    allCourses: Record<string, Course>,
    paymentPlan: PaymentPlan | null,
}) {
    const [isPaying, setIsPaying] = React.useState(false);
    const [customAmount, setCustomAmount] = React.useState<number | string>('');

    const paymentAmount = Number(customAmount) > 0 ? Number(customAmount) : 0;
    const finalAmount = Math.min(paymentAmount, payment.balance);
    const cumulativePaidAfterThisPayment = totalPaidForInvoice + finalAmount;

    const { paymentAllocation, unlockedCourses } = React.useMemo(() => {
        if (!paymentPlan || !payment.invoice) return { paymentAllocation: [], unlockedCourses: [] };
    
        const allocation: { item: string, allocatedAmount: number }[] = [];
        const unlocked: Course[] = [];
        let paymentLeftToAllocate = finalAmount;
    
        const totalFees = (payment.invoice.totalMandatoryFees || 0) + (payment.invoice.totalOptionalFees || 0);
        let feesPaidSoFar = Math.min(totalPaidForInvoice, totalFees);
        let tuitionPaidSoFar = Math.max(0, totalPaidForInvoice - feesPaidSoFar);
    
        // 1. Allocate payment to remaining fees first
        const remainingFees = totalFees - feesPaidSoFar;
        if (remainingFees > 0) {
            const amountToAllocate = Math.min(paymentLeftToAllocate, remainingFees);
            if (amountToAllocate > 0) {
                allocation.push({ item: 'Semester Fees', allocatedAmount: amountToAllocate });
                paymentLeftToAllocate -= amountToAllocate;
            }
        }
    
        // 2. Allocate remaining to tuition, respecting course priority
        for (const courseId of payment.registration.coursePriority) {
            if (paymentLeftToAllocate <= 0) break;
            const course = allCourses[courseId];
            if (course) {
                const remainingOnCourse = course.cost - tuitionPaidSoFar;
                if(remainingOnCourse > 0) {
                    const amountToAllocate = Math.min(paymentLeftToAllocate, remainingOnCourse);
                     if (amountToAllocate > 0) {
                        allocation.push({ item: `Tuition: ${course.name}`, allocatedAmount: amountToAllocate });
                        paymentLeftToAllocate -= amountToAllocate;
                        tuitionPaidSoFar += amountToAllocate;
                    }
                }
            }
        }
    
        // Determine unlocked courses based on cumulative payment
        let cumulativeTuitionPaid = Math.max(0, cumulativePaidAfterThisPayment - totalFees);
        for (const courseId of payment.registration.coursePriority) {
            const course = allCourses[courseId];
            if (course) {
                if (cumulativeTuitionPaid >= course.cost) {
                    unlocked.push(course);
                    cumulativeTuitionPaid -= course.cost;
                } else {
                    break; 
                }
            }
        }
    
        return { paymentAllocation: allocation, unlockedCourses };
    }, [finalAmount, totalPaidForInvoice, payment, allCourses, paymentPlan]);


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
                 {customAmount > 0 && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-md text-sm space-y-2">
                        <h4 className="font-semibold">Payment Allocation & Unlocked Courses</h4>
                         <div className="space-y-1 text-xs">
                            <p className="font-bold">Your payment of ZMW {finalAmount.toFixed(2)} will be allocated as follows:</p>
                            <ul className="list-disc pl-5">
                                {paymentAllocation.length > 0 ? paymentAllocation.map((alloc, i) => (
                                    <li key={i}>ZMW {alloc.allocatedAmount.toFixed(2)} towards {alloc.item}</li>
                                )) : <li>-</li>}
                            </ul>
                        </div>
                        <Separator/>
                         <div className="space-y-1 text-xs">
                            <p className="font-bold">Courses unlocked after this payment:</p>
                             <ul className="list-disc pl-5 text-green-600 font-medium">
                                {unlockedCourses.length > 0 ? unlockedCourses.map(c => <li key={c.id}>{c.name} ({c.code})</li>) : <li>No new courses fully unlocked.</li>}
                            </ul>
                        </div>
                    </div>
                )}
                 <Button className="w-full mt-4" onClick={() => {
                    setIsPaying(true);
                    handleFlutterwavePayment({
                        callback: async (response) => {
                            if (response.status === 'successful') {
                                await onPaymentSuccess(payment, response, finalAmount);
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
            
            const totalTuition = invoice.totalTuition || 0;
            const totalFees = (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0);
            
            const plan = allPaymentPlans.find(p => p.name === invoice.paymentPlan) || { name: 'Full Payment', installments: 1, installmentPercentages: [100]};
            const semesterTransactions = rawTransactions.filter(t => t.invoiceId === invoice.invoiceId);
            let totalPaidForInvoice = semesterTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

            const tuitionPerInstallment = totalTuition / (plan.installments || 1);

            for (let i = 0; i < plan.installments; i++) {
                const installmentName = plan.installments > 1 ? `${getOrdinalSuffix(i + 1)} Installment` : 'Full Payment';
                const deadlineTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${invoice.semester}`;
                const deadlineEvent = calendarEvents.find(e => e.title.trim() === deadlineTitle.trim());

                let amountDueForThis = tuitionPerInstallment;
                if(i === 0) { // All fees due on first installment
                    amountDueForThis += totalFees;
                }
                 if(invoice.applyScholarship) {
                    amountDueForThis = i === 0 ? totalFees : 0;
                }

                const paidForThis = Math.min(totalPaidForInvoice, amountDueForThis);
                const balance = Math.max(0, amountDueForThis - paidForThis);

                let status: DuePayment['status'] = 'Upcoming';
                const today = new Date(); today.setHours(0,0,0,0);
                const dueDate = deadlineEvent ? parseISO(deadlineEvent.date) : null;

                if (balance <= 0.01) status = 'Paid';
                else if (paidForThis > 0) status = 'Partially Paid';
                else if (dueDate && isBefore(dueDate, today)) status = 'Overdue';

                allDuePayments.push({ installmentName, dueDate: deadlineEvent?.date || null, amountDue: amountDueForThis, amountPaid: paidForThis, balance, status, invoice, isPayable: false, registration: reg });
                totalPaidForInvoice = Math.max(0, totalPaidForInvoice - amountDueForThis);
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

    const fetchDataForSemester = React.useCallback(async (user: User, uData: UserData) => {
         const [regsSnap, invoicesSnap, allTxSnap] = await Promise.all([
            get(ref(db, `registrations/${user.uid}`)),
            get(ref(db, `invoices/${user.uid}`)),
            get(ref(db, 'transactions'))
        ]);

        setRawRegistrations(regsSnap.val() || {});
        setRawInvoices(invoicesSnap.exists() ? Object.values(invoicesSnap.val()) : []);
        const userTransactions = Object.values(allTxSnap.exists() ? allTxSnap.val() : {}).filter((tx: any) => tx.userId === user.uid);
        setRawTransactions(userTransactions as Transaction[]);
    }, []);

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

    const handleSuccessfulPayment = async (payment: DuePayment, paymentResponse: any, amount: number) => {
        if (!currentUser) return;
        setActionLoading(true);
        try {
            const transactionRef = push(ref(db, `transactions`));
            await set(transactionRef, {
                transactionId: paymentResponse.transaction_id,
                invoiceId: payment.invoice.invoiceId,
                userId: currentUser.uid,
                amount: amount,
                currency: paymentResponse.currency,
                status: paymentResponse.status,
                paymentDate: new Date().toISOString(),
                semesterId: payment.invoice.semesterId,
            });

             await fetchDataForSemester(currentUser, userData!);

            toast({ title: 'Payment Successful', description: 'Your payment has been recorded and course access updated.' });

        } catch(error) {
            console.error("Error updating database after payment:", error);
            toast({ variant: 'destructive', title: "Update Error", description: "Payment was successful but records may not be updated. Contact support."});
        } finally {
            setActionLoading(false);
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

    const generateInvoicePDF = (invoice: Invoice) => {
        const semester = semesters.find(s => s.id === invoice.semesterId);
        if (!semester) return;

        const doc = new jsPDF();
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
        const optionalFeeItems = semester?.optionalFees && invoice.optionalFees ? invoice.optionalFees.map(id => ['', `Optional Fee: ${semester.optionalFees![id]?.name || 'Unknown Fee'}`, `ZMW ${(semester.optionalFees![id]?.amount || 0).toFixed(2)}`]) : [];
        
        const body = [...courseItems, ...mandatoryFeeItems, ...optionalFeeItems];
        const totalAmount = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0);
        
        const foot: (string | number)[][] = [['', 'Subtotal', `ZMW ${totalAmount.toFixed(2)}`]];
        if(invoice.applyScholarship) {
            foot.push(['', 'Scholarship Waived', `(ZMW ${(invoice.totalTuition || 0).toFixed(2)})`]);
            foot.push(['', 'Total Due', `ZMW ${(totalAmount - (invoice.totalTuition || 0)).toFixed(2)}`]);
        } else {
            foot.push(['', 'Total Due', `ZMW ${totalAmount.toFixed(2)}`]);
        }
        
        (doc as any).autoTable({ startY: 55, head: [['Course Code', 'Description', 'Amount']], body, foot, theme: 'striped', headStyles: { fillColor: [34, 34, 34] } });
        
        doc.save(`invoice-${invoice.invoiceId}.pdf`);
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

                    const totalPaidForInvoice = rawTransactions
                        .filter(t => t.invoiceId === payments[0]?.invoice.invoiceId)
                        .reduce((sum, tx) => sum + tx.amount, 0);

                    const paymentPlan = allPaymentPlans.find(p => p.name === payments[0]?.invoice.paymentPlan) || null;
                    const invoice = payments[0]?.invoice;

                    return (
                    <AccordionItem value={semesterId} key={semesterId}>
                    <AccordionTrigger>{semesterMap[semesterId] || 'Semester'}</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        {invoice && (
                            <Card className="bg-background">
                                <CardHeader>
                                    <CardTitle className="text-base">Invoice Summary</CardTitle>
                                    <CardDescription>This is a summary of all charges for this semester.</CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span>Tuition Fees:</span>
                                        <span>ZMW {(invoice.totalTuition || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Mandatory Fees:</span>
                                        <span>ZMW {(invoice.totalMandatoryFees || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Optional Fees:</span>
                                        <span>ZMW {(invoice.totalOptionalFees || 0).toFixed(2)}</span>
                                    </div>
                                    {invoice.lateFee && invoice.lateFee > 0 && (
                                        <div className="flex justify-between text-destructive">
                                            <span>Late Registration Fee:</span>
                                            <span>ZMW {invoice.lateFee.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <Separator className="my-2"/>
                                    <div className="flex justify-between font-bold">
                                        <span>Total Invoice Value:</span>
                                        <span>ZMW {((invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0)).toFixed(2)}</span>
                                    </div>
                                    {invoice.applyScholarship && (
                                        <div className="flex justify-between font-bold text-blue-600">
                                            <span>Scholarship Waived:</span>
                                            <span>- ZMW {(invoice.totalTuition || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                        <Table>
                        <TableHeader><TableRow><TableHead>Installment</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount Due (ZMW)</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {payments.map((payment, index) => (
                                <Collapsible asChild key={index}>
                                    <>
                                        <TableRow data-state={payment.isPayable ? 'open' : 'closed'} >
                                            <TableCell className="font-medium">
                                                <CollapsibleTrigger asChild>
                                                    <div className="flex items-center gap-2 cursor-pointer">
                                                        {payment.installmentName} {payment.isPayable && <ChevronDown className="h-4 w-4"/>}
                                                    </div>
                                                </CollapsibleTrigger>
                                            </TableCell>
                                            <TableCell>{payment.dueDate ? format(parseISO(payment.dueDate), 'PPP') : 'N/A'}</TableCell>
                                            <TableCell><Badge variant={statusVariant[payment.status]}>{payment.status}</Badge></TableCell>
                                            <TableCell className="text-right font-medium">{payment.balance.toFixed(2)}</TableCell>
                                        </TableRow>
                                        <CollapsibleContent asChild>
                                            <tr className="bg-muted/30 hover:bg-muted/50">
                                                <TableCell colSpan={4} className="p-4">
                                                    {payment.isPayable && (
                                                        <PayNowSection
                                                        payment={payment}
                                                        userData={userData}
                                                        onPaymentSuccess={handleSuccessfulPayment}
                                                        totalPaidForInvoice={totalPaidForInvoice}
                                                        allCourses={allCourses}
                                                        paymentPlan={paymentPlan}
                                                        />
                                                    )}
                                                </TableCell>
                                            </tr>
                                        </CollapsibleContent>
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
                                const invoiceDetails = invoices[0];
                                const totalAmount = (invoiceDetails.totalTuition || 0) + (invoiceDetails.totalMandatoryFees || 0) + (invoiceDetails.totalOptionalFees || 0) + (invoiceDetails.lateFee || 0);
                                const payableAmount = totalAmount - (invoiceDetails.applyScholarship ? (invoiceDetails.totalTuition || 0) : 0);

                                return (
                                <AccordionItem value={semesterId} key={semesterId}>
                                    <AccordionTrigger className="font-semibold">{semesterMap[semesterId] || 'Semester'}</AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                        <Collapsible>
                                            <CollapsibleTrigger asChild>
                                                 <Button variant="link" className="p-0 h-auto text-sm mb-2">
                                                    View Invoice Details <ChevronDown className="h-4 w-4 ml-1" />
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                 <Table>
                                                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {invoiceDetails.courses.map(id => allCourses[id]).filter(Boolean).map(course => (<TableRow key={course.id}><TableCell>Tuition: {course.name} ({course.code})</TableCell><TableCell className="text-right">{course.cost.toFixed(2)}</TableCell></TableRow>))}
                                                        {semester?.mandatoryFees && Object.values(semester.mandatoryFees).map((fee, i) => (<TableRow key={`mand-${i}`}><TableCell>Mandatory Fee: {fee.name}</TableCell><TableCell className="text-right">{fee.amount.toFixed(2)}</TableCell></TableRow>))}
                                                        {semester?.optionalFees && (invoiceDetails.optionalFees || []).map(feeId => (<TableRow key={feeId}><TableCell>Optional Fee: {semester.optionalFees[feeId]?.name || "Unknown"}</TableCell><TableCell className="text-right">{(semester.optionalFees[feeId]?.amount || 0).toFixed(2)}</TableCell></TableRow>))}
                                                        {invoiceDetails.lateFee && invoiceDetails.lateFee > 0 && <TableRow className="text-destructive"><TableCell>Late Registration Fee</TableCell><TableCell className="text-right">{invoiceDetails.lateFee.toFixed(2)}</TableCell></TableRow>}
                                                        <TableRow className="font-bold bg-muted/50"><TableCell>Total Invoice Value</TableCell><TableCell className="text-right">ZMW {totalAmount.toFixed(2)}</TableCell></TableRow>
                                                        {invoiceDetails.applyScholarship && <TableRow className="font-bold text-blue-600"><TableCell>Scholarship Applied</TableCell><TableCell className="text-right">- ZMW {(invoiceDetails.totalTuition || 0).toFixed(2)}</TableCell></TableRow>}
                                                        <TableRow className="font-bold"><TableCell>Final Amount Due</TableCell><TableCell className="text-right">ZMW {payableAmount.toFixed(2)}</TableCell></TableRow>
                                                        <TableRow className="font-bold"><TableCell>Payment Plan</TableCell><TableCell className="text-right">{invoiceDetails.paymentPlan}</TableCell></TableRow>
                                                    </TableBody>
                                                </Table>
                                                <Button variant="outline" size="sm" className="mt-4" onClick={() => generateInvoicePDF(invoiceDetails)}>
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
