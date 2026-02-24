"use client";
import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Receipt, 
    ChevronDown, 
    CheckCircle2, 
    Loader2, 
    Download, 
    Calculator, 
    AlertTriangle, 
    Search,
    PlusCircle,
    Users,
    PiggyBank,
    Scale,
    Trash2,
    ChevronsUpDown,
    Clock,
    CalendarDays,
    TrendingUp,
    MapPin,
    Wallet,
    History as HistoryIcon,
    Calendar as CalendarIcon,
    Save,
    ShieldAlert,
    Info,
    X,
    UserCheck,
    Lock,
    Unlock,
    ArrowRight,
    Pencil,
    Tag,
    Equal,
    GraduationCap,
    ListChecks,
    ReceiptText,
    FileCheck
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, update, push, set, onValue, off, serverTimestamp } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isAfter, addDays, isBefore } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseIntakeDate, calculateAcademicState } from '@/lib/semester-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { calculateBilling, type BillingPolicy, type FeeItem } from '@/lib/billing-utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';

type FeeBreakdown = {
    tuition: number;
    mandatory: number;
    optional: number;
    scholarship: number;
    late: number;
    mandatoryItems?: FeeItem[];
    optionalItems?: FeeItem[];
    courses?: {id: string, cost: number}[];
};

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
    penaltiesActive: boolean;
    isScholarship: boolean;
    paidPercentage: number;
    targetThreshold: number;
    gracePeriod: number;
    isUnlinked?: boolean;
    tempStudentName?: string;
    breakdown: FeeBreakdown;
    paymentPlanName?: string;
    nextInstallmentDue?: string | null;
};

