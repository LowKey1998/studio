'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    Search, 
    Download, 
    DollarSign, 
    PlusCircle, 
    History, 
    X, 
    ChevronDown, 
    Calendar as CalendarIcon, 
    Printer, 
    PencilLine, 
    Calculator, 
    UserPlus, 
    Percent, 
    Save, 
    Trash2, 
    Check, 
    Plus,
    FileText,
    ArrowRight,
    TrendingUp,
    Receipt,
    CalendarDays,
    AlertTriangle,
    CheckCircle2,
    Settings2,
    ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, set, push, onValue, serverTimestamp } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays, isAfter } from 'date-fns';
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
import { Textarea } from '@/components/ui/textarea';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

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
    effectiveDeadline: Date | null;
    planName: string;
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
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

const timeToMinutes = (time: string) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

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
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [institutionSettings, setInstitutionSettings] = React.useState({ name: 'Edutrack360', logoUrl: '' });
    
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [timeFilter, setTimeFilter] = React.useState<'today' | 'week' | 'month' | 'period' | 'all'>('today');
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>();

    // Single Record Form
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
    const [paymentSelectedUserId, setPaymentSelectedUserId] = React.useState('');
    const [paymentSelectedYear, setPaymentSelectedYear] = React.useState('');
    const [paymentSelectedSemInYear, setPaymentSelectedSemInYear] = React.useState('');
    const [paymentSelectedSemesterId, setPaymentSelectedSemesterId] = React.useState('');
    const [paymentAmount, setPaymentAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState('Cash');
    const [paymentComment, setPaymentComment] = React.useState('');
    const [dialogSearchTerm, setDialogSearchTerm] = React.useState('');
    const [manualTotalDue, setManualTotalDue] = React.useState('');
    const [dateReceived, setDateReceived] = React.useState<Date | undefined>(new Date());

    // Bulk Manual State
    const [isBulkManualOpen, setIsBulkManualOpen] = React.useState(false);
    const [bulkEntries, setBulkEntries] = React.useState<any[]>([{ id: `row-${Date.now()}`, studentId: '', amount: '', method: 'Cash', date: new Date(), studentUid: null, studentName: '' }]);
    const [bulkGlobalMethod, setBulkGlobalMethod] = React.useState('Cash');
    const [bulkGlobalDate, setBulkGlobalDate] = React.useState<Date | undefined>(new Date());

    // Request Student
    const [isRequestStudentOpen, setIsRequestStudentOpen] = React.useState(false);
    const [requestMessage, setRequestMessage] = React.useState('');
    const [requestTemplate, setRequestTemplate] = React.useState({ subject: 'New Student Account Request', body: 'Please create a new student account for:\n\nName: \nProgramme: \nIntake: \n\nReason: Recording initial fees.' });

    // History & Edit
    const [isEditRequestOpen, setIsEditRequestOpen] = React.useState(false);
    const [editRequestType, setEditRequestType] = React.useState<'transaction' | 'invoice'>('transaction');
    const [editTargetId, setEditTargetId] = React.useState('');
    const [oldValue, setOldValue] = React.useState(0);
    const [newValue, setNewValue] = React.useState('');
    const [editReason, setEditReason] = React.useState('');
    const [editStudentInfo, setEditStudentInfo] = React.useState<{uid:string, id:string, name:string} | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    
    const [formLoading, setFormLoading] = React.useState(false);
    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, intakesSnap, invoicesSnap, coursesSnap, financialSnap, plansSnap, eventsSnap, templateSnap, calendarSnap, institutionSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes')),
                get(ref(db, 'invoices')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/financialSettings')),
                get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'calendarEvents')),
                get(ref(db, 'settings/requestStudentTemplate')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'settings/institution')),
            ]);
            
            const users = usersSnap.val() || {};
            const registrations = regsSnap.val() || {};
            const transactionsData = transactionsSnap.val() || {};
            const allSemestersData = semestersSnap.val() || {};
            const allInvoicesData = invoicesSnap.val() || {};
            const fSettings = financialSnap.val() || { paymentThreshold: 75, defaulterRestrictions: {} };
            const calendarEvents = Object.values(eventsSnap.val() || {}) as any[];
            const plans = plansSnap.val() || {};

            setCalendarSettings(calendarSnap.val() || {});
            setAllInvoices(allInvoicesData);
            setFinancialSettings(fSettings);
            if (institutionSnap.exists()) setInstitutionSettings(institutionSnap.val());
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(allSemestersData).map(id => ({ id, ...allSemestersData[id]})));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (coursesSnap.exists()) setCourses(coursesSnap.val());
            if (plansSnap.exists()) setAllPaymentPlans(Object.keys(plansSnap.val()).map(id => ({ id, ...plansSnap.val()[id] })));
            if (templateSnap.exists()) setRequestTemplate(templateSnap.val());

            const studentList: StudentInfo[] = [];
            for (const uid in users) {
                if (users[uid].role?.toLowerCase() === 'student') {
                    studentList.push({ uid, id: users[uid].id, name: users[uid].name, intakeId: users[uid].intakeId, programmeId: users[uid].programmeId });
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
                transactionsList.push({ key: txId, ...tx, semesterId, semesterName: semesterInfo?.name });
            }
            setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));

            const studentPaymentMap: Record<string, StudentPaymentInfo> = {};
            const now = new Date();

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
                        const paidPercentage = totalPayable > 0 ? (totalPaid / totalPayable) * 100 : 100;

                        let currentRequiredThreshold = 0;
                        const plan = Object.values(plans).find((p: any) => p.name === invoice.paymentPlan) as any;
                        if (plan && plan.installmentPercentages) {
                            for (let i = 0; i < plan.installments; i++) {
                                const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterInfo.name}`;
                                const deadlineEvent = calendarEvents.find(e => e.title?.trim() === title.trim());
                                if (deadlineEvent) {
                                    const grace = semesterInfo.gracePeriodDays || 0;
                                    const deadlineDate = addDays(parseISO(deadlineEvent.date), grace);
                                    if (isAfter(now, deadlineDate)) currentRequiredThreshold += (plan.installmentPercentages[i] || 0);
                                }
                            }
                        }

                        const thresholdMet = paidPercentage >= currentRequiredThreshold;
                        const semDeadlines = calendarEvents.filter((ev: any) => ev.semester === semesterInfo.name && ev.title.includes('Deadline')).sort((a: any, b: any) => a.date.localeCompare(b.date));
                        const nextDeadlineDate = semDeadlines.length > 0 ? parseISO(semDeadlines[0].date) : null;
                        const grace = semesterInfo.gracePeriodDays || 0;
                        const effectiveDeadline = nextDeadlineDate ? addDays(nextDeadlineDate, grace) : null;

                        studentPaymentMap[key] = {
                            userId, studentId: user.id, studentName: user.name, totalDue: totalPayable, totalPaid, balance,
                            programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId, invoiceId: reg.invoiceId,
                            enrolledCourses: reg.courses || [], thresholdMet, paidPercentage, requiredThreshold: currentRequiredThreshold,
                            status: balance <= 0.01 ? 'Paid' : 'Pending', effectiveDeadline, planName: invoice.paymentPlan || 'Standard'
                        };
                    }
                 }
            }
            setPaymentInfos(Object.values(studentPaymentMap));
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed to load data' }); } 
        finally { setLoading(false); }
    }, [toast]);

    React.useEffect(() => { fetchPaymentData(); }, [fetchPaymentData]);

    const handleAddBulkRow = () => {
        setBulkEntries(prev => [...prev, { id: `row-${Date.now()}`, studentId: '', amount: '', method: bulkGlobalMethod, date: bulkGlobalDate, studentUid: null, studentName: '' }]);
    };

    const handleBulkRowUpdate = (rowId: string, field: string, value: any) => {
        setBulkEntries(prev => prev.map(row => {
            if (row.id === rowId) {
                const updated = { ...row, [field]: value };
                if (field === 'studentId') {
                    const student = allStudents.find(s => s.id === value.trim().toUpperCase());
                    updated.studentUid = student?.uid || null;
                    updated.studentName = student?.name || '';
                }
                return updated;
            }
            return row;
        }));
    };

    const handleApplyGlobalToBulk = () => {
        setBulkEntries(prev => prev.map(row => ({ ...row, method: bulkGlobalMethod, date: bulkGlobalDate })));
        toast({ title: "Globals Applied" });
    };

    const handleConfirmBulkManual = async () => {
        const validRows = bulkEntries.filter(row => row.studentUid && row.amount > 0 && row.date);
        if (validRows.length === 0) {
            toast({ variant: 'destructive', title: 'No valid rows to save.' });
            return;
        }
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            for (const row of validRows) {
                const studentPayments = paymentInfos.filter(p => p.userId === row.studentUid);
                const info = studentPayments[0]; 
                if (!info) continue;

                const txRef = push(ref(db, 'transactions'));
                const txId = `BULK-${Date.now()}-${txRef.key?.slice(-4)}`;
                updates[`transactions/${txRef.key}`] = {
                    transactionId: txId,
                    userId: row.studentUid,
                    invoiceId: info.invoiceId,
                    amount: parseFloat(row.amount),
                    status: 'successful',
                    paymentDate: format(row.date, 'yyyy-MM-dd'),
                    recordedAt: serverTimestamp(),
                    method: row.method,
                    recordedBy: userData?.name || 'Accountant',
                };
            }
            await update(ref(db), updates);
            toast({ variant: 'success', title: 'Bulk Payments Saved', description: `Successfully recorded ${validRows.length} payments.` });
            setIsBulkManualOpen(false);
            setBulkEntries([{ id: `row-${Date.now()}`, studentId: '', amount: '', method: 'Cash', date: new Date(), studentUid: null, studentName: '' }]);
            fetchPaymentData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Batch failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const globalAuditStats = React.useMemo(() => {
        const now = new Date();
        const startWeek = startOfWeek(now, { weekStartsOn: 1 });
        const endWeek = endOfWeek(now, { weekStartsOn: 1 });
        const startMonth = startOfMonth(now);
        const endMonth = endOfMonth(now);
        const currentSemesterIds = new Set(semesters.filter(s => s.startDate && s.endDate && isWithinInterval(now, { start: parseISO(s.startDate), end: parseISO(s.endDate) })).map(s => s.id));

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

    const filteredData = React.useMemo(() => {
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const semesterMatch = semesterFilter === 'all' || p.semesterId === semesterFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            return searchMatch && programmeMatch && semesterMatch && intakeMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter, intakeFilter]);

    const handleRecordPaymentDialog = async () => {
        const student = allStudents.find(s => s.uid === paymentSelectedUserId);
        const semester = semesters.find(s => s.id === paymentSelectedSemesterId);
        if(!student || !semester || !paymentAmount || !dateReceived) { toast({ variant: 'destructive', title: 'Missing fields' }); return; }

        setFormLoading(true);
        const amount = parseFloat(paymentAmount);
        const info = paymentInfos.find(p => p.userId === paymentSelectedUserId && p.semesterId === paymentSelectedSemesterId);
        const updates: Record<string, any> = {};
        let targetInvoiceId = info?.invoiceId;

        if (!info) {
            const invRef = push(ref(db, `invoices/${student.uid}`));
            targetInvoiceId = invRef.key!;
            updates[`invoices/${student.uid}/${targetInvoiceId}`] = {
                invoiceId: targetInvoiceId, semester: semester.name, semesterId: semester.id, dateCreated: new Date().toISOString(),
                totalTuition: manualTotalDue ? parseFloat(manualTotalDue) : 0, totalMandatoryFees: 0, totalOptionalFees: 0
            };
            updates[`registrations/${student.uid}/${semester.id}`] = { status: 'Completed', semesterName: semester.name, registrationDate: new Date().toISOString(), programmeId: student.programmeId || '', intakeId: student.intakeId, invoiceId: targetInvoiceId, courses: [] };
        } else if (info.totalDue <= 0 && manualTotalDue) {
            updates[`invoices/${info.userId}/${info.invoiceId}/totalTuition`] = parseFloat(manualTotalDue);
        }

        const txRef = push(ref(db, 'transactions'));
        updates[`transactions/${txRef.key}`] = {
            transactionId: `CASH-${Date.now()}-${txRef.key?.slice(-4)}`, userId: student.uid, invoiceId: targetInvoiceId,
            amount, currency: 'ZMW', status: 'successful', paymentDate: format(dateReceived, 'yyyy-MM-dd'),
            recordedAt: serverTimestamp(), method: paymentMethod, comment: paymentComment, recordedBy: userData?.name || 'Accountant',
        };

        try {
            await update(ref(db), updates);
            toast({ variant: 'success', title: "Payment Recorded" });
            setIsRecordPaymentOpen(false);
            resetDialog();
            fetchPaymentData();
        } catch(e: any) { toast({ variant:'destructive', title:'Error', description: e.message }); }
        finally { setFormLoading(false); }
    };

    const resetDialog = () => {
        setPaymentSelectedUserId(''); setPaymentSelectedYear(''); setPaymentSelectedSemInYear(''); setPaymentSelectedSemesterId('');
        setPaymentAmount(''); setPaymentMethod('Cash'); setPaymentComment(''); setDialogSearchTerm(''); setManualTotalDue(''); setDateReceived(new Date());
    };

    const uniqueStudentsForDialog = React.useMemo(() => {
        const lower = dialogSearchTerm.toLowerCase();
        return allStudents.filter(s => s.name.toLowerCase().includes(lower) || s.id.toLowerCase().includes(lower));
    }, [allStudents, dialogSearchTerm]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md"><DollarSign className="h-6 w-6 text-white"/></div>
                        <div><CardTitle className="font-headline text-2xl">Financial Audit Center</CardTitle><CardDescription>Global institutional revenue tracking and compliance monitoring.</CardDescription></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Today</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-green-600">ZMW {globalAuditStats.today.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Week</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-primary">ZMW {globalAuditStats.week.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Month</CardTitle></CardHeader><CardContent><div className="text-xl font-black">ZMW {globalAuditStats.month.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Active Term</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-primary">ZMW {globalAuditStats.currentSemester.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-xl font-black">ZMW {globalAuditStats.total.toFixed(2)}</div></CardContent></Card>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4">
                <Button onClick={() => setIsRecordPaymentOpen(true)} size="lg" className="shadow-lg h-12 font-bold"><PlusCircle className="mr-2 h-5 w-5"/> Record Single Payment</Button>
                <Button variant="outline" onClick={() => setIsBulkManualOpen(true)} size="lg" className="shadow-lg h-12 font-bold"><PlusCircle className="mr-2 h-5 w-5"/> Batch Manual Entry</Button>
            </div>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div><CardTitle>Financial Audit List</CardTitle><CardDescription>Real-time threshold monitoring and payment compliance.</CardDescription></div>
                        <div className="flex flex-wrap gap-2">
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Cohort"/></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8 h-10 w-64" placeholder="Student ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {loading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>System ID</TableHead>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead className="text-right">Total Due</TableHead>
                                        <TableHead className="text-right">Amount Paid</TableHead>
                                        <TableHead className="text-right text-destructive">Balance</TableHead>
                                        <TableHead className="text-center">Threshold</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((info) => (
                                        <TableRow key={`${info.userId}-${info.semesterId}`} className="group hover:bg-muted/20 transition-colors">
                                            <TableCell className="font-mono text-xs opacity-60">{info.studentId}</TableCell>
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
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Badge variant={info.thresholdMet ? "secondary" : "destructive"} className="uppercase text-[9px] gap-1 cursor-pointer">
                                                            {info.thresholdMet ? <CheckCircle2 className="h-2 w-2"/> : <AlertTriangle className="h-2 w-2"/>}
                                                            {info.thresholdMet ? "Met" : "Below"}
                                                        </Badge>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-80 p-4">
                                                        <h4 className="text-xs font-bold uppercase mb-2">Compliance Audit</h4>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between"><span>Required:</span> <span className="font-bold">{info.requiredThreshold}%</span></div>
                                                            <div className="flex justify-between"><span>Actual Paid:</span> <span className="font-bold">{info.paidPercentage.toFixed(1)}%</span></div>
                                                            <Separator className="my-2"/>
                                                            <p className="font-bold uppercase text-[10px] text-primary">Active Restrictions</p>
                                                            <div className="space-y-1 pt-1">
                                                                <div className="flex justify-between opacity-70"><span>Reg. Block</span> {financialSettings?.defaulterRestrictions?.registration && !info.thresholdMet ? <AlertTriangle className="h-3 w-3 text-red-500"/> : <Check className="h-3 w-3 text-green-500"/>}</div>
                                                                <div className="flex justify-between opacity-70"><span>Grade Block</span> {financialSettings?.defaulterRestrictions?.results && !info.thresholdMet ? <AlertTriangle className="h-3 w-3 text-red-500"/> : <Check className="h-3 w-3 text-green-500"/>}</div>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }}><History className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bulk Manual Dialog */}
            <Dialog open={isBulkManualOpen} onOpenChange={setIsBulkManualOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Batch Manual Payment Recording</DialogTitle>
                        <DialogDescription>Record multiple physical payments or bank entries in one session.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
                        <div className="flex flex-wrap items-end gap-4 p-4 border rounded-xl bg-muted/20">
                            <div className="w-48 space-y-1"><Label className="text-xs">Batch Method</Label>
                                <Select value={bulkGlobalMethod} onValueChange={setBulkGlobalMethod}><SelectTrigger className="h-9"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Deposit">Bank Deposit</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                            </div>
                            <div className="w-48 space-y-1"><Label className="text-xs">Batch Date</Label>
                                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start h-9 text-xs"><CalendarIcon className="mr-2 h-4 w-4"/>{bulkGlobalDate ? format(bulkGlobalDate, 'dd MMM') : 'Pick Date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={bulkGlobalDate} onSelect={setBulkGlobalDate} initialFocus/></PopoverContent></Popover>
                            </div>
                            <Button variant="secondary" size="sm" className="h-9 font-bold" onClick={handleApplyGlobalToBulk}><Save className="mr-2 h-4 w-4"/> Apply Globals</Button>
                            <Separator orientation="vertical" className="h-9" />
                            <Button variant="outline" size="sm" className="h-9 font-bold" onClick={handleAddBulkRow}><Plus className="mr-2 h-4 w-4"/> Add Another Entry</Button>
                        </div>
                        <ScrollArea className="flex-1 border rounded-lg">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10"><TableRow><TableHead>Student ID</TableHead><TableHead>Verified Student</TableHead><TableHead className="w-32">Amount (ZMW)</TableHead><TableHead className="w-40">Method</TableHead><TableHead className="w-40">Date</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {bulkEntries.map((row, index) => (
                                        <TableRow key={row.id} className={cn(!row.studentUid && row.studentId && "bg-red-50")}>
                                            <TableCell><Input value={row.studentId} onChange={e => handleBulkRowUpdate(row.id, 'studentId', e.target.value.toUpperCase())} placeholder="STU-XXX" className="h-8 font-mono text-xs uppercase"/></TableCell>
                                            <TableCell>{row.studentUid ? <div className="flex flex-col"><span className="text-xs font-bold">{row.studentName}</span><span className="text-[9px] text-green-600 font-black uppercase">Verified</span></div> : <span className="text-xs text-muted-foreground italic">Pending ID...</span>}</TableCell>
                                            <TableCell><Input type="number" value={row.amount} onChange={e => handleBulkRowUpdate(row.id, 'amount', e.target.value)} className="h-8 text-xs"/></TableCell>
                                            <TableCell>
                                                <Select value={row.method} onValueChange={v => handleBulkRowUpdate(row.id, 'method', v)}><SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Deposit">Bank Deposit</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                                            </TableCell>
                                            <TableCell>
                                                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full h-8 text-[10px] px-2 justify-start"><CalendarIcon className="mr-1 h-3 w-3"/>{row.date ? format(row.date, 'dd MMM') : 'Set Date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={row.date} onSelect={d => handleBulkRowUpdate(row.id, 'date', d)} initialFocus/></PopoverContent></Popover>
                                            </TableCell>
                                            <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveBulkRow(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsBulkManualOpen(false)}>Discard Session</Button>
                        <Button onClick={handleConfirmBulkManual} disabled={formLoading}>
                            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                            Record {bulkEntries.filter(r => r.studentUid && r.amount > 0).length} Payments
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Single Record Dialog */}
            <Dialog open={isRecordPaymentOpen} onOpenChange={(o) => { if(!o) resetDialog(); setIsRecordPaymentOpen(o); }}>
                <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Manual Credit Entry</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">1. Select Student</Label>
                            <Select value={paymentSelectedUserId} onValueChange={setPaymentSelectedUserId}>
                                <SelectTrigger><SelectValue placeholder="Find student..." /></SelectTrigger>
                                <SelectContent>
                                    <div className="p-2 border-b"><div className="relative"><Search className="h-4 w-4 absolute left-2 top-2.5"/><Input placeholder="Filter..." className="pl-8 h-8" value={dialogSearchTerm} onChange={e => setDialogSearchTerm(e.target.value)} onKeyDown={e => e.stopPropagation()}/></div></div>
                                    <ScrollArea className="h-64">{uniqueStudentsForDialog.map(s => <SelectItem key={s.uid} value={s.uid}>{s.name} ({s.id})</SelectItem>)}</ScrollArea>
                                </SelectContent>
                            </Select>
                            {paymentSelectedUserId && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">2. Target Period</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Select value={paymentSelectedYear} onValueChange={setPaymentSelectedYear}><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select>
                                        <Select value={paymentSelectedSemInYear} onValueChange={setPaymentSelectedSemInYear} disabled={!paymentSelectedYear}><SelectTrigger><SelectValue placeholder="Sem"/></SelectTrigger><SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4 pt-4 border-t">
                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">3. Payment Details</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <Popover><PopoverTrigger asChild><Button variant="outline" className="h-10 text-xs justify-start"><CalendarIcon className="mr-2 h-4 w-4"/>{dateReceived ? format(dateReceived, 'PPP') : 'Date Received'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateReceived} onSelect={setDateReceived} initialFocus/></PopoverContent></Popover>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Deposit">Bank Deposit</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                            </div>
                            <div className="space-y-1"><Label>Amount Paid (ZMW)</Label><Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" className="h-12 text-lg font-bold" /></div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordPaymentDialog} disabled={!paymentAmount || !paymentSelectedSemesterId || formLoading}>
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Save className="h-4 w-4 mr-2"/>} Record
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
