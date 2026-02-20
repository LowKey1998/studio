
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download, DollarSign, PlusCircle, Users, PiggyBank, Scale, Trash2, ChevronsUpDown, Link as LinkIcon, Info, X, History, Mail, CheckCircle2, Clock, AlertTriangle, CalendarDays, TrendingUp, BookOpen, UserCheck, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, push, set, remove, onValue } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isSameDay } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

type PaymentRecord = {
    key: number;
    isUnlinked?: boolean;
    reference?: string;
    userId?: string;
    semesterId?: string;
    invoiceId?: string;
    totalDue?: string; 
    totalPaid?: number;
    amount: string;
    comment: string;
};

type UnlinkedPayment = {
    id: string;
    reference: string;
    amount: number;
    comment: string;
    date: string;
    semesterId?: string;
    totalDue?: number;
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
    academicStanding?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; mandatoryFees?: Record<string, Fee>; optionalFees?: Record<string, Fee>; paymentThreshold?: number; gracePeriodDays?: number; };
type Fee = { id: string; name: string; amount: number; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; };

type OptionGroup = { groupName: string; items: { value: string; label: string }[] };

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
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [unlinkedPayments, setUnlinkedPayments] = React.useState<UnlinkedPayment[]>([]);
    const [allStudents, setAllStudents] = React.useState<StudentInfo[]>([]);
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [courses, setCourses] = React.useState<Record<string, any>>({});
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [timeFilter, setTimeFilter] = React.useState<'today' | 'week' | 'month' | 'period' | 'all'>('today');
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>();

    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);

    const [isLinkingOpen, setIsLinkingOpen] = React.useState(false);
    const [linkingPayment, setLinkingPayment] = React.useState<UnlinkedPayment | null>(null);
    const [selectedLinkStudent, setSelectedLinkStudent] = React.useState('');
    const [linkResolution, setLinkResolution] = React.useState<'partial' | 'overwrite'>('partial');

    const { toast } = useToast();

    React.useEffect(() => {
        const offsetRef = ref(db, '.info/serverTimeOffset');
        onValue(offsetRef, (snap) => {
            setServerTimeOffset(snap.val() || 0);
        });
    }, []);

    const getCurrentServerDate = () => new Date(Date.now() + serverTimeOffset);

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, unlinkedSnap, intakesSnap, calendarSnap, invoicesSnap, coursesSnap, financialSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'unlinkedPayments')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'invoices')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/financialSettings'))
            ]);
            
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id]})));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (calendarSnap.exists()) setCalendarSettings(calendarSnap.val());
            if (coursesSnap.exists()) setCourses(coursesSnap.val());
            if (financialSnap.exists()) setFinancialSettings(financialSnap.val());

            if (unlinkedSnap.exists()) {
                setUnlinkedPayments(Object.entries(unlinkedSnap.val()).map(([id, data]) => ({ id, ...(data as any) })));
            } else {
                setUnlinkedPayments([]);
            }

            const users = usersSnap.val() || {};
            const allInvoices = invoicesSnap.val() || {};
            const studentList: StudentInfo[] = [];
            for (const uid in users) {
                if (users[uid].role === 'Student') {
                    studentList.push({ uid, id: users[uid].id, name: users[uid].name, intakeId: users[uid].intakeId });
                }
            }
            setAllStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));

            const registrations = regsSnap.val() || {};
            const transactionsData = transactionsSnap.val() || {};
            const allSemestersData = semestersSnap.val() || {};
            
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
                    academicStanding: semesterInfo ? `Y${semesterInfo.year}S${semesterInfo.semesterInYear}` : undefined
                });
            }
            setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));

            const studentPaymentMap: Record<string, StudentPaymentInfo> = {};
            const globalThreshold = financialSnap.val()?.paymentThreshold || 75;

            for (const userId in registrations) {
                 if (!users[userId] || users[userId].role !== 'Student') continue;

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
                            studentId: users[userId].id,
                            studentName: users[userId].name,
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
    }, [toast, semesters]);

    React.useEffect(() => {
        fetchPaymentData();
    }, [fetchPaymentData]);

    const filteredTransactions = React.useMemo(() => {
        const now = getCurrentServerDate();
        const startOfW = startOfWeek(now, { weekStartsOn: 1 });
        const endOfW = endOfWeek(now, { weekStartsOn: 1 });
        const startOfM = startOfMonth(now);
        const endOfM = endOfMonth(now);

        return rawTransactions.filter(tx => {
            const date = parseISO(tx.paymentDate);
            switch(timeFilter) {
                case 'today': return isToday(date);
                case 'week': return isWithinInterval(date, { start: startOfW, end: endOfW });
                case 'month': return isWithinInterval(date, { start: startOfM, end: endOfM });
                case 'period': return customRange?.from && customRange?.to ? isWithinInterval(date, { start: customRange.from, end: customRange.to }) : true;
                default: return true;
            }
        });
    }, [rawTransactions, timeFilter, customRange, serverTimeOffset]);

    const filteredData = React.useMemo(() => {
        // If we are looking for payments in a specific period, we only show students from filteredTransactions
        const uidsInPeriod = new Set(filteredTransactions.map(t => t.userId));
        
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const semesterMatch = semesterFilter === 'all' || p.semesterId === semesterFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            
            // If time filter isn't 'all', restrict list to those who paid in that time
            const timeMatch = timeFilter === 'all' || uidsInPeriod.has(p.userId);

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
        
        // Also calculate exact revenue collected in filtered period from transactions
        const periodCollected = filteredTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        return { ...stats, periodCollected };
    }, [filteredData, filteredTransactions]);

    const revenueMetrics = React.useMemo(() => {
        const now = getCurrentServerDate();
        const startOfW = startOfWeek(now, { weekStartsOn: 1 });
        const endOfW = endOfWeek(now, { weekStartsOn: 1 });
        const startOfM = startOfMonth(now);
        const endOfM = endOfMonth(now);

        const metrics = {
            today: 0,
            week: 0,
            month: 0,
            bySemester: new Map<string, { total: number, start?: string, end?: string, name: string }>()
        };

        rawTransactions.forEach(tx => {
            const date = parseISO(tx.paymentDate);
            const amount = tx.amount || 0;

            if (isToday(date)) metrics.today += amount;
            if (isWithinInterval(date, { start: startOfW, end: endOfW })) metrics.week += amount;
            if (isWithinInterval(date, { start: startOfM, end: endOfM })) metrics.month += amount;

            if (tx.semesterId) {
                if (!metrics.bySemester.has(tx.semesterId)) {
                    const semInfo = semesters.find(s => s.id === tx.semesterId);
                    metrics.bySemester.set(tx.semesterId, { 
                        total: 0, 
                        name: semInfo?.name || 'Unknown',
                        start: semInfo?.startDate,
                        end: semInfo?.endDate
                    });
                }
                const semData = metrics.bySemester.get(tx.semesterId)!;
                semData.total += amount;
            }
        });

        return metrics;
    }, [rawTransactions, semesters, serverTimeOffset]);

    const handleSaveBulkPayments = async () => {
        const paymentsToRecord = bulkPaymentRows.filter(p => parseFloat(p.amount) > 0 && p.semesterId && ((p.isUnlinked && p.reference) || (!p.isUnlinked && p.userId)));
        
        if(paymentsToRecord.length === 0) {
            toast({ variant: 'destructive', title: 'No valid payments entered.' });
            return;
        }
        
        setFormLoading(true);
        const updates: Record<string, any> = {};
        const now = new Date().toISOString();

        try {
            for (const paymentRecord of paymentsToRecord) {
                const amountFloat = parseFloat(paymentRecord.amount);

                if (paymentRecord.isUnlinked) {
                    const unlinkedRef = push(ref(db, 'unlinkedPayments'));
                    updates[`unlinkedPayments/${unlinkedRef.key}`] = {
                        reference: paymentRecord.reference,
                        semesterId: paymentRecord.semesterId,
                        amount: amountFloat,
                        comment: paymentRecord.comment || '',
                        totalDue: parseFloat(String(paymentRecord.totalDue)) || 0,
                        date: now
                    };
                } else {
                    let { userId, invoiceId, semesterId, comment, totalDue } = paymentRecord;
                    if (!userId || !semesterId) continue;

                    const semesterInfo = semesters.find(s => s.id === semesterId);
                    if (!semesterInfo) continue;

                    if (!invoiceId) {
                        const newInvoiceRef = push(ref(db, `invoices/${userId}`));
                        invoiceId = newInvoiceRef.key!;
                        updates[`invoices/${userId}/${invoiceId}`] = {
                            invoiceId,
                            totalTuition: parseFloat(String(totalDue)) || 0,
                            totalMandatoryFees: 0,
                            totalOptionalFees: 0,
                            dateCreated: now,
                            semester: semesterInfo.name,
                            semesterId: semesterInfo.id,
                            courses: [],
                            optionalFees: [],
                        };
                        updates[`registrations/${userId}/${semesterId}/invoiceId`] = invoiceId;
                    }

                    const txRef = push(ref(db, 'transactions'));
                    updates[`transactions/${txRef.key}`] = {
                        transactionId: `MANUAL-${Date.now()}-${txRef.key?.slice(-4)}`,
                        userId,
                        invoiceId,
                        amount: amountFloat,
                        currency: 'ZMW',
                        status: 'successful',
                        paymentDate: now,
                        method: 'Manual',
                        comment: comment || ''
                    };
                    
                    createNotification(userId, `Manual payment of ZMW ${amountFloat.toFixed(2)} recorded for ${semesterInfo.name}.`, '/student/payments').catch(() => {});
                }
            }
            
            await update(ref(db), updates);
            toast({ variant: 'success', title: "Payments Recorded", description: `Successfully processed ${paymentsToRecord.length} records.` });
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
            await fetchPaymentData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleLinkPayment = async () => {
        if (!linkingPayment || !selectedLinkStudent || !linkingPayment.semesterId) return;
        setFormLoading(true);
        try {
            const info = paymentInfos.find(p => p.userId === selectedLinkStudent && p.semesterId === linkingPayment.semesterId);
            let invoiceId = info?.invoiceId;
            const updates: Record<string, any> = {};

            if (!invoiceId) {
                const newInvoiceRef = push(ref(db, `invoices/${selectedLinkStudent}`));
                invoiceId = newInvoiceRef.key!;
                updates[`invoices/${selectedLinkStudent}/${invoiceId}`] = {
                    invoiceId,
                    totalTuition: linkingPayment.totalDue || 0,
                    totalMandatoryFees: 0,
                    totalOptionalFees: 0,
                    dateCreated: new Date().toISOString(),
                    semesterId: linkingPayment.semesterId,
                    semester: semesters.find(s => s.id === linkingPayment.semesterId)?.name || 'Manual Link'
                };
                updates[`registrations/${selectedLinkStudent}/${linkingPayment.semesterId}/invoiceId`] = invoiceId;
            } else if (linkResolution === 'overwrite' && linkingPayment.totalDue !== undefined) {
                updates[`invoices/${selectedLinkStudent}/${invoiceId}/totalTuition`] = linkingPayment.totalDue;
            }

            const txRef = push(ref(db, 'transactions'));
            updates[`transactions/${txRef.key}`] = {
                transactionId: `LINKED-${linkingPayment.id}`,
                userId: selectedLinkStudent,
                invoiceId,
                amount: linkingPayment.amount,
                currency: 'ZMW',
                status: 'successful',
                paymentDate: linkingPayment.date,
                method: 'Manual (Linked)',
                comment: `Linked Original Ref: ${linkingPayment.reference}.`
            };

            updates[`unlinkedPayments/${linkingPayment.id}`] = null;
            await update(ref(db), updates);
            toast({ variant: 'success', title: 'Payment Linked' });
            createNotification(selectedLinkStudent, `Deposit of ZMW ${linkingPayment.amount.toFixed(2)} linked to your account.`, '/student/payments').catch(() => {});
            await fetchPaymentData();
            setIsLinkingOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Linking Failed' });
        } finally {
            setFormLoading(false);
        }
    };

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
        doc.save(`finance_report_${format(getCurrentServerDate(), 'yyyy-MM-dd')}.pdf`);
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
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Today's Collections</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-green-600">ZMW {revenueMetrics.today.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">This Week</CardTitle>
                                <Clock className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black">ZMW {revenueMetrics.week.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">This Month</CardTitle>
                                <PiggyBank className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black">ZMW {revenueMetrics.month.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Outstanding Balance</CardTitle>
                                <Scale className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-destructive">ZMW {summaryStats.totalBalance.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Student Financial Status & Performance</CardTitle>
                            <CardDescription>Filter by intake or period to audit payment reliability and threshold compliance.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export Report</Button>
                            <Button size="sm" onClick={() => setIsBulkRecordOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/> Record Payments</Button>
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
                                    <SelectItem value="period">Custom Date Range</SelectItem>
                                    <Separator className="my-1"/>
                                    <SelectItem value="all">All Receivables (Owed)</SelectItem>
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
                            <Label className="text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Student Intake</Label>
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
                        <div className="rounded-md border shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>System ID</TableHead>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead>Current Courses</TableHead>
                                        <TableHead className="text-right">Invoice Balance</TableHead>
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
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {info.enrolledCourses.map(cid => (
                                                        <Badge key={cid} variant="secondary" className="text-[8px] h-4 bg-primary/5 text-primary border-primary/10">
                                                            {courses[cid]?.code || '...'}
                                                        </Badge>
                                                    ))}
                                                    {info.enrolledCourses.length === 0 && <span className="text-[10px] text-muted-foreground italic">No classes</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-sm">ZMW {info.balance.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">{statusBadge(info)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }}>
                                                    <History className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">No financial records match the current filters.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isBulkRecordOpen} onOpenChange={(o) => { if(!o) setBulkPaymentRows([]); setIsBulkRecordOpen(o); }}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Record Manual Payments</DialogTitle><DialogDescription>Directly credit student accounts with bulk transaction data. Use Invoice IDs for accurate tracking.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-auto border rounded-lg mt-4 bg-muted/5">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[300px]">Student Search</TableHead>
                                    <TableHead className="w-[200px]">Semester Context</TableHead>
                                    <TableHead>Invoice ID</TableHead>
                                    <TableHead className="text-right">Amount (ZMW)</TableHead>
                                    <TableHead>Comment / Ref</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bulkPaymentRows.map((row) => {
                                    const semesterOptions: OptionGroup[] = [{ 
                                        groupName: 'Available', 
                                        items: semesters.filter(s => !row.userId || allStudents.find(st => st.uid === row.userId)?.intakeId === s.intakeId).map(s => ({ value: s.id, label: s.name })) 
                                    }];
                                    return (
                                    <TableRow key={row.key} className="border-b-0">
                                        <TableCell>
                                            <SearchableSelect 
                                                value={row.userId || (row.isUnlinked ? '__UNLINKED__' : undefined)} 
                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'userId', val)} 
                                                options={studentOptions} 
                                                placeholder="Select student..." 
                                            />
                                            {row.isUnlinked && <Input placeholder="Generic Reference (Bank Slip #)" value={row.reference || ''} onChange={(e) => handleBulkPaymentRowChange(row.key, 'reference', e.target.value)} className="mt-2 text-xs h-8" />}
                                        </TableCell>
                                        <TableCell>
                                            <SearchableSelect 
                                                value={row.semesterId} 
                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'semesterId', val)} 
                                                options={semesterOptions} 
                                                placeholder="Semester..." 
                                                disabled={!row.userId && !row.isUnlinked} 
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-[10px]">{row.invoiceId || 'Auto-generated'}</TableCell>
                                        <TableCell className="text-right"><Input type="number" value={row.amount} onChange={(e) => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} className="h-9 font-bold text-right" placeholder="0.00"/></TableCell>
                                        <TableCell><Input value={row.comment} onChange={(e) => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-9 text-xs" placeholder="Optional notes..."/></TableCell>
                                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemovePaymentRow(row.key)} className="h-8 w-8 text-destructive"><X className="h-4 w-4"/></Button></TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="py-4 border-t mt-auto flex justify-between items-center">
                        <Button variant="outline" size="sm" onClick={() => setBulkPaymentRows(p => [...p, { key: Date.now(), amount: '', comment: '' }])}><PlusCircle className="mr-2 h-4 w-4"/>Add Transaction</Button>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsBulkRecordOpen(false)}>Discard</Button>
                            <Button onClick={handleSaveBulkPayments} disabled={formLoading || bulkPaymentRows.length === 0}>
                                {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Finalize {bulkPaymentRows.length} Payments
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Financial Statement: {historyStudent?.studentName}</DialogTitle><DialogDescription>Audit log of all payments and enrollment history for the current phase.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-auto border rounded-xl my-4 bg-muted/5">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 border-b">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Post Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Invoice ID</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Method</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rawTransactions.filter(t => t.userId === historyStudent?.userId).map(tx => (
                                    <TableRow key={tx.key} className="border-b-0">
                                        <TableCell className="text-xs font-medium">{format(parseISO(tx.paymentDate), 'dd MMM yyyy HH:mm')}</TableCell>
                                        <TableCell className="font-mono text-[10px] text-primary">{tx.invoiceId}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[9px] uppercase font-black">{tx.method}</Badge></TableCell>
                                        <TableCell className="text-right font-black text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                                {rawTransactions.filter(t => t.userId === historyStudent?.userId).length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">No transactions found for this account.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter className="border-t pt-4"><Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Close Statement</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const studentOptions = [
    { groupName: 'System Actions', items: [{ value: '__UNLINKED__', label: 'Student Not Found / Unlinked Payment' }] },
    { groupName: 'Students', items: [] } // Populated dynamically in component
];

    