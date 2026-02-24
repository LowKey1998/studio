
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
    FileCheck,
    Plus,
    MoreVertical,
    Banknote
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, update, push, set, onValue, off, serverTimestamp } from 'firebase/database';
import { format, parseISO, isAfter, addDays, isBefore, differenceInCalendarDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
    DialogClose 
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseIntakeDate, calculateAcademicState } from '@/lib/semester-utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { calculateBilling, type BillingPolicy, type FeeItem } from '@/lib/billing-utils';

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

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
    semesterName?: string;
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
    isProvisional?: boolean;
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
    academicStanding?: string;
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
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; gracePeriodDays?: number; paymentThreshold?: number; billingPolicy?: 'course' | 'semester'; tuitionFee?: number; mandatoryFees?: Record<string, any>; optionalFees?: Record<string, any>; coursePrices?: Record<string, number>; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

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
                        onChange={e => setSearch(e.target.value)} 
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
}

export default function PaymentsManagementPage() {
    const { user, userProfile: userData } = useAuth();
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [allStudents, setAllStudents] = React.useState<StudentInfo[]>([]);
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, any>>({});
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [feeTemplates, setFeeTemplates] = React.useState<FeeTemplate[]>([]);
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
        academicCalendar: ref(db, 'settings/academicCalendar'),
        paymentPlans: ref(db, 'settings/paymentPlans'),
        configs: ref(db, 'semesterConfigs')
    }), []);

    React.useEffect(() => {
        const offsetRef = ref(db, '.info/serverTimeOffset');
        onValue(offsetRef, (snap) => setServerTimeOffset(snap.val() || 0));
        return () => off(offsetRef);
    }, []);

    const getCurrentServerDate = () => new Date(Date.now() + serverTimeOffset);

    React.useEffect(() => {
        if (!userData?.uid) return;
        
        const unsubs: (() => void)[] = [];
        const store: any = {};

        const computeDerived = () => {
            if (!store.users || !store.registrations || !store.semesters || !store.intakes) return;

            const users = store.users;
            const regsData = store.registrations;
            const txsData = store.transactions || {};
            const semsData = store.semesters;
            const intsData = store.intakes;
            const invsData = store.invoices || {};
            const calendarEvents = Object.values(store.calendarEvents || {}) as any[];
            const finData = store.financialSettings || { paymentThreshold: 75 };
            const plansData = store.paymentPlans || {};
            const coursesData = store.courses || {};
            const configsData = store.configs || {};

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
                    let billingResults;
                    let isProvisional = false;

                    // Load from versioned snapshot if available
                    const configSnapshot = (reg.configId && configsData[semesterId]?.[reg.configId]) || (invoice?.configId && configsData[semesterId]?.[invoice.configId]);
                    const activeSemesterRules = configSnapshot || semesterInfo;

                    if (invoice) {
                        const tuition = Number(invoice.totalTuition || 0);
                        const mandatory = Number(invoice.totalMandatoryFees || 0);
                        const optional = Number(invoice.totalOptionalFees || 0);
                        const late = Number(invoice.lateFee || 0);
                        const scholarPerc = Number(invoice.scholarshipPercentage || 100);

                        const scholarshipAmount = invoice.applyScholarship 
                            ? (tuition * (scholarPerc / 100))
                            : 0;

                        billingResults = {
                            totalDue: tuition - scholarshipAmount + mandatory + optional + late,
                            breakdown: {
                                tuition, mandatory, optional, scholarship: scholarshipAmount, late,
                                mandatoryItems: Object.values(activeSemesterRules.mandatoryFees || {}),
                                optionalItems: (reg.optionalFees || []).map((fid:string) => ({ name: activeSemesterRules.optionalFees?.[fid]?.name || 'Fee', amount: Number(activeSemesterRules.optionalFees?.[fid]?.amount || 0) }))
                            }
                        };
                    } else {
                        // FALLBACK: Load from registration management settings
                        isProvisional = true;
                        const billingOutput = calculateBilling({
                            policy: activeSemesterRules.billingPolicy || 'course',
                            semesterTuition: Number(activeSemesterRules.tuitionFee || 0),
                            courses: (reg.courses || []).map((cid: string) => {
                                const cost = activeSemesterRules.coursePrices?.[cid] || coursesData[cid]?.cost || 0;
                                return { id: cid, cost: Number(cost) };
                            }),
                            mandatoryFees: Object.values(activeSemesterRules.mandatoryFees || {}).map((f:any) => ({ name: f.name, amount: Number(f.amount || 0) })),
                            optionalFees: (reg.optionalFees || []).map((fid:string) => ({ name: activeSemesterRules.optionalFees?.[fid]?.name || 'Fee', amount: Number(activeSemesterRules.optionalFees?.[fid]?.amount || 0) })),
                            applyScholarship: !!reg.applyScholarship,
                            scholarshipPercentage: Number(reg.scholarshipPercentage || 0),
                            lateFee: 0 
                        });

                        billingResults = {
                            totalDue: billingOutput.grandTotal,
                            breakdown: {
                                tuition: billingOutput.baseTuition,
                                mandatory: billingOutput.totalMandatoryFees,
                                optional: billingOutput.totalOptionalFees,
                                scholarship: billingOutput.scholarshipAmount,
                                late: 0,
                                mandatoryItems: billingOutput.mandatoryItems,
                                optionalItems: billingOutput.optionalItems
                            }
                        };
                    }

                    const invoiceTransactions = transactionsList.filter(t => t.userId === userId && t.invoiceId === reg.invoiceId);
                    const totalPaid = invoiceTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                    const balance = Math.max(0, billingResults.totalDue - totalPaid);
                    
                    const threshold = semesterInfo.paymentThreshold || globalThreshold;
                    const paidPercentage = billingResults.totalDue > 0 ? (totalPaid / billingResults.totalDue) * 100 : 100;
                    const thresholdMet = paidPercentage >= threshold;

                    const semDeadlines = calendarEvents.filter(ev => ev.semester === semesterInfo.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
                    const grace = semesterInfo.gracePeriodDays ?? 7;
                    const passedDeadlines = semDeadlines.filter(ev => isAfter(now, addDays(parseISO(ev.date), grace)));
                    const penaltiesActive = passedDeadlines.length > 0 && !thresholdMet;

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
                        totalDue: billingResults.totalDue, totalPaid, balance,
                        programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId,
                        semesterName: semesterInfo.name,
                        invoiceId: reg.invoiceId, enrolledCourses: reg.courses || [],
                        thresholdMet, penaltiesActive, isScholarship: !!reg.applyScholarship,
                        paidPercentage, targetThreshold: threshold, gracePeriod: grace,
                        status: balance <= 0.01 ? 'Paid' : 'Pending',
                        paymentPlanName: reg.paymentPlan || null,
                        nextInstallmentDue,
                        breakdown: billingResults.breakdown,
                        isProvisional
                    };
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
        unsubs.push(onValue(dataRefs.courses, (s) => { 
            setAllCourses(s.val() || {}); 
            store.courses = s.val() || {};
            computeDerived();
        }));
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
        unsubs.push(onValue(dataRefs.paymentPlans, (s) => {
            const data = s.val() || {};
            setAllPaymentPlans(Object.keys(data).map(id => ({id, ...data[id]})));
            store.paymentPlans = data;
            computeDerived();
        }));
        unsubs.push(onValue(dataRefs.configs, (s) => { store.configs = s.val() || {}; computeDerived(); }));

        const savedFiltersRef = ref(db, `settings/paymentFilters/${userData?.uid || 'default'}`);
        get(savedFiltersRef).then(snapshot => {
            if (snapshot.exists()) {
                const f = snapshot.val();
                if(f.programmeFilter) setProgrammeFilter(f.programmeFilter);
                if(f.intakeFilter) setIntakeFilter(f.intakeFilter);
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
            
            let planMatch = true;
            if (planStatusFilter === 'none') planMatch = !p.paymentPlanName;
            else if (planStatusFilter === 'set') planMatch = !!p.paymentPlanName;
            else if (planStatusFilter !== 'all') planMatch = p.paymentPlanName === planStatusFilter;
            
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

    const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: any) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key === key) {
                const updatedRow = { ...row, [field]: value };
                
                if (field === 'year') {
                    updatedRow.semesterId = '';
                    if (updatedRow.isNewStudent) {
                        updatedRow.availableSemesters = semesters.filter(s => 
                            String(s.year) === value && s.status === 'Open'
                        );
                    } else {
                        const studentProfile = allStudents.find(s => s.uid === updatedRow.userId);
                        updatedRow.availableSemesters = semesters.filter(s => 
                            s.intakeId === studentProfile?.intakeId && String(s.year) === value
                        );
                    }
                }

                if (field === 'userId' && !updatedRow.isNewStudent) {
                    const studentProfile = allStudents.find(s => s.uid === value);
                    const intakeId = studentProfile?.intakeId;
                    const intake = allIntakes.find(i => i.id === intakeId);
                    const intakeStartStr = intake ? parseIntakeDate(intake.name) : null;
                    
                    let state = { year: 1, semester: 1 };
                    if (intakeStartStr && calendarSettings) {
                        state = calculateAcademicState(
                            intakeStartStr,
                            getCurrentServerDate(),
                            calendarSettings.standardCycles,
                            Object.values(calendarSettings.anomalies || {})
                        );
                    }
                    
                    const studentIntakeSemesters = semesters.filter(s => s.intakeId === intakeId);
                    updatedRow.availableYears = Array.from(new Set(studentIntakeSemesters.map(s => String(s.year)))).sort();

                    const latestSemester = studentIntakeSemesters.find(s => 
                        s.year === state.year && 
                        s.semesterInYear === state.semester
                    );

                    if (latestSemester) {
                        const paymentInfo = paymentInfos.find(p => p.userId === value && p.semesterId === latestSemester.id);
                        updatedRow.semesterId = latestSemester.id;
                        updatedRow.academicStanding = latestSemester.name;
                        updatedRow.year = String(latestSemester.year);
                        updatedRow.availableSemesters = studentIntakeSemesters.filter(s => String(s.year) === updatedRow.year);
                        
                        if (paymentInfo) {
                            updatedRow.totalDue = paymentInfo.totalDue;
                            updatedRow.totalPaid = paymentInfo.totalPaid;
                            updatedRow.breakdown = paymentInfo.breakdown;
                        } else {
                            updatedRow.totalDue = 0;
                            updatedRow.totalPaid = 0;
                            updatedRow.breakdown = undefined;
                        }
                    } else if (studentIntakeSemesters.length > 0) {
                        const firstSem = studentIntakeSemesters[0];
                        updatedRow.year = String(firstSem.year);
                        updatedRow.semesterId = firstSem.id;
                        updatedRow.academicStanding = firstSem.name;
                        updatedRow.availableSemesters = studentIntakeSemesters.filter(s => String(s.year) === updatedRow.year);
                    }
                }

                if (field === 'isNewStudent') {
                    updatedRow.userId = undefined;
                    updatedRow.tempStudentId = '';
                    updatedRow.tempStudentName = '';
                    updatedRow.year = '';
                    updatedRow.semesterId = '';
                    updatedRow.academicStanding = undefined;
                    const maxYear = Math.max(...semesters.map(s => s.year), 1);
                    updatedRow.availableYears = Array.from({length: maxYear}, (_, i) => String(i + 1));
                }

                if (field === 'semesterId' && !updatedRow.isNewStudent && updatedRow.userId) {
                    const paymentInfo = paymentInfos.find(p => p.userId === updatedRow.userId && p.semesterId === value);
                    if (paymentInfo) {
                        updatedRow.totalDue = paymentInfo.totalDue;
                        updatedRow.totalPaid = paymentInfo.totalPaid;
                        updatedRow.breakdown = paymentInfo.breakdown;
                    } else {
                        updatedRow.totalDue = 0;
                        updatedRow.totalPaid = 0;
                        updatedRow.breakdown = undefined;
                    }
                }

                return updatedRow;
            }
            return row;
        }));
    };

    const handleQuickPay = (student: StudentPaymentInfo) => {
        const studentProfile = allStudents.find(s => s.uid === student.userId);
        const intake = allIntakes.find(i => i.id === student.intakeId);
        
        let availableYears: string[] = [];
        let availableSemesters: Semester[] = [];
        
        if (intake) {
            availableYears = Array.from(new Set(semesters.filter(s => s.intakeId === intake.id).map(s => String(s.year)))).sort();
            availableSemesters = semesters.filter(s => s.intakeId === intake.id && String(s.year) === String(semesters.find(sem => sem.id === student.semesterId)?.year || '1'));
        }

        const initialRow: PaymentRecord = {
            key: Date.now(),
            userId: student.userId,
            semesterId: student.semesterId || '',
            academicStanding: student.semesterName,
            year: student.semesterId ? String(semesters.find(s => s.id === student.semesterId)?.year || '1') : '1',
            totalDue: student.totalDue,
            totalPaid: student.totalPaid,
            breakdown: student.breakdown,
            amount: '',
            comment: '',
            allocations: [],
            availableYears,
            availableSemesters
        };

        setBulkPaymentRows([initialRow]);
        setIsBulkRecordOpen(true);
    };

    const handleRemovePaymentRow = (key: number) => {
        setBulkPaymentRows(prev => prev.filter(r => r.key !== key));
    };

    const handleSaveAllBulk = async () => {
        if (!user || !userData) return;
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            const now = new Date().toISOString();

            for (const row of bulkPaymentRows) {
                const amount = parseFloat(row.amount);
                if (isNaN(amount) || amount <= 0) continue;

                if (row.isNewStudent) {
                    const reqRef = push(ref(db, 'studentCreationRequests'));
                    const txRef = push(ref(db, 'transactions'));
                    const requestId = reqRef.key!;
                    
                    updates[`studentCreationRequests/${requestId}`] = {
                        tempId: row.tempStudentId,
                        tempName: row.tempStudentName,
                        targetSemesterId: row.semesterId,
                        amountPaid: amount,
                        comment: row.comment,
                        status: 'pending',
                        timestamp: Date.now()
                    };

                    updates[`transactions/${txRef.key}`] = {
                        transactionId: `DEP-${Date.now()}`,
                        userId: 'unlinked',
                        amount,
                        paymentDate: now,
                        status: 'successful',
                        method: 'Cash/Direct',
                        purpose: row.allocations.join(', ') || 'Initial Deposit',
                        comment: row.comment,
                        recordedBy: userData.name,
                        isUnlinked: true,
                        requestId,
                        senderName: row.tempStudentName,
                        tempId: row.tempStudentId
                    };
                } else if (row.userId) {
                    const student = paymentInfos.find(p => p.userId === row.userId && p.semesterId === row.semesterId);
                    if (!student) continue;

                    const txRef = push(ref(db, 'transactions'));
                    updates[`transactions/${txRef.key}`] = {
                        transactionId: `CASH-${Date.now()}`,
                        userId: row.userId,
                        invoiceId: student.invoiceId,
                        amount,
                        paymentDate: now,
                        status: 'successful',
                        method: 'Cash/Direct',
                        purpose: row.allocations.join(', ') || 'Fees Payment',
                        comment: row.comment,
                        recordedBy: userData.name
                    };

                    await createNotification(
                        row.userId,
                        `A payment of ZMW ${amount.toFixed(2)} was recorded for your ${student.semesterName} invoice.`,
                        '/student/payments'
                    );
                }
            }

            await update(ref(db), updates);
            toast({ variant: 'success', title: 'Transactions Recorded', description: `${bulkPaymentRows.length} payment(s) processed.` });
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleSaveAdjustment = async () => {
        if (!adjustmentTarget || !adjAmount || !adjReason.trim() || !user || !userData) return;
        setFormLoading(true);
        try {
            const amountFloat = parseFloat(adjAmount);
            const txRef = push(ref(db, 'transactions'));
            const now = new Date().toISOString();
            
            await set(txRef, {
                transactionId: `${adjustmentTarget.type.toUpperCase()}-${Date.now()}`,
                userId: adjustmentTarget.userId,
                invoiceId: adjustmentTarget.invoiceId,
                amount: adjustmentTarget.type === 'credit' ? amountFloat : -amountFloat,
                status: 'successful',
                paymentDate: now,
                method: 'Adjustment',
                purpose: adjustmentTarget.type === 'credit' ? 'Credit Note' : 'Debit Note',
                comment: adjReason,
                recordedBy: userData.name
            });

            if (adjustmentTarget.type === 'debit') {
                const invRef = ref(db, `invoices/${adjustmentTarget.userId}/${adjustmentTarget.invoiceId}`);
                const invSnap = await get(invRef);
                if (invSnap.exists()) {
                    const currentLate = Number(invSnap.val().lateFee || 0);
                    await update(invRef, { lateFee: currentLate + amountFloat });
                }
            }

            toast({ title: 'Adjustment Recorded' });
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
        doc.text(`Semester: ${student.semesterName || 'N/A'}`, 14, 70);

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

    const handleSaveAsDefault = async () => {
        if (!user || !userData) return;
        setSaving(true);
        try {
            await set(ref(db, `settings/paymentFilters/${userData.uid}`), {
                programmeFilter,
                intakeFilter
            });
            toast({ title: 'Filters Saved' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setSaving(false);
        }
    };

    const studentOptions: OptionGroup[] = React.useMemo(() => {
        const items = allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` }));
        return [{ groupName: 'Student Roster', items }];
    }, [allStudents]);

    const restrictions = financialSettings?.defaulterRestrictions || {};

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
                            <Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Cohort (Intake)</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}><SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Installment Plan</Label>
                            <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}><SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="none">Plan Not Set (Urgent)</SelectItem>
                                    <Separator className="my-1"/>
                                    {allPaymentPlans.filter(p => !p.archived).map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Next Due Within</Label>
                            <Select value={dueFilter} onValueChange={setDueFilter}><SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Any Date</SelectItem><SelectItem value="7">7 Days</SelectItem><SelectItem value="14">14 Days</SelectItem><SelectItem value="30">30 Days</SelectItem><SelectItem value="overdue">Already Overdue</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Search</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-50"/><Input className="pl-8 h-9 bg-background border-primary/20" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-dashed">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Min Paid</Label>
                            <Input type="number" placeholder="0.00" value={minPaidFilter} onChange={e => setMinPaidFilter(e.target.value)} className="h-8 text-xs border-primary/20" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Max Paid</Label>
                            <Input type="number" placeholder="99999" value={maxPaidFilter} onChange={e => setMaxPaidFilter(e.target.value)} className="h-8 text-xs border-primary/20" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Equal to</Label>
                            <div className="relative">
                                <Equal className="absolute left-2 top-2.5 h-3 w-3 opacity-40"/>
                                <Input type="number" placeholder="Exact match..." value={equalPaidFilter} onChange={e => setEqualPaidFilter(e.target.value)} className="pl-7 h-8 text-xs border-primary/20" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-md border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>System ID</TableHead>
                                    <TableHead>User & Plan</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-right">Paid</TableHead>
                                    <TableHead className="text-center">Standing</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((info) => (
                                    <TableRow key={`${info.userId}-${info.semesterId}`} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-mono text-[10px] font-black opacity-60">{info.studentId}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{info.studentName}</span>
                                                {info.paymentPlanName ? <Badge variant="outline" className="w-fit h-4 text-[8px] uppercase border-primary/20">{info.paymentPlanName}</Badge> : <Badge variant="destructive" className="w-fit h-4 text-[8px] uppercase animate-pulse">Plan Not Set</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex flex-col items-end">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-black text-sm text-destructive">ZMW {info.balance.toFixed(2)}</span>
                                                            {info.isProvisional && <Badge variant="outline" className="h-3 text-[7px] font-black uppercase border-orange-200 text-orange-600 bg-orange-50/50">Provisional</Badge>}
                                                        </div>
                                                        <span className="text-[8px] uppercase font-bold opacity-40">Itemized Due <ChevronDown className="h-2 w-2 inline ml-0.5" /></span>
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-4 shadow-2xl">
                                                    <div className="space-y-3">
                                                        <div className="flex flex-col gap-1">
                                                            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Balance Breakdown</h4>
                                                            {info.isProvisional && (
                                                                <p className="text-[9px] text-orange-600 font-bold italic leading-tight">* Projected from Semester Settings (No Official Invoice Yet)</p>
                                                            )}
                                                        </div>
                                                        <Separator />
                                                        <div className="space-y-1.5 text-xs">
                                                            <div className="flex justify-between"><span>Tuition:</span> <span className="font-bold">ZMW {info.breakdown.tuition.toFixed(2)}</span></div>
                                                            {info.breakdown.scholarship > 0 && <div className="flex justify-between text-blue-600"><span>Scholarship credit:</span> <span className="font-bold">- ZMW {info.breakdown.scholarship.toFixed(2)}</span></div>}
                                                            {info.breakdown.mandatoryItems?.map((f, i) => <div key={i} className="flex justify-between opacity-70"><span>{f.name}:</span> <span>ZMW {f.amount.toFixed(2)}</span></div>)}
                                                            {info.breakdown.optionalItems?.map((f, i) => <div key={`opt-${i}`} className="flex justify-between opacity-70"><span>{f.name}:</span> <span>ZMW {f.amount.toFixed(2)}</span></div>)}
                                                            {info.breakdown.late > 0 && <div className="flex justify-between text-destructive"><span>Late Fees:</span> <span className="font-bold">ZMW {info.breakdown.late.toFixed(2)}</span></div>}
                                                            <Separator className="my-2" />
                                                            <div className="flex justify-between font-black"><span>Net Semester Total:</span> <span>ZMW {info.totalDue.toFixed(2)}</span></div>
                                                            <div className="flex justify-between text-green-600"><span>Cleared to date:</span> <span>- ZMW {info.totalPaid.toFixed(2)}</span></div>
                                                            <div className="flex justify-between font-black text-destructive text-lg pt-1 border-t"><span>Still Due:</span> <span>ZMW {info.balance.toFixed(2)}</span></div>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                                                        {info.balance <= 0.01 ? (
                                                            <Badge variant="default" className="bg-green-600 h-5 px-3 uppercase text-[8px] font-black">Cleared</Badge>
                                                        ) : info.thresholdMet ? (
                                                            <Badge variant="secondary" className="bg-primary/10 text-primary h-5 px-3 uppercase text-[8px] font-black">Good Standing</Badge>
                                                        ) : (
                                                            <Badge variant="destructive" className="h-5 px-3 uppercase text-[8px] font-black animate-pulse">Below Threshold</Badge>
                                                        )}
                                                        {info.nextInstallmentDue && (
                                                            <span className="text-[8px] font-bold opacity-60 mt-1 uppercase">Next Due: {format(parseISO(info.nextInstallmentDue), 'dd MMM')}</span>
                                                        )}
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-4 shadow-2xl" align="center">
                                                    <div className="space-y-3">
                                                        <h4 className="text-[10px] font-black uppercase text-primary border-b pb-2 tracking-widest">Standing Details</h4>
                                                        <div className="space-y-2 text-[10px] font-bold uppercase">
                                                            <div className="flex justify-between items-center">
                                                                <span className="opacity-60">Required Threshold:</span>
                                                                <span>{info.targetThreshold}%</span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="opacity-60">Actual Paid %:</span>
                                                                <span className={cn(info.thresholdMet ? "text-green-600" : "text-destructive")}>{info.paidPercentage.toFixed(1)}%</span>
                                                            </div>
                                                            <Separator className="my-2" />
                                                            <div className="space-y-1.5">
                                                                <span className="text-[9px] font-black opacity-40">System Access Restrictions:</span>
                                                                <div className="flex justify-between items-center">
                                                                    <span>Reg. Window</span>
                                                                    {restrictions.registration && !info.thresholdMet ? <AlertTriangle className="text-red-500 h-3 w-3"/> : <CheckCircle2 className="text-green-600 h-3 w-3"/>}
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span>Exam Results</span>
                                                                    {restrictions.results && !info.thresholdMet ? <AlertTriangle className="text-red-500 h-3 w-3"/> : <CheckCircle2 className="text-green-600 h-3 w-3"/>}
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span>Library Access</span>
                                                                    {restrictions.library && !info.thresholdMet ? <AlertTriangle className="text-red-500 h-3 w-3"/> : <CheckCircle2 className="text-green-600 h-3 w-3"/>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" title="Quick Payment" onClick={() => handleQuickPay(info)}>
                                                    <Banknote className="h-4 w-4"/>
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuLabel>Audit Tools</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }}><HistoryIcon className="mr-2 h-4 w-4"/>Statement of Account</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => { setAdjustmentTarget({ type: 'credit', id: info.userId, userId: info.userId, studentName: info.studentName, studentId: info.studentId, invoiceId: info.invoiceId }); setIsAdjustmentOpen(true); }}><Plus className="mr-2 h-4 w-4 rotate-45 text-blue-600"/>Issue Credit Note</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => { setAdjustmentTarget({ type: 'debit', id: info.userId, userId: info.userId, studentName: info.studentName, studentId: info.studentId, invoiceId: info.invoiceId }); setIsAdjustmentOpen(true); }} className="text-destructive"><Plus className="mr-2 h-4 w-4 text-destructive"/>Issue Debit Note</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
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
                    <DialogHeader><DialogTitle className="text-2xl font-black">Record Transaction(s)</DialogTitle><DialogDescription>Process manual deposits and installment payments.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 py-4">
                        {bulkPaymentRows.map((row, idx) => {
                            const amountNum = parseFloat(row.amount) || 0;
                            const afterPay = (row.totalDue || 0) - (row.totalPaid || 0) - amountNum;

                            return (
                            <Card key={row.key} className="border-l-4 border-l-primary relative group overflow-hidden shadow-md">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemovePaymentRow(row.key)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{idx + 1}</div>
                                                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Recipient Details</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch checked={row.isNewStudent} onCheckedChange={v => handleBulkPaymentRowChange(row.key, 'isNewStudent', v)} />
                                                <span className="text-[10px] font-black uppercase text-primary tracking-tighter">Request Student Creation?</span>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4 pt-2">
                                            {row.isNewStudent ? (
                                                <div className="grid grid-cols-2 gap-3"><Input placeholder="Full Name" value={row.tempStudentName} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentName', e.target.value)} className="h-10 text-xs"/><Input placeholder="Temp ID (e.g. APP-01)" value={row.tempStudentId} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentId', e.target.value)} className="h-10 text-xs font-mono"/></div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <SearchableSelect options={studentOptions} value={row.userId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'userId', v)} placeholder="Search student name or ID..." />
                                                    {row.academicStanding && (
                                                        <Badge variant="secondary" className="gap-1.5 font-bold text-[9px] uppercase border-primary/10 bg-primary/5 text-primary">
                                                            <UserCheck className="h-3 w-3"/> Standing: {row.academicStanding}
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] font-black uppercase opacity-60">Target Year</Label>
                                                    <Select value={row.year} onValueChange={v => handleBulkPaymentRowChange(row.key, 'year', v)}>
                                                        <SelectTrigger className="h-10 text-xs border-primary/20"><SelectValue placeholder="Year..."/></SelectTrigger>
                                                        <SelectContent>{(row.availableYears || []).map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] font-black uppercase opacity-60">Target Semester</Label>
                                                    <Select value={row.semesterId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'semesterId', v)} disabled={!row.year}>
                                                        <SelectTrigger className="h-10 text-xs border-primary/20"><SelectValue placeholder="Phase..."/></SelectTrigger>
                                                        <SelectContent>{(row.availableSemesters || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' ').slice(-2).join(' ')}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator className="my-4" />

                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <div className="relative">
                                                <Input type="number" placeholder="Amount (ZMW)" value={row.amount} onChange={e => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} className="h-11 font-black text-green-600 border-green-200 pl-8 bg-green-50/30" />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-40">K</span>
                                            </div>
                                            <Input placeholder="Reference/Slip #..." value={row.comment} onChange={e => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-11 text-xs border-primary/20 bg-background" />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border-l pl-8 border-dashed">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-black text-[10px] uppercase text-muted-foreground tracking-widest">Transaction Summary</Label>
                                                <Badge variant="outline" className="h-6 gap-1 px-3 border-primary/30 text-[10px] font-bold">Audit <Info className="h-3 w-3 text-primary"/></Badge>
                                            </div>
                                            <div className="grid grid-cols-3 divide-x rounded-xl border bg-card shadow-inner overflow-hidden">
                                                <div className="p-3 flex flex-col items-center justify-center gap-1">
                                                    <span className="text-[9px] font-bold text-orange-500 uppercase tracking-tighter">Due</span>
                                                    <span className="text-xl font-black text-orange-500">K{(row.totalDue || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="p-3 flex flex-col items-center justify-center gap-1">
                                                    <span className="text-[9px] font-bold text-green-600 uppercase tracking-tighter">Paid</span>
                                                    <span className="text-xl font-black text-green-600">K{(row.totalPaid || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="p-3 flex flex-col items-center justify-center gap-1">
                                                    <span className="text-[9px] font-bold text-red-600 uppercase tracking-tighter">After Pay</span>
                                                    <span className="text-xl font-black text-red-600">K{afterPay.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Ledger Allocation</Label>
                                        
                                        <ScrollArea className="h-32 border rounded-xl p-3 bg-muted/5 shadow-inner">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors border border-transparent hover:border-primary/10">
                                                    <Checkbox id={`tuition-${row.key}`} checked={row.allocations.includes('Tuition')} onCheckedChange={c => handleBulkPaymentRowChange(row.key, 'allocations', c ? [...row.allocations, 'Tuition'] : row.allocations.filter(a=>a!=='Tuition'))}/>
                                                    <Label htmlFor={`tuition-${row.key}`} className="text-xs cursor-pointer flex-1 font-medium">Tuition Fees</Label>
                                                </div>
                                                {row.breakdown?.mandatoryItems?.map((f, i) => (
                                                    <div key={i} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors border border-transparent hover:border-primary/10">
                                                        <Checkbox id={`mand-${row.key}-${i}`} checked={row.allocations.includes(f.name)} onCheckedChange={c => handleBulkPaymentRowChange(row.key, 'allocations', c ? [...row.allocations, f.name] : row.allocations.filter(a=>a!==f.name))}/>
                                                        <Label htmlFor={`mand-${row.key}-${i}`} className="text-xs cursor-pointer flex-1 font-medium">{f.name}</Label>
                                                    </div>
                                                ))}
                                                {row.breakdown?.optionalItems?.map((f, i) => (
                                                    <div key={`opt-${i}`} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors border border-transparent hover:border-primary/10 text-muted-foreground opacity-80">
                                                        <Checkbox id={`opt-${row.key}-${i}`} checked={row.allocations.includes(f.name)} onCheckedChange={c => handleBulkPaymentRowChange(row.key, 'allocations', c ? [...row.allocations, f.name] : row.allocations.filter(a=>a!==f.name))}/>
                                                        <Label htmlFor={`opt-${row.key}-${i}`} className="text-xs cursor-pointer flex-1">{f.name}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        )})}
                        <Button variant="outline" className="w-full border-dashed border-2 py-8 rounded-xl bg-muted/5 hover:bg-primary/5 group" onClick={() => setBulkPaymentRows(p => [...p, { key: Date.now(), amount: '', comment: '', allocations: [] }])}>
                            <Plus className="mr-2 h-5 w-5 text-primary group-hover:scale-110 transition-transform"/>
                            <span className="font-black uppercase text-[10px] tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Add Transaction Row</span>
                        </Button>
                    </div>
                    <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg">
                        <Button onClick={handleSaveAllBulk} disabled={formLoading || bulkPaymentRows.length === 0} className="h-12 px-12 shadow-xl font-black uppercase tracking-widest text-xs">
                            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileCheck className="mr-2 h-4 w-4" />}
                            Process & Finalize Batch
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg"><HistoryIcon className="h-5 w-5 text-primary"/></div>
                            <div>
                                <DialogTitle>Student Statement of Account</DialogTitle>
                                <DialogDescription className="font-bold text-foreground">{historyStudent?.studentName} ({historyStudent?.studentId})</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {historyStudent && (
                        <div className="flex-1 mt-6 overflow-hidden flex flex-col">
                            <Tabs defaultValue={historyStudent.semesterId || ''} className="flex-1 flex flex-col overflow-hidden">
                                <TabsList className="justify-start bg-muted/50 p-1 h-auto flex-wrap">
                                    {paymentInfos
                                        .filter(p => p.userId === historyStudent.userId)
                                        .sort((a, b) => b.semesterName!.localeCompare(a.semesterName!))
                                        .map(p => (
                                            <TabsTrigger key={p.semesterId} value={p.semesterId!} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                                {p.semesterName?.split(' ').slice(-2).join(' ')}
                                            </TabsTrigger>
                                        ))
                                    }
                                </TabsList>
                                
                                {paymentInfos
                                    .filter(p => p.userId === historyStudent.userId)
                                    .map(p => (
                                        <TabsContent key={p.semesterId} value={p.semesterId!} className="flex-1 flex flex-col mt-4 overflow-hidden border rounded-xl bg-background shadow-inner">
                                            <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Semester Summary</span>
                                                    <p className="text-sm font-bold">{p.semesterName}</p>
                                                </div>
                                                <div className="flex gap-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-bold opacity-60">Total Due</span>
                                                        <span className="text-sm font-black">K{p.totalDue.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-bold opacity-60">Paid</span>
                                                        <span className="text-sm font-black text-green-600">K{p.totalPaid.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-bold opacity-60">Balance</span>
                                                        <span className="text-sm font-black text-destructive">K{p.balance.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ScrollArea className="flex-1">
                                                <Table>
                                                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                                        <TableRow>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Ref / Purpose</TableHead>
                                                            <TableHead className="text-right">Credit (+)</TableHead>
                                                            <TableHead className="text-right">Debit (-)</TableHead>
                                                            <TableHead className="text-right">Audit</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {rawTransactions
                                                            .filter(t => t.userId === p.userId && t.invoiceId === p.invoiceId)
                                                            .map(tx => (
                                                                <TableRow key={tx.key} className="hover:bg-muted/10 transition-colors border-b last:border-0">
                                                                    <TableCell className="text-xs font-medium">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                                    <TableCell>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold text-xs leading-none">{tx.purpose || 'Fees Payment'}</span>
                                                                            <span className="text-[9px] opacity-40 font-mono mt-1 tracking-tighter">ID: {tx.transactionId}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-green-600 font-black text-sm">{tx.amount > 0 ? `K${tx.amount.toFixed(2)}` : '-'}</TableCell>
                                                                    <TableCell className="text-right text-red-600 font-black text-sm">{tx.amount < 0 ? `K${Math.abs(tx.amount).toFixed(2)}` : '-'}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 text-primary" onClick={() => generateReceipt(tx, p)}><Download className="h-4 w-4"/></Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        {rawTransactions.filter(t => t.userId === p.userId && t.invoiceId === p.invoiceId).length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No transactions recorded for this semester.</TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </ScrollArea>
                                        </TabsContent>
                                    ))}
                            </Tabs>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <div className="flex items-center gap-3 text-primary mb-2">
                            {adjustmentTarget?.type === 'credit' ? <Plus className="h-6 w-6 rotate-45" /> : <Plus className="h-6 w-6" />}
                            <DialogTitle className="text-xl font-headline uppercase tracking-tight">Issue {adjustmentTarget?.type === 'credit' ? 'Credit' : 'Debit'} Note</DialogTitle>
                        </div>
                        <DialogDescription className="text-base">
                            Applying a financial adjustment to <span className="font-black text-foreground">{adjustmentTarget?.studentName}'s</span> ledger.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-6 border-y border-dashed my-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Adjustment Amount (ZMW)</Label>
                            <div className="relative">
                                <Input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="0.00" className="h-14 text-2xl font-black bg-muted/20 border-primary/20 pl-10" />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black opacity-30 text-xl">K</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Formal Reasoning</Label>
                            <Textarea value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Provide context for this adjustment (Audit requirement)..." rows={4} className="resize-none" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild><Button variant="ghost" className="font-bold">Discard</Button></DialogClose>
                        <Button onClick={handleSaveAdjustment} disabled={formLoading || !adjAmount || !adjReason.trim()} className="px-8 shadow-lg font-black uppercase tracking-widest text-[10px]">
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4"/> : <FileCheck className="mr-2 h-4 w-4"/>}
                            Post Note & Sync Ledger
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
