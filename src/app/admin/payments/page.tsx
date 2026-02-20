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
    Calendar as CalendarIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, set, push, onValue } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
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
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentThreshold?: number; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

type OptionGroup = { groupName: string; items: { value: string; label: string }[] };

// --- HELPERS ---
function SearchableSelect({ options, value, onValueChange, placeholder, disabled = false }: {
    options: OptionGroup[];
    value: string | undefined;
    onValueChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filteredOptions = React.useMemo(() => {
        if (!search) return options;
        const lowerCaseSearch = search.toLowerCase();
        return options.map(group => ({
            ...group,
            items: group.items.filter(item => item.label.toLowerCase().includes(lowerCaseSearch))
        })).filter(group => group.items.length > 0);
    }, [options, search]);

    const selectedLabel = React.useMemo(() => {
        if (!value) return placeholder;
        for (const group of options) {
            const foundItem = group.items.find(item => item.value === value);
            if (foundItem) return foundItem.label;
        }
        return placeholder;
    }, [value, options, placeholder]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={disabled}>
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" side="bottom" align="start">
                <div className="p-2">
                    <Input 
                        placeholder="Search..." 
                        className="h-9" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>
                <Separator />
                <ScrollArea className="h-[200px]">
                    <div className="p-1">
                    {filteredOptions.length > 0 ? filteredOptions.map(group => (
                        <div key={group.groupName} className="p-1">
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.groupName}</div>
                            {group.items.map(option => (
                                <Button
                                    key={option.value}
                                    variant="ghost"
                                    className="w-full justify-start h-auto py-2 px-2 text-left"
                                    onClick={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                        setSearch('');
                                    }}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    )) : <p className="p-2 text-center text-sm text-muted-foreground">No results found.</p>}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

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
            const allInvoices = invoicesSnap.val() || {};
            const fSettings = financialSnap.val() || { paymentThreshold: 75 };

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
                    const invoice = allInvoices[userId]?.[reg.invoiceId];

                    if (invoice) {
                        const totalPayable = invoice.applyScholarship 
                            ? (Number(invoice.totalMandatoryFees || 0) + Number(invoice.totalOptionalFees || 0))
                            : (Number(invoice.totalTuition || 0) + Number(invoice.totalMandatoryFees || 0) + Number(invoice.totalOptionalFees || 0));

                        const userTransactions = transactionsList.filter(t => t.userId === userId && t.invoiceId === reg.invoiceId);
                        const totalPaid = userTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                        const balance = Math.max(0, totalPayable - totalPaid);
                        
                        const threshold = semesterInfo.paymentThreshold || globalThreshold;
                        const thresholdMet = totalPayable > 0 ? (totalPaid / totalPayable) * 100 >= threshold : true;

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
    }, [toast]); // Removed 'semesters' from dependency array to break potential loop

    React.useEffect(() => {
        fetchPaymentData();
    }, [fetchPaymentData]);

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

    const summaryStats = React.useMemo(() => {
        const stats = filteredData.reduce((acc, p) => {
            acc.totalDue += Number(p.totalDue) || 0;
            acc.totalPaid += Number(p.totalPaid) || 0;
            acc.totalBalance += Number(p.balance) || 0;
            return acc;
        }, { totalDue: 0, totalPaid: 0, totalBalance: 0 });
        
        const periodCollected = filteredTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        return { ...stats, periodCollected };
    }, [filteredData, filteredTransactions]);

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
            
            await fetchPaymentData();
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Recording Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    }

    const handleExport = () => {
        const doc = new jsPDF();
        const head = [["ID", "Name", "Semester", "Due", "Paid", "Balance", "Threshold"]];
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

    const statusBadge = (info: StudentPaymentInfo) => {
        if (info.status === 'Paid') return <Badge variant="default" className="bg-green-600 uppercase text-[9px]">Fully Paid</Badge>;
        if (!info.thresholdMet) return <Badge variant="destructive" className="uppercase text-[9px] gap-1"><AlertTriangle className="h-2 w-2"/> Below Threshold</Badge>;
        return <Badge variant="secondary" className="uppercase text-[9px]">Active Payment</Badge>;
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div>
                        <CardTitle className="font-headline text-2xl">Financial Audit Center</CardTitle>
                        <CardDescription>Comprehensive oversight of institutional revenue and student financial standing.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Period Revenue</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-green-600">ZMW {summaryStats.periodCollected.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Paid (All Time)</CardTitle>
                                <PiggyBank className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black">ZMW {summaryStats.totalPaid.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Receivables</CardTitle>
                                <Scale className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-destructive">ZMW {summaryStats.totalBalance.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Profiles</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-primary">{filteredData.length}</div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Student Financial Status</CardTitle>
                            <CardDescription>Audit payment reliability and threshold compliance.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl border bg-muted/10 items-end">
                        <div className="w-48">
                            <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Time Period</Label>
                            <Select value={timeFilter} onValueChange={val => setTimeFilter(val as any)}>
                                <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Paid Today</SelectItem>
                                    <SelectItem value="week">Paid This Week</SelectItem>
                                    <SelectItem value="month">Paid This Month</SelectItem>
                                    <SelectItem value="period">Custom Range</SelectItem>
                                    <Separator className="my-1"/>
                                    <SelectItem value="all">Full List (Audit Mode)</SelectItem>
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
                            <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Intake</Label>
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
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="text-right">Amount Paid</TableHead>
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
                                            <TableCell className="text-right font-black text-sm">ZMW {info.balance.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">{statusBadge(info)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }} title="History">
                                                        <History className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedStudent(info); setIsRecordPaymentOpen(true); }} title="Record">
                                                        <PlusCircle className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center text-muted-foreground italic">
                                                    <Info className="h-8 w-8 mb-2 opacity-20" />
                                                    <p className="text-sm font-medium">No results found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

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

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Statement: {historyStudent?.studentName}</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-auto border rounded-xl my-4">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 border-b">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Method</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rawTransactions.filter(t => t.userId === historyStudent?.userId).map(tx => (
                                    <TableRow key={tx.key}>
                                        <TableCell className="text-xs font-medium">{format(parseISO(tx.paymentDate), 'dd MMM yyyy HH:mm')}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[9px] uppercase font-black">{tx.method || 'Online'}</Badge></TableCell>
                                        <TableCell className="text-right font-black text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