type PaymentRecord = {
    key: number;
    userId?: string;
    isNewStudent?: boolean;
    tempStudentId?: string;
    tempStudentName?: string;
    year?: string;
    semesterId?: string;
    amount: string;
    comment: string;
    allocations: string[];
    totalDue?: number;
    totalPaid?: number;
    availableYears?: string[];
    availableSemesters?: Semester[];
    breakdown?: FeeBreakdown;
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
    purpose?: string;
    senderName?: string;
    semesterName?: string;
    semesterId?: string;
    academicStanding?: string;
    intakeName?: string;
    isUnlinked?: boolean;
    requestId?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; gracePeriodDays?: number; paymentThreshold?: number; billingPolicy?: 'course' | 'semester'; tuitionFee?: number; mandatoryFees?: Record<string, any>; optionalFees?: Record<string, any>; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };

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
                <Button variant="outline" className="w-full justify-between h-10 px-3 bg-background border-primary/20 shadow-sm" disabled={disabled}>
                    <span className="truncate text-xs">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" side="bottom" align="start">
                <div className="p-2">
                    <Input 
                        placeholder="Search roster..." 
                        className="h-9 text-xs" 
                        value={search} 
                        onChange={e => setSearchTermLocal(e.target.value)} 
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </div>
                <Separator />
                <ScrollArea className="h-[200px]">
                    <div className="p-1">
                    {filteredOptions.length > 0 ? filteredOptions.map(group => (
                        <div key={group.groupName} className="p-1">
                            <div className="px-2 py-1.5 text-[9px] font-black uppercase text-muted-foreground tracking-widest bg-muted/30 rounded-sm mb-1">{group.groupName}</div>
                            {group.items.map(option => (
                                <Button
                                    key={option.value}
                                    variant="ghost"
                                    className="w-full justify-start h-auto py-2 px-2 text-left text-xs"
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
                    )) : <p className="p-4 text-center text-xs text-muted-foreground italic">No results found.</p>}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );

    function setSearchTermLocal(val: string) {
        setSearch(val);
    }
}

export default function PaymentsManagementPage() {
    const { user, userProfile: userData } = useAuth();
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [allStudents, setAllStudents] = React.useState<StudentInfo[]>([]);
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, any>>({});
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    // Filters
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [planStatusFilter, setPlanStatusFilter] = React.useState('all');
    const [dueFilter, setDueFilter] = React.useState('all');
    const [minPaidFilter, setMinPaidFilter] = React.useState('');
    const [maxPaidFilter, setMaxPaidFilter] = React.useState('');
    const [equalPaidFilter, setEqualPaidFilter] = React.useState('');
    const [timeFilter, setTimeFilter] = React.useState<'today' | 'week' | 'month' | 'period' | 'all'>('all');
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>();

    // Bulk Recording State
    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);
    
    // History & Adjustment State
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [isAdjustmentOpen, setIsAdjustmentOpen] = React.useState(false);
    const [adjustmentTarget, setAdjustmentTarget] = React.useState<{ type: 'debit' | 'credit', id: string, userId: string, studentName: string, studentId: string, invoiceId: string } | null>(null);
    const [adjAmount, setAdjAmount] = React.useState('');
    const [adjReason, setAdjReason] = React.useState('');

    const [formLoading, setFormLoading] = React.useState(false);

    const { toast } = useToast();

    const dataRefs = React.useMemo(() => ({
        users: ref(db, 'users'),
        registrations: ref(db, 'registrations'),
        transactions: ref(db, 'transactions'),
        programmes: ref(db, 'programmes'),
        semesters: ref(db, 'semesters'),
        intakes: ref(db, 'intakes'),
        courses: ref(db, 'courses'),
        invoices: ref(db, 'invoices'),
        financialSettings: ref(db, 'settings/financialSettings'),
        calendarEvents: ref(db, 'calendarEvents'),
        academicCalendar: ref(db, 'settings/academicCalendar')
    }), []);

    React.useEffect(() => {
        const offsetRef = ref(db, '.info/serverTimeOffset');
        onValue(offsetRef, (snap) => setServerTimeOffset(snap.val() || 0));
        return () => off(offsetRef);
    }, []);

    const getCurrentServerDate = () => new Date(Date.now() + serverTimeOffset);

    const calculateStandingForUser = (userId: string) => {
        const studentInfo = allStudents.find(s => s.uid === userId);
        if (!studentInfo || !studentInfo.intakeId || !calendarSettings) return 'N/A';
        const intake = allIntakes.find(i => i.id === studentInfo.intakeId);
        const intakeStart = parseIntakeDate(intake?.name || '');
        if (!intakeStart) return 'N/A';
        const state = calculateAcademicState(intakeStart, getCurrentServerDate(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {}));
        return `Year ${state.year}, Sem ${state.semester}`;
    };

    React.useEffect(() => {
        if (!userData?.uid) return;
        
        const unsubs: (() => void)[] = [];
        const store: any = {};

        const computeDerived = () => {
            if (!store.users || !store.registrations || !store.semesters) return;

            const users = store.users;
            const regsData = store.registrations;
            const txsData = store.transactions || {};
            const semsData = store.semesters;
            const intsData = store.intakes || {};
            const invsData = store.invoices || {};
            const calendarEvents = Object.values(store.calendarEvents || {}) as any[];
            const finData = store.financialSettings || { paymentThreshold: 75 };
            const plansData = store.paymentPlans || {};

            const transactionsList: Transaction[] = [];
            for (const txId in txsData) {
                const tx = txsData[txId];
                if(tx.status !== 'successful') continue;
                const userId = tx.userId;
                const userRegs = regsData[userId] || {};
                const semesterId = Object.keys(userRegs).find(sid => userRegs[sid].invoiceId === tx.invoiceId);
                const sInfo = semesterId ? semsData[semesterId] : null;
                const iInfo = sInfo ? intsData[sInfo.intakeId] : null;

                transactionsList.push({
                    key: txId,
                    ...tx,
                    semesterId,
                    semesterName: semesterId ? semsData[semesterId]?.name : undefined,
                    intakeName: iInfo?.name,
                    academicStanding: semesterId ? `Year ${semsData[semesterId].year}, Sem ${semsData[semesterId].semesterInYear}` : undefined
                });
            }
            setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));

            const studentPaymentMap: Record<string, StudentPaymentInfo> = {};
            const globalThreshold = finData.paymentThreshold || 75;
            const now = getCurrentServerDate();

            for (const userId in regsData) {
                const profile = users[userId];
                if (!profile || profile.role?.toLowerCase() !== 'student') continue;

                for (const semesterId in regsData[userId]) {
                    const reg = regsData[userId][semesterId];
                    const semesterInfo = semsData[semesterId];
                    if (!semesterInfo) continue;

                    const invoice = invsData[userId]?.[reg.invoiceId];
                    if (invoice) {
                        const tuition = Number(invoice.totalTuition || 0);
                        const mandatory = Number(invoice.totalMandatoryFees || 0);
                        const optional = Number(invoice.totalOptionalFees || 0);
                        const late = Number(invoice.lateFee || 0);
                        const scholarPerc = Number(invoice.scholarshipPercentage || 100);

                        const scholarshipAmount = invoice.applyScholarship 
                            ? (tuition * (scholarPerc / 100))
                            : 0;

                        const totalPayable = tuition - scholarshipAmount + mandatory + optional + late;

                        const userTransactions = transactionsList.filter(t => t.userId === userId && t.invoiceId === reg.invoiceId);
                        const totalPaid = userTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                        const balance = Math.max(0, totalPayable - totalPaid);
                        
                        const threshold = semesterInfo.paymentThreshold || globalThreshold;
                        const paidPercentage = totalPayable > 0 ? (totalPaid / totalDue) * 100 : 100;
                        const thresholdMet = paidPercentage >= threshold;

                        const semDeadlines = calendarEvents.filter(ev => ev.semester === semesterInfo.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
                        const grace = semesterInfo.gracePeriodDays ?? 7;
                        const passedDeadlines = semDeadlines.filter(ev => isAfter(now, addDays(parseISO(ev.date), grace)));
                        const penaltiesActive = passedDeadlines.length > 0 && !thresholdMet;

                        // Next Installment Due logic
                        let nextInstallmentDue = null;
                        if (reg.paymentPlan) {
                            const plan = Object.values(plansData).find((p:any) => p.name === reg.paymentPlan) as any;
                            if (plan) {
                                for (let i = 0; i < plan.installments; i++) {
                                    const title = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semesterInfo.name}`;
                                    const deadlineEvent = calendarEvents.find(e => e.title?.trim() === title.trim());
                                    if (deadlineEvent && isAfter(parseISO(deadlineEvent.date), now)) {
                                        nextInstallmentDue = deadlineEvent.date;
                                        break;
                                    }
                                }
                            }
                        }

                        studentPaymentMap[`${userId}-${semesterId}`] = {
                            userId, studentId: profile.id, studentName: profile.name,
                            totalDue: totalPayable, totalPaid, balance,
                            programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId,
                            invoiceId: reg.invoiceId, enrolledCourses: reg.courses || [],
                            thresholdMet, penaltiesActive, isScholarship: !!invoice.applyScholarship,
                            paidPercentage, targetThreshold: threshold, gracePeriod: grace,
                            status: balance <= 0.01 ? 'Paid' : 'Pending',
                            paymentPlanName: reg.paymentPlan || null,
                            nextInstallmentDue,
                            breakdown: {
                                tuition, mandatory, optional, scholarship: scholarshipAmount, late,
                                mandatoryItems: Object.values(semesterInfo.mandatoryFees || {}),
                                optionalItems: (reg.optionalFees || []).map((fid:string) => ({ name: semesterInfo.optionalFees?.[fid]?.name || 'Fee', amount: Number(semesterInfo.optionalFees?.[fid]?.amount || 0) }))
                            }
                        };
                    }
                }
            }

            setPaymentInfos(Object.values(studentPaymentMap));
            setLoading(false);
        };

        unsubs.push(onValue(dataRefs.users, (snapshot) => {
            const data = snapshot.val() || {};
            const studentList: StudentInfo[] = [];
            for (const uid in data) {
                if (data[uid].role?.toLowerCase() === 'student') {
                    studentList.push({ uid, id: data[uid].id, name: data[uid].name, intakeId: data[uid].intakeId, programmeId: data[uid].programmeId });
                }
            }
            setAllStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
            store.users = data;
            computeDerived();
        }));

        unsubs.push(onValue(dataRefs.registrations, (s) => { store.registrations = s.val() || {}; computeDerived(); }));
        unsubs.push(onValue(dataRefs.transactions, (s) => { store.transactions = s.val() || {}; computeDerived(); }));
        unsubs.push(onValue(dataRefs.programmes, (s) => {
            const data = s.val() || {};
            setProgrammes(Object.entries(data).map(([id, d]:[string,any]) => ({id, ...d})));
            store.programmes = data;
            computeDerived();
        }));
        unsubs.push(onValue(dataRefs.semesters, (s) => {
            const data = s.val() || {};
            setSemesters(Object.entries(data).map(([id, d]:[string,any]) => ({id, ...d})));
            store.semesters = data;
            computeDerived();
        }));
        unsubs.push(onValue(dataRefs.intakes, (s) => {
            const data = s.val() || {};
            setAllIntakes(Object.entries(data).map(([id, d]:[string,any]) => ({id, ...d})));
            store.intakes = data;
            computeDerived();
        }));
        unsubs.push(onValue(dataRefs.courses, (s) => { setAllCourses(s.val() || {}); }));
        unsubs.push(onValue(dataRefs.invoices, (s) => { store.invoices = s.val() || {}; computeDerived(); }));
        unsubs.push(onValue(dataRefs.financialSettings, (snapshot) => { 
            setFinancialSettings(snapshot.val()); 
            store.financialSettings = snapshot.val(); 
            computeDerived(); 
        }));
        unsubs.push(onValue(dataRefs.calendarEvents, (s) => { store.calendarEvents = s.val() || {}; computeDerived(); }));
        unsubs.push(onValue(dataRefs.academicCalendar, (s) => { 
            setCalendarSettings(s.val()); 
            store.academicCalendar = s.val(); 
            computeDerived(); 
        }));
        unsubs.push(onValue(ref(db, 'settings/paymentPlans'), (s) => {
            store.paymentPlans = s.val() || {};
            computeDerived();
        }));

        const savedFiltersRef = ref(db, `settings/paymentFilters/${userData.uid}`);
        get(savedFiltersRef).then(snap => {
            if (snap.exists()) {
                const f = snap.val();
                if(f.programmeFilter) setProgrammeFilter(f.programmeFilter);
                if(f.intakeFilter) setIntakeFilter(f.intakeFilter);
                if(f.timeFilter) setTimeFilter(f.timeFilter);
            }
        });

        return () => unsubs.forEach(unsub => unsub());
    }, [userData?.uid, serverTimeOffset, dataRefs]);

    const filteredData = React.useMemo(() => {
        const now = getCurrentServerDate();
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const semesterMatch = semesterFilter === 'all' || p.semesterId === semesterFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            
            const planMatch = planStatusFilter === 'all' ? true : (planStatusFilter === 'none' ? !p.paymentPlanName : !!p.paymentPlanName);
            
            let dueMatch = true;
            if (dueFilter !== 'all') {
                if (!p.nextInstallmentDue) {
                    dueMatch = false;
                } else {
                    const diff = differenceInCalendarDays(parseISO(p.nextInstallmentDue), now);
                    if (dueFilter === '7') dueMatch = diff >= 0 && diff <= 7;
                    else if (dueFilter === '14') dueMatch = diff >= 0 && diff <= 14;
                    else if (dueFilter === '30') dueMatch = diff >= 0 && diff <= 30;
                    else if (dueFilter === 'overdue') dueMatch = diff < 0;
                }
            }

            const minMatch = minPaidFilter === '' || p.totalPaid >= parseFloat(minPaidFilter);
            const maxMatch = maxPaidFilter === '' || p.totalPaid <= parseFloat(maxPaidFilter);
            const equalMatch = equalPaidFilter === '' || Math.abs(p.totalPaid - parseFloat(equalPaidFilter)) < 0.01;

            return searchMatch && programmeMatch && semesterMatch && intakeMatch && planMatch && dueMatch && minMatch && maxMatch && equalMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter, intakeFilter, planStatusFilter, dueFilter, minPaidFilter, maxPaidFilter, equalPaidFilter, serverTimeOffset]);

    const revenueMetrics = React.useMemo(() => {
        const now = getCurrentServerDate();
        const today = format(now, 'yyyy-MM-dd');
        const month = format(now, 'yyyy-MM');
        return rawTransactions.reduce((acc, t) => {
            if(t.paymentDate.startsWith(today)) acc.today += t.amount;
            if(t.paymentDate.startsWith(month)) acc.month += t.amount;
            return acc;
        }, { today: 0, month: 0 });
    }, [rawTransactions, serverTimeOffset]);

    const handleSaveAdjustment = async () => {
        if (!adjustmentTarget || !adjAmount || !adjReason.trim() || !user || !userData) return;
        setFormLoading(true);
        try {
            const amountFloat = parseFloat(adjAmount);
            const txRef = push(ref(db, 'transactions'));
            const now = new Date().toISOString();
            
            // For adjustments, we create a special transaction record
            await set(txRef, {
                transactionId: `${adjustmentTarget.type.toUpperCase()}-${Date.now()}`,
                userId: adjustmentTarget.userId,
                invoiceId: adjustmentTarget.invoiceId,
                amount: adjustmentTarget.type === 'credit' ? amountFloat : -amountFloat, // Credit reduces balance, Debit increases it
                status: 'successful',
                paymentDate: now,
                method: 'Adjustment',
                purpose: adjustmentTarget.type === 'credit' ? 'Credit Note' : 'Debit Note',
                comment: adjReason,
                recordedBy: userData.name
            });

            // If it's a debit note (increasing student debt), we add it to the invoice total or late fees
            if (adjustmentTarget.type === 'debit') {
                const invRef = ref(db, `invoices/${adjustmentTarget.userId}/${adjustmentTarget.invoiceId}`);
                const invSnap = await get(invRef);
                if (invSnap.exists()) {
                    const currentLate = Number(invSnap.val().lateFee || 0);
                    await update(invRef, { lateFee: currentLate + amountFloat });
                }
            }

            toast({ title: 'Adjustment Recorded', description: `${adjustmentTarget.type === 'credit' ? 'Credit' : 'Debit'} note processed.` });
            setIsAdjustmentOpen(false);
            setAdjAmount('');
            setAdjReason('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        } finally {
            setFormLoading(false);
        }
    };

    const generateReceipt = async (tx: Transaction, student: StudentPaymentInfo) => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text("OFFICIAL RECEIPT", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.text(`Receipt No: ${tx.transactionId}`, 14, 40);
        doc.text(`Date: ${format(parseISO(tx.paymentDate), 'PPP p')}`, 14, 45);
        
        doc.text(`Student: ${student.studentName}`, 14, 60);
        doc.text(`Student ID: ${student.studentId}`, 14, 65);
        doc.text(`Semester: ${student.semesterName}`, 14, 70);

        autoTable(doc, {
            startY: 80,
            head: [['Description', 'Amount (ZMW)']],
            body: [
                [tx.purpose || 'Fees Payment', tx.amount.toFixed(2)],
                ['Total Received', tx.amount.toFixed(2)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] }
        });

        doc.text("Thank you for your payment.", 14, (doc as any).lastAutoTable.finalY + 20);
        doc.save(`Receipt_${tx.transactionId}.pdf`);
    };

    const studentOptions: OptionGroup[] = React.useMemo(() => {
        const items = allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` }));
        return [{ groupName: 'Student Roster', items }];
    }, [allStudents]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div>
                        <CardTitle className="font-headline text-2xl">Financial Audit Center</CardTitle>
                        <CardDescription>Consolidated institutional revenue and standing audit.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Today's Collections</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-black text-green-600">ZMW {revenueMetrics.today.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">This Month</CardTitle>
                                <PiggyBank className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-black text-primary">ZMW {revenueMetrics.month.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtered Students</CardTitle>
                                <Users className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-black">{filteredData.length}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtered Collected</CardTitle>
                                <Scale className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-primary">ZMW {filteredData.reduce((sum, p) => sum + p.totalPaid, 0).toFixed(2)}</div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div><CardTitle>Receivables & Audit</CardTitle><CardDescription>Filter and audit student financial compliance.</CardDescription></div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleSaveAsDefault} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save Filters</Button>
                            <Button size="sm" onClick={() => { setBulkPaymentRows([{ key: Date.now(), amount: '', comment: '', allocations: [] }]); setIsBulkRecordOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Record Transaction(s)</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-xl border bg-muted/10 items-end">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Programme</Label>
                            <Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger className="h-9 bg-background"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Installment Plan</Label>
                            <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}><SelectTrigger className="h-9 bg-background"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="none">Plan Not Set (Urgent)</SelectItem><SelectItem value="set">Plan Active</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Next Due Within</Label>
                            <Select value={dueFilter} onValueChange={setDueFilter}><SelectTrigger className="h-9 bg-background"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Any Date</SelectItem><SelectItem value="7">7 Days</SelectItem><SelectItem value="14">14 Days</SelectItem><SelectItem value="30">30 Days</SelectItem><SelectItem value="overdue">Already Overdue</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1 lg:col-span-2"><Label className="text-[10px] font-black uppercase">Search</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-50"/><Input className="pl-8 h-9 bg-background" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
                    </div>

                    <div className="rounded-md border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>System ID</TableHead>
                                    <TableHead>User & Plan</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-center">Next Due</TableHead>
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
                                                {info.paymentPlanName ? <Badge variant="outline" className="w-fit h-4 text-[8px] uppercase border-primary/20">{info.paymentPlanName}</Badge> : <Badge variant="destructive" className="w-fit h-4 text-[8px] uppercase animate-pulse">Plan Not Set</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-sm text-destructive">ZMW {info.balance.toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            {info.nextInstallmentDue ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-bold">{format(parseISO(info.nextInstallmentDue), 'dd MMM')}</span>
                                                    {isBefore(parseISO(info.nextInstallmentDue), getCurrentServerDate()) && <span className="text-[8px] text-destructive font-black uppercase">Overdue</span>}
                                                </div>
                                            ) : <span className="text-[10px] opacity-40 italic">N/A</span>}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }}><HistoryIcon className="mr-2 h-4 w-4"/>View Statement</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { setAdjustmentTarget({ type: 'credit', id: info.userId, userId: info.userId, studentName: info.studentName, studentId: info.studentId, invoiceId: info.invoiceId }); setIsAdjustmentOpen(true); }}><Badge variant="outline" className="mr-2 h-4 w-4 p-0 flex items-center justify-center">-</Badge>Issue Credit Note</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { setAdjustmentTarget({ type: 'debit', id: info.userId, userId: info.userId, studentName: info.studentName, studentId: info.studentId, invoiceId: info.invoiceId }); setIsAdjustmentOpen(true); }} className="text-destructive"><Badge variant="outline" className="mr-2 h-4 w-4 p-0 flex items-center justify-center">+</Badge>Issue Debit Note</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isBulkRecordOpen} onOpenChange={setIsBulkRecordOpen}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Record Transaction(s)</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 py-4">
                        {bulkPaymentRows.map((row, idx) => (
                            <Card key={row.key} className="border-l-4 border-l-primary relative group">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemovePaymentRow(row.key)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{idx + 1}</div>
                                            <Label className="font-black text-[10px] uppercase">Recipient</Label>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Switch checked={row.isNewStudent} onCheckedChange={v => handleBulkPaymentRowChange(row.key, 'isNewStudent', v)} />
                                            <span className="text-[10px] font-bold uppercase text-primary">Request Student Creation?</span>
                                        </div>
                                        {row.isNewStudent ? (
                                            <div className="grid grid-cols-2 gap-3"><Input placeholder="Full Name" value={row.tempStudentName} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentName', e.target.value)} className="h-9 text-xs"/><Input placeholder="ID (e.g. NEW-01)" value={row.tempStudentId} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentId', e.target.value)} className="h-9 text-xs"/></div>
                                        ) : (
                                            <SearchableSelect options={studentOptions} value={row.userId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'userId', v)} placeholder="Search student name or ID..." />
                                        )}
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <Select value={row.year} onValueChange={v => handleBulkPaymentRowChange(row.key, 'year', v)}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{(row.availableYears || []).map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select>
                                            <Select value={row.semesterId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'semesterId', v)} disabled={!row.year}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Semester"/></SelectTrigger><SelectContent>{(row.availableSemesters || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' ').slice(-2).join(' ')}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                    </div>
                                    <div className="space-y-3 border-l pl-6">
                                        <Label className="font-black text-[10px] uppercase">Allocation</Label>
                                        {row.semesterId && (
                                            <ScrollArea className="h-24 border rounded p-2 bg-white">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2"><Checkbox id={`tuition-${row.key}`} checked={row.allocations.includes('Tuition')} onCheckedChange={c => handleBulkPaymentRowChange(row.key, 'allocations', c ? [...row.allocations, 'Tuition'] : row.allocations.filter(a=>a!=='Tuition'))}/><Label htmlFor={`tuition-${row.key}`} className="text-xs">Tuition Fees</Label></div>
                                                    {row.breakdown?.mandatoryItems?.map((f, i) => (
                                                        <div key={i} className="flex items-center gap-2"><Checkbox id={`mand-${row.key}-${i}`} checked={row.allocations.includes(f.name)} onCheckedChange={c => handleBulkPaymentRowChange(row.key, 'allocations', c ? [...row.allocations, f.name] : row.allocations.filter(a=>a!==f.name))}/><Label htmlFor={`mand-${row.key}-${i}`} className="text-xs">{f.name}</Label></div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input type="number" placeholder="Amount (ZMW)" value={row.amount} onChange={e => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} className="h-9 font-bold" />
                                            <Input placeholder="Reference..." value={row.comment} onChange={e => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-9 text-xs" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        <Button variant="outline" className="w-full border-dashed" onClick={() => setBulkPaymentRows(p => [...p, { key: Date.now(), amount: '', comment: '', allocations: [] }])}><Plus className="mr-2 h-4 w-4"/>Add Transaction Row</Button>
                    </div>
                    <DialogFooter><Button onClick={handleSaveAllBulk} disabled={formLoading}>Confirm Transactions</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Statement of Account: {historyStudent?.studentName}</DialogTitle></DialogHeader>
                    {historyStudent && (
                        <ScrollArea className="flex-1 mt-4">
                            <Table>
                                <TableHeader className="bg-muted">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Ref / Purpose</TableHead>
                                        <TableHead className="text-right">Credit</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rawTransactions
                                        .filter(t => t.userId === historyStudent.userId && t.invoiceId === historyStudent.invoiceId)
                                        .map(tx => (
                                            <TableRow key={tx.key}>
                                                <TableCell className="text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs">{tx.purpose || 'Fees Payment'}</span>
                                                        <span className="text-[10px] opacity-60 font-mono">{tx.transactionId}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-green-600 font-bold">{tx.amount > 0 ? `K${tx.amount.toFixed(2)}` : '-'}</TableCell>
                                                <TableCell className="text-right text-red-600 font-bold">{tx.amount < 0 ? `K${Math.abs(tx.amount).toFixed(2)}` : '-'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => generateReceipt(tx, historyStudent)}><Download className="h-4 w-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Issue {adjustmentTarget?.type === 'credit' ? 'Credit' : 'Debit'} Note</DialogTitle>
                        <DialogDescription>Apply a formal financial adjustment to {adjustmentTarget?.studentName}'s ledger.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1"><Label>Amount (ZMW)</Label><Input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="0.00" className="font-bold" /></div>
                        <div className="space-y-1"><Label>Reason for Adjustment</Label><Textarea value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="e.g., Correction of billing error..." rows={4} /></div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveAdjustment} disabled={formLoading || !adjAmount || !adjReason.trim()}>
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4"/> : <FileCheck className="mr-2 h-4 w-4"/>}
                            Issue Note
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    function handleSaveAsDefault() {}
    function handleRemovePaymentRow(key: number) {
        setBulkPaymentRows(prev => prev.filter(r => r.key !== key));
    }
    function handleExport() {}
}
