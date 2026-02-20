'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    Search, 
    Download, 
    DollarSign, 
    PlusCircle, 
    Users, 
    PiggyBank, 
    Scale, 
    Trash2, 
    ChevronsUpDown, 
    Info, 
    X, 
    History, 
    Mail, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    CalendarDays, 
    TrendingUp, 
    Filter,
    Calendar as CalendarIcon,
    Receipt,
    Printer,
    ChevronDown,
    FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, set, push, onValue } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, startOfDay } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/hooks/use-auth';
import type { DateRange } from 'react-day-picker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// --- TYPE DEFINITIONS ---
type StudentPaymentInfo = {
    userId: string;
    studentId: string;
    studentName: string;
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'Paid' | 'Pending' | 'Overdue';
    programmeId: string | null;
    intakeId: string | null;
    semesterId: string | null;
    invoiceId: string;
    enrolledCourses: string[];
    thresholdMet: boolean;
    paidPercentage: number;
    requiredThreshold: number;
};

type Transaction = {
    key: string;
    transactionId: string;
    invoiceId?: string;
    userId: string;
    amount: number;
    paymentDate: string;
    status: 'successful' | 'failed';
    method?: string;
    comment?: string;
    semesterName?: string;
    semesterId?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentThreshold?: number; gracePeriodDays?: number; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

// --- MAIN PAGE COMPONENT ---
export default function PaymentsManagementPage() {
    const { userProfile: userData } = useAuth();
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [allStudents, setAllStudents] = React.useState<StudentInfo[]>([]);
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [courses, setCourses] = React.useState<Record<string, any>>({});
    const [allInvoices, setAllInvoices] = React.useState<Record<string, any>>({});
    
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [timeFilter, setTimeFilter] = React.useState<'today' | 'week' | 'month' | 'period' | 'all'>('today');
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>();

    // States for Record Payment Dialog
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
    const [selectedStudent, setSelectedStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [paymentAmount, setPaymentAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState('Cash');
    const [transactionId, setTransactionId] = React.useState('');

    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);

    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, intakesSnap, invoicesSnap, coursesSnap, financialSnap, plansSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes')),
                get(ref(db, 'invoices')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/financialSettings')),
                get(ref(db, 'settings/paymentPlans'))
            ]);
            
            const users = usersSnap.val() || {};
            const registrations = regsSnap.val() || {};
            const transactionsData = transactionsSnap.val() || {};
            const allSemestersData = semestersSnap.val() || {};
            const allInvoicesData = invoicesSnap.val() || {};
            const fSettings = financialSnap.val() || { paymentThreshold: 75 };

            setAllInvoices(allInvoicesData);
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(allSemestersData).map(id => ({ id, ...allSemestersData[id]})));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (coursesSnap.exists()) setCourses(coursesSnap.val());
            if (plansSnap.exists()) setAllPaymentPlans(Object.keys(plansSnap.val()).map(id => ({ id, ...plansSnap.val()[id] })));

            const studentList: StudentInfo[] = [];
            for (const uid in users) {
                if (users[uid].role?.toLowerCase() === 'student') {
                    studentList.push({ uid, id: users[uid].id, name: users[uid].name, intakeId: users[uid].intakeId });
                }
            }
            setAllStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));

            const transactionsList: Transaction[] = [];
            for (const txId in transactionsData) {
                const tx = transactionsData[txId];
                if(tx.status !== 'successful') continue;

                const userId = tx.userId;
                const userRegs = registrations[userId] || {};
                const semesterId = Object.keys(userRegs).find(sid => userRegs[sid].invoiceId === tx.invoiceId);
                const semesterInfo = semesterId ? allSemestersData[semesterId] : null;

                transactionsList.push({
                    key: txId,
                    ...tx,
                    semesterId,
                    semesterName: semesterInfo?.name,
                });
            }
            setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));

            const studentPaymentMap: Record<string, StudentPaymentInfo> = {};
            const globalThreshold = fSettings.paymentThreshold || 75;

            for (const userId in registrations) {
                 const user = users[userId];
                 if (!user || user.role?.toLowerCase() !== 'student') continue;

                 for (const semesterId in registrations[userId]) {
                    const reg = registrations[userId][semesterId];
                    const semesterInfo = allSemestersData[semesterId];
                    if (!semesterInfo) continue;

                    const key = `${userId}-${semesterId}`;
                    const invoice = allInvoicesData[userId]?.[reg.invoiceId];

                    if (invoice) {
                        const totalPayable = invoice.applyScholarship 
                            ? (Number(invoice.totalMandatoryFees || 0) + Number(invoice.totalOptionalFees || 0))
                            : (Number(invoice.totalTuition || 0) + Number(invoice.totalMandatoryFees || 0) + Number(invoice.totalOptionalFees || 0));

                        const userTransactions = transactionsList.filter(t => t.userId === userId && t.invoiceId === reg.invoiceId);
                        const totalPaid = userTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                        const balance = Math.max(0, totalPayable - totalPaid);
                        
                        const threshold = semesterInfo.paymentThreshold || globalThreshold;
                        const paidPercentage = totalPayable > 0 ? (totalPaid / totalPayable) * 100 : 100;
                        const thresholdMet = paidPercentage >= threshold;

                        studentPaymentMap[key] = {
                            userId,
                            studentId: user.id,
                            studentName: user.name,
                            totalDue: totalPayable,
                            totalPaid,
                            balance,
                            programmeId: reg.programmeId,
                            intakeId: semesterInfo.intakeId || null,
                            semesterId,
                            invoiceId: reg.invoiceId,
                            enrolledCourses: reg.courses || [],
                            thresholdMet,
                            paidPercentage,
                            requiredThreshold: threshold,
                            status: balance <= 0.01 ? 'Paid' : 'Pending'
                        };
                    }
                 }
            }
            setPaymentInfos(Object.values(studentPaymentMap));

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    }, [toast, allPaymentPlans.length]);

    React.useEffect(() => {
        fetchPaymentData();
    }, [fetchPaymentData]);

    const globalAuditStats = React.useMemo(() => {
        const now = new Date();
        const startDay = startOfDay(now);
        const startWeek = startOfWeek(now, { weekStartsOn: 1 });
        const endWeek = endOfWeek(now, { weekStartsOn: 1 });
        const startMonth = startOfMonth(now);
        const endMonth = endOfMonth(now);

        const currentSemesterIds = new Set(semesters.filter(s => {
            if (!s.startDate || !s.endDate) return false;
            return isWithinInterval(now, { start: parseISO(s.startDate), end: parseISO(s.endDate) });
        }).map(s => s.id));

        return rawTransactions.reduce((acc, tx) => {
            const date = parseISO(tx.paymentDate);
            const amount = Number(tx.amount) || 0;

            if (isToday(date)) acc.today += amount;
            if (isWithinInterval(date, { start: startWeek, end: endWeek })) acc.week += amount;
            if (isWithinInterval(date, { start: startMonth, end: endMonth })) acc.month += amount;
            if (tx.semesterId && currentSemesterIds.has(tx.semesterId)) acc.currentSemester += amount;
            
            acc.total += amount;
            return acc;
        }, { today: 0, week: 0, month: 0, currentSemester: 0, total: 0 });
    }, [rawTransactions, semesters]);

    const filteredTransactions = React.useMemo(() => {
        return rawTransactions.filter(tx => {
            const date = parseISO(tx.paymentDate);
            switch(timeFilter) {
                case 'today': return isToday(date);
                case 'week': return isWithinInterval(date, { start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: endOfWeek(new Date(), { weekStartsOn: 1 }) });
                case 'month': return isWithinInterval(date, { start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
                case 'period': return customRange?.from && customRange?.to ? isWithinInterval(date, { start: customRange.from, end: customRange.to }) : true;
                default: return true;
            }
        });
    }, [rawTransactions, timeFilter, customRange]);

    const filteredData = React.useMemo(() => {
        const uidsInPeriod = new Set(filteredTransactions.map(t => t.userId));
        const isGroupingFilterActive = programmeFilter !== 'all' || semesterFilter !== 'all' || intakeFilter !== 'all';
        
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const semesterMatch = semesterFilter === 'all' || p.semesterId === semesterFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            const timeMatch = timeFilter === 'all' || isGroupingFilterActive || uidsInPeriod.has(p.userId);

            return searchMatch && programmeMatch && semesterMatch && intakeMatch && timeMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter, intakeFilter, filteredTransactions, timeFilter]);

    const handleRecordPaymentDialog = async () => {
        if(!selectedStudent || !paymentAmount || !paymentMethod) {
            toast({ variant: 'destructive', title: 'Missing fields' });
            return;
        }
        setFormLoading(true);
        try {
            const amount = parseFloat(paymentAmount);
            const txRef = push(ref(db, 'transactions'));
            const txId = transactionId.trim() || `CASH-${Date.now()}-${txRef.key?.slice(-4)}`;
            
            await set(txRef, {
                transactionId: txId,
                userId: selectedStudent.userId,
                invoiceId: selectedStudent.invoiceId,
                amount: amount,
                currency: 'ZMW',
                status: 'successful',
                paymentDate: new Date().toISOString(),
                method: paymentMethod,
                recordedBy: userData?.name || 'Accountant',
            });

            toast({ variant: 'success', title: "Payment Recorded", description: `ZMW ${amount.toFixed(2)} credited to ${selectedStudent.studentName}.` });
            setIsRecordPaymentOpen(false);
            setSelectedStudent(null);
            setPaymentAmount('');
            setTransactionId('');
            
            await fetchPaymentData();
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Recording Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    }

    const handlePrintStatement = async (semId: string, data: any) => {
        if (!historyStudent) return;
        const studentUid = historyStudent.userId;
        
        // Find correct invoice for this semester
        const semesterPaymentInfo = paymentInfos.find(p => p.userId === studentUid && p.semesterId === semId);
        const targetInvoice = allInvoices[studentUid]?.[semesterPaymentInfo?.invoiceId || ''];

        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("Statement of Account", 14, 22);
        
        doc.setFontSize(10);
        doc.text(`Student: ${historyStudent.studentName} (${historyStudent.studentId})`, 14, 32);
        doc.text(`Semester: ${data.semesterName}`, 14, 37);
        doc.text(`Date Generated: ${format(new Date(), 'PPP p')}`, 14, 42);

        if (targetInvoice) {
            const tuition = Number(targetInvoice.totalTuition || 0);
            const mandatory = Number(targetInvoice.totalMandatoryFees || 0);
            const optional = Number(targetInvoice.totalOptionalFees || 0);
            const late = Number(targetInvoice.lateFee || 0);
            const scholarships = targetInvoice.applyScholarship ? tuition : 0;

            const invoiceItems = [
                ['Tuition Fees', tuition.toFixed(2)],
                ['Mandatory Fees', mandatory.toFixed(2)],
                ['Optional Fees', optional.toFixed(2)],
                ['Late Registration Fee', late.toFixed(2)],
                ['Scholarship Waiver', `(${scholarships.toFixed(2)})`],
                ['TOTAL PAYABLE', data.totalDue.toFixed(2)]
            ];

            autoTable(doc, {
                startY: 50,
                head: [['Fee Description', 'Amount (ZMW)']],
                body: invoiceItems,
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80] },
                styles: { fontSize: 9 }
            });
        }

        const transactionRows = data.transactions.map((t: any) => [
            format(parseISO(t.paymentDate), 'dd MMM yyyy'),
            t.transactionId,
            t.method || 'Online',
            t.amount.toFixed(2)
        ]);

        const paid = data.transactions.reduce((s: number, t: any) => s + t.amount, 0);
        const balance = data.totalDue - paid;

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Date', 'Transaction ID', 'Method', 'Paid (ZMW)']],
            body: transactionRows,
            foot: [['', '', 'TOTAL PAID', `ZMW ${paid.toFixed(2)}`], ['', '', 'OUTSTANDING BALANCE', `ZMW ${balance.toFixed(2)}`]],
            theme: 'striped',
            headStyles: { fillColor: [44, 62, 80] },
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { fontSize: 9 }
        });

        doc.save(`Statement_${historyStudent.studentId}_${data.semesterName.replace(/\s+/g, '_')}.pdf`);
    };

    const handleExport = () => {
        const doc = new jsPDF();
        const head = [["ID", "Name", "Semester", "Total Expected", "Paid", "Balance", "Threshold"]];
        const body = filteredData.map(p => [
            p.studentId, p.studentName,
            semesters.find(s => s.id === p.semesterId)?.name || 'N/A',
            p.totalDue.toFixed(2), p.totalPaid.toFixed(2), p.balance.toFixed(2),
            p.thresholdMet ? 'Met' : 'Below'
        ]);
        doc.text("Student Payments & Threshold Audit", 14, 22);
        autoTable(doc, { head, body, startY: 30 });
        doc.save(`finance_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const historyByAcademicPeriod = React.useMemo(() => {
        if (!historyStudent) return {};
        const studentTransactions = rawTransactions.filter(t => t.userId === historyStudent.userId);
        const grouped: Record<string, { semesterName: string; year: number; totalDue: number; transactions: Transaction[] }> = {};

        paymentInfos.filter(p => p.userId === historyStudent.userId).forEach(info => {
            const sem = semesters.find(s => s.id === info.semesterId);
            if (sem) {
                grouped[sem.id] = {
                    semesterName: sem.name,
                    year: sem.year,
                    totalDue: info.totalDue,
                    transactions: studentTransactions.filter(t => t.semesterId === sem.id)
                };
            }
        });

        return grouped;
    }, [historyStudent, rawTransactions, paymentInfos, semesters]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div>
                        <CardTitle className="font-headline text-2xl">Financial Audit Center</CardTitle>
                        <CardDescription>Global institutional revenue tracking and compliance monitoring.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Today</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent><div className="text-xl font-black text-green-600">ZMW {globalAuditStats.today.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">This Week</CardTitle>
                                <TrendingUp className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent><div className="text-xl font-black text-primary">ZMW {globalAuditStats.week.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">This Month</CardTitle>
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-xl font-black">ZMW {globalAuditStats.month.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Semesters</CardTitle>
                                <Receipt className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent><div className="text-xl font-black text-primary">ZMW {globalAuditStats.currentSemester.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Paid</CardTitle>
                                <PiggyBank className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent><div className="text-xl font-black">ZMW {globalAuditStats.total.toFixed(2)}</div></CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Student Financial Audit</CardTitle>
                            <CardDescription>Verify payment compliance against semester totals.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl border bg-muted/10 items-end">
                        <div className="w-48">
                            <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Activity Period</Label>
                            <Select value={timeFilter} onValueChange={val => setTimeFilter(val as any)}>
                                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Paid Today</SelectItem>
                                    <SelectItem value="week">Paid This Week</SelectItem>
                                    <SelectItem value="month">Paid This Month</SelectItem>
                                    <SelectItem value="period">Custom Range</SelectItem>
                                    <Separator className="my-1"/>
                                    <SelectItem value="all">Full Audit List</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {timeFilter === 'period' && (
                            <div className="w-64 animate-in fade-in slide-in-from-left-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Date Range</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start h-9 text-xs font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {customRange?.from ? (customRange.to ? `${format(customRange.from, "LLL dd")} - ${format(customRange.to, "LLL dd")}` : format(customRange.from, "LLL dd")) : "Pick dates"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={customRange} onSelect={setCustomRange} numberOfMonths={2}/></PopoverContent>
                                </Popover>
                            </div>
                        )}
                        <div className="w-48">
                            <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Cohort Filter</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="All Intakes"/></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8 h-9 shadow-sm" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {loading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="rounded-md border shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>System ID</TableHead>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead className="text-right">Semester Total Due</TableHead>
                                        <TableHead className="text-right">Amount Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="text-center">Threshold</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((info) => (
                                        <TableRow key={`${info.userId}-${info.semesterId}`} className="group hover:bg-muted/30">
                                            <TableCell className="font-mono text-[10px] font-black opacity-60">{info.studentId}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm">{info.studentName}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{semesters.find(s=>s.id===info.semesterId)?.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm">ZMW {info.totalDue.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-black text-sm text-destructive">ZMW {info.balance.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">
                                                {info.balance <= 0.01 ? <Badge variant="default" className="bg-green-600 uppercase text-[9px]">Settled</Badge> : (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Badge variant={info.thresholdMet ? "secondary" : "destructive"} className="uppercase text-[9px] gap-1 cursor-pointer hover:scale-105 transition-transform">
                                                                {info.thresholdMet ? <CheckCircle2 className="h-2 w-2"/> : <AlertTriangle className="h-2 w-2"/>}
                                                                {info.thresholdMet ? "Met" : "Below"}
                                                            </Badge>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-4">
                                                            <div className="space-y-3">
                                                                <h4 className="font-black uppercase text-[10px] tracking-widest text-primary">Compliance Calculation</h4>
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-xs"><span>Total Due:</span> <span className="font-bold">ZMW {info.totalDue.toFixed(2)}</span></div>
                                                                    <div className="flex justify-between text-xs"><span>Total Paid:</span> <span className="font-bold text-green-600">ZMW {info.totalPaid.toFixed(2)}</span></div>
                                                                    <div className="flex justify-between text-xs pt-1 border-t"><span>Paid Level:</span> <span className="font-bold">{info.paidPercentage.toFixed(1)}%</span></div>
                                                                    <div className="flex justify-between text-xs"><span>Required:</span> <span className="font-bold text-primary">{info.requiredThreshold}%</span></div>
                                                                </div>
                                                                {!info.thresholdMet && (
                                                                    <Alert className="bg-destructive/10 border-destructive/20 py-2">
                                                                        <AlertDescription className="text-[10px] text-destructive leading-tight font-bold uppercase italic">Student is currently blocked from critical portal features.</AlertDescription>
                                                                    </Alert>
                                                                )}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }} title="Full History">
                                                        <History className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedStudent(info); setIsRecordPaymentOpen(true); }} title="Record Payment">
                                                        <PlusCircle className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Record Payment Dialog */}
            <Dialog open={isRecordPaymentOpen} onOpenChange={(o) => { if(!o) setSelectedStudent(null); setIsRecordPaymentOpen(o); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record Payment: {selectedStudent?.studentName}</DialogTitle>
                        <DialogDescription>Apply manual credit to ID: {selectedStudent?.studentId}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1">
                            <Label>Amount (ZMW)</Label>
                            <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" className="font-bold text-lg h-12" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Method</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="Bank Deposit">Bank Deposit</SelectItem>
                                        <SelectItem value="Transfer">Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Ref #</Label>
                                <Input value={transactionId} onChange={e => setTransactionId(e.target.value.toUpperCase())} placeholder="REF ID" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordPaymentDialog} disabled={formLoading || !paymentAmount}>
                            {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Record Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{historyStudent?.studentName.charAt(0)}</div>
                            <div>
                                <DialogTitle>Academic Financial History</DialogTitle>
                                <DialogDescription>{historyStudent?.studentName} ({historyStudent?.studentId})</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <ScrollArea className="flex-1 my-4 pr-4">
                        <Accordion type="multiple" defaultValue={Object.keys(historyByAcademicPeriod)} className="space-y-4">
                            {Object.entries(historyByAcademicPeriod).map(([semId, data]) => {
                                const totalPaid = data.transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
                                const balance = Math.max(0, data.totalDue - totalPaid);
                                const studentUid = historyStudent?.userId || '';
                                const invoiceId = paymentInfos.find(p => p.userId === studentUid && p.semesterId === semId)?.invoiceId;
                                const invoice = allInvoices[studentUid]?.[invoiceId || ''];
                                
                                return (
                                    <AccordionItem key={semId} value={semId} className="border rounded-xl overflow-hidden bg-card shadow-sm">
                                        <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/20">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-4 gap-2">
                                                <div className="text-left">
                                                    <span className="font-bold text-sm">{data.semesterName}</span>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Year {data.year}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Balance</p>
                                                        <p className={cn("text-xs font-black", balance > 0 ? "text-destructive" : "text-green-600")}>ZMW {balance.toFixed(2)}</p>
                                                    </div>
                                                    <Badge variant={balance <= 0 ? "default" : "outline"} className="h-5 text-[8px] uppercase">{balance <= 0 ? "Settled" : "Outstanding"}</Badge>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 pt-4 space-y-6">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                        <FileText className="h-3 w-3" /> Invoiced Fees & Tuition
                                                    </h4>
                                                    <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
                                                        {invoice ? (
                                                            <>
                                                                {(invoice.courses || []).map((cid: string) => (
                                                                    <div key={cid} className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground truncate mr-2">Tuition: {courses[cid]?.name}</span>
                                                                        <span className="font-mono">ZMW {courses[cid]?.cost?.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                                <Separator className="opacity-50" />
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-muted-foreground">Mandatory Fees:</span>
                                                                    <span className="font-mono text-xs font-bold">ZMW {Number(invoice.totalMandatoryFees || 0).toFixed(2)}</span>
                                                                </div>
                                                                {Number(invoice.totalOptionalFees || 0) > 0 && (
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Optional Fees:</span>
                                                                        <span className="font-mono text-xs font-bold">ZMW {Number(invoice.totalOptionalFees || 0).toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                {Number(invoice.lateFee || 0) > 0 && (
                                                                    <div className="flex justify-between text-xs text-destructive">
                                                                        <span>Late Registration:</span>
                                                                        <span className="font-mono text-xs font-bold">ZMW {Number(invoice.lateFee || 0).toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                {invoice.applyScholarship && (
                                                                    <div className="flex justify-between text-xs text-green-600 italic">
                                                                        <span>Scholarship Waiver:</span>
                                                                        <span className="font-mono text-xs font-bold">-(ZMW {Number(invoice.totalTuition || 0).toFixed(2)})</span>
                                                                    </div>
                                                                )}
                                                                <Separator />
                                                                <div className="flex justify-between text-sm font-black pt-1">
                                                                    <span>Semester Total:</span>
                                                                    <span>ZMW {data.totalDue.toFixed(2)}</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground italic py-2">Invoice details not found for this period.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                            <History className="h-3 w-3" /> Payment Ledger
                                                        </h4>
                                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] font-black uppercase text-primary" onClick={() => handlePrintStatement(semId, data)}>
                                                            <Printer className="h-3 w-3 mr-1"/> Download Statement
                                                        </Button>
                                                    </div>
                                                    <div className="rounded-lg border bg-background shadow-inner">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="hover:bg-transparent">
                                                                    <TableHead className="text-[10px] font-black uppercase h-8">Date</TableHead>
                                                                    <TableHead className="text-[10px] font-black uppercase h-8">Method</TableHead>
                                                                    <TableHead className="text-right text-[10px] font-black uppercase h-8">Amount</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {data.transactions.length > 0 ? data.transactions.map(tx => (
                                                                    <TableRow key={tx.key} className="hover:bg-transparent border-none">
                                                                        <TableCell className="py-1.5 text-[10px] text-muted-foreground">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                                        <TableCell className="py-1.5"><Badge variant="outline" className="text-[8px] uppercase h-4 px-1">{tx.method || 'Online'}</Badge></TableCell>
                                                                        <TableCell className="py-1.5 text-right font-black text-[10px]">ZMW {tx.amount.toFixed(2)}</TableCell>
                                                                    </TableRow>
                                                                )) : (
                                                                    <TableRow>
                                                                        <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground italic">No payments recorded.</TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                            })}
                            {Object.keys(historyByAcademicPeriod).length === 0 && (
                                <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                    <History className="h-10 w-10 mx-auto opacity-10 mb-2"/>
                                    <p className="text-sm">No historical financial records available.</p>
                                </div>
                            )}
                        </Accordion>
                    </ScrollArea>
                    
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Close Statement</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}