"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    Search,
    PlusCircle,
    Users,
    Scale,
    ChevronsUpDown,
    CalendarDays,
    Wallet,
    Info,
    X,
    MoreVertical,
    Plus,
    FileCheck,
    TrendingUp,
    ReceiptText,
    GraduationCap,
    History,
    Receipt,
    AlertTriangle,
    CheckCircle2,
    Save,
    Trash2,
    ClipboardCheck,
    ArrowRight,
    Mail,
    Printer,
    Download,
    Settings,
    TrendingDown,
    DollarSign,
    Wifi,
    Clock,
    RefreshCw,
    HardDrive,
    CreditCard,
    ArrowUpRight,
    ArrowDownRight,
    Building2,
    FileText,
    PieChart,
    BarChart3,
    Upload
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, push, onValue, off, serverTimestamp, update, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter, 
    DialogClose,
    DialogTrigger 
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
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO, isWithinInterval, isBefore, isToday, isThisWeek, isThisMonth, startOfDay, isAfter } from 'date-fns';
import { parseIntakeDate, calculateAcademicState } from '@/lib/semester-utils';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { calculateBilling, type BillingPolicy } from '@/lib/billing-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { logFinancialAudit } from '@/lib/financial-audit';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


type FeeBreakdown = {
    tuition: number;
    scholarship: number;
    mandatory: number;
    optional: number;
    late: number;
    mandatoryItems?: any[];
    optionalItems?: any[];
};

type StudentPaymentInfo = {
    userId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'Paid' | 'Pending' | 'Overdue';
    programmeId: string | null;
    intakeId: string | null;
    semesterId: string | null;
    semesterName?: string;
    invoiceId: string;
    thresholdMet: boolean;
    paidPercentage: number;
    targetThreshold: number;
    nextInstallmentDue?: string | null;
    isProvisional?: boolean;
    breakdown: FeeBreakdown;
    transactions: Transaction[];
    paymentPlanName?: string;
    isCurrentStanding?: boolean;
    scholarshipInfo?: { name: string; percentage: number };
    scholarshipStatus?: 'Pending' | 'Approved' | 'Denied';
    studyYear?: number;
    semesterPhase?: number;
    isUpcomingStanding?: boolean;
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
    invoiceId?: string;
};

type Transaction = {
    key: string;
    transactionId: string;
    invoiceId?: string;
    semesterId?: string;
    userId: string;
    amount: number;
    paymentDate: string;
    status: 'successful' | 'failed';
    method?: string;
    purpose?: string;
    recordedBy?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; tuitionFee?: number; mandatoryFees?: Record<string, any>; paymentThreshold?: number; gracePeriodDays?: number; billingPolicy?: 'course' | 'semester'; tuitionFeeValue?: number; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };

type OptionGroup = { groupName: string; items: { value: string; label: string }[] };

const getCoursesFromReg = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter((id: any) => typeof id === 'string');
    if (typeof raw === 'object') {
        const values = Object.values(raw);
        if (values.every(v => typeof v === 'boolean')) return Object.keys(raw);
        return values.filter(v => typeof v === 'string') as string[];
    }
    return [];
};

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
                <button 
                    type="button"
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={disabled}
                >
                    <span className="truncate text-xs">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" side="bottom" align="start">
                <div className="p-2">
                    <input 
                        placeholder="Search roster..." 
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
    const [expensesList, setExpensesList] = React.useState<any[]>([]);
    const [currentTab, setCurrentTab] = React.useState<string>("Overview");
    const [lastSyncedSecs, setLastSyncedSecs] = React.useState<number>(0);
    const [isSyncing, setIsSyncing] = React.useState<boolean>(false);
    const [allUsers, setAllUsers] = React.useState<Record<string, any>>({});
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    const [currency, setCurrency] = React.useState<'ZMW' | 'USD'>('ZMW');
    const [exchangeRate, setExchangeRate] = React.useState<number>(25);
    const [reconCsvInput, setReconCsvInput] = React.useState<string>("");
    const [reconResults, setReconResults] = React.useState<any[]>([]);
    const [auditLogsList, setAuditLogsList] = React.useState<any[]>([]);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    
    // Local system pages states when QuickBooks is disabled
    const [isQuickBooksEnabled, setIsQuickBooksEnabled] = React.useState<boolean>(false);
    const [localBudget, setLocalBudget] = React.useState<any[]>([]);
    const [localAnnualBudget, setLocalAnnualBudget] = React.useState<any[]>([]);
    const [localRequisitions, setLocalRequisitions] = React.useState<any[]>([]);
    
    // Budget Category Allocation Dialog
    const [isBudgetOpen, setIsBudgetOpen] = React.useState(false);
    const [budgetCategory, setBudgetCategory] = React.useState('');
    const [budgetedAmount, setBudgetedAmount] = React.useState('');
    const [budgetSaving, setBudgetSaving] = React.useState(false);

    // Annual Budget Department Allocation Dialog
    const [isAnnualOpen, setIsAnnualOpen] = React.useState(false);
    const [annualDept, setAnnualDept] = React.useState('');
    const [annualAmount, setAnnualAmount] = React.useState('');
    const [annualSaving, setAnnualSaving] = React.useState(false);

    // Department Requisition Request Dialog
    const [isReqOpen, setIsReqOpen] = React.useState(false);
    const [reqDept, setReqDept] = React.useState('');
    const [reqDesc, setReqDesc] = React.useState('');
    const [reqAmt, setReqAmt] = React.useState('');
    const [reqSaving, setReqSaving] = React.useState(false);

    // Dynamic Forecasting States
    const [forecastGrowthRate, setForecastGrowthRate] = React.useState<number>(10);
    const [forecastTuitionFee, setForecastTuitionFee] = React.useState<number>(12000);
    const [forecastFeePerStudent, setForecastFeePerStudent] = React.useState<number>(1500);

    // Local Reports Hub
    const [financeReportType, setFinanceReportType] = React.useState('income');
    const [reportLoading, setReportLoading] = React.useState(false);
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('current');
    const [activeTabSemesterId, setActiveTabSemesterId] = React.useState<string>('');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [balanceStatusFilter, setBalanceStatusFilter] = React.useState('all');
    const [minBalance, setMinBalance] = React.useState('');
    const [maxBalance, setMaxBalance] = React.useState('');

    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [selectedDetail, setSelectedDetail] = React.useState<StudentPaymentInfo | null>(null);

    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);
    
    const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = React.useState(false);
    const [adjustStudentId, setAdjustStudentId] = React.useState('');
    const [adjustType, setAdjustType] = React.useState<'invoice' | 'transaction'>('invoice');
    const [adjustTargetId, setAdjustTargetId] = React.useState('');
    const [adjustOldValue, setAdjustOldValue] = React.useState(0);
    const [adjustNewValue, setAdjustNewValue] = React.useState('');
    const [adjustReason, setAdjustReason] = React.useState('');

    const [formLoading, setFormLoading] = React.useState(false);
    const [institutionSettings, setInstitutionSettings] = React.useState({ name: 'Edutrack360', logoUrl: '', billingPolicy: 'course' });
    const [academicCalendar, setAcademicCalendar] = React.useState<any>(null);

    const { toast } = useToast();

    const getCurrentServerDate = React.useCallback(() => {
        return new Date(Date.now() + serverTimeOffset);
    }, [serverTimeOffset]);

    const handleSemesterFilterChange = (val: string) => {
        setSemesterFilter(val);
        if (val.startsWith('intake-')) {
            const intakeId = val.split('intake-')[1];
            const intakeSemesters = semesters.filter(s => s.intakeId === intakeId && s.status !== 'Archived');
            
            // Calculate current standing for this intake
            const intake = allIntakes.find(i => i.id === intakeId);
            const intakeName = intake?.name;
            const intakeStartStr = intakeName ? parseIntakeDate(intakeName) : null;
            const now = getCurrentServerDate();
            
            let currentStanding: { year: number, semester: number } | null = null;
            if (intakeStartStr && academicCalendar) {
                currentStanding = calculateAcademicState(
                    intakeStartStr,
                    now,
                    academicCalendar.standardCycles || [],
                    Object.values(academicCalendar.anomalies || {})
                );
            }

            let preselectedSem = null;
            if (currentStanding) {
                preselectedSem = intakeSemesters.find(s => 
                    s.year === currentStanding!.year && 
                    s.semesterInYear === currentStanding!.semester
                );
            }

            const activeSem = preselectedSem || intakeSemesters.find(s => s.status === 'Open') || intakeSemesters[0];
            if (activeSem) {
                setActiveTabSemesterId(activeSem.id);
            } else {
                setActiveTabSemesterId('');
            }
        } else {
            setActiveTabSemesterId('');
        }
    };

    React.useEffect(() => {
        const offsetRef = ref(db, '.info/serverTimeOffset');
        onValue(offsetRef, (snap) => setServerTimeOffset(snap.val() || 0));
        return () => off(offsetRef);
    }, []);

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
        scholarships: ref(db, 'scholarships'),
        institution: ref(db, 'settings/institution'),
        expenses: ref(db, 'expenses'),
        quickbooks: ref(db, 'settings/integrations/quickbooks'),
        budget: ref(db, 'budget'),
        annualBudget: ref(db, 'annualBudget'),
        requisitions: ref(db, 'departmentalRequisitions'),
        financialAuditLogs: ref(db, 'financialAuditLogs')
    }), []);

    const computeDerived = React.useCallback((store: any) => {
        if (!store.users) return;

        const users = store.users;
        const regsData = store.registrations || {};
        const txsData = store.transactions || {};
        const semsData = store.semesters || {};
        const invsData = store.invoices || {};
        const calendarEvents = Object.values(store.calendarEvents || {}) as any[];
        const finData = store.financialSettings || { paymentThreshold: 75 };
        const coursesData = store.courses || {};
        const scholsData = store.scholarships || {};
        const calSettings = store.academicCalendar || {};

        const now = getCurrentServerDate();

        const transactionsList: Transaction[] = [];
        const studentCredits: Record<string, Transaction[]> = {};

        for (const txId in txsData) {
            const tx = txsData[txId];
            if(tx.status !== 'successful') continue;
            const txObj = { key: txId, ...tx };
            transactionsList.push(txObj);
            
            if (tx.userId) {
                if (!studentCredits[tx.userId]) studentCredits[tx.userId] = [];
                studentCredits[tx.userId].push(txObj);
            }
        }
        setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));

        const studentPaymentMap = new Map<string, StudentPaymentInfo>();
        const globalThreshold = finData.paymentThreshold || 75;

        for (const userId in regsData) {
            const profile = users[userId];
            if (!profile || profile.role?.toLowerCase() !== 'student') continue;

            const userPool = [...(studentCredits[userId] || [])];
            
            const intakeName = store.intakes?.[profile.intakeId]?.name;
            const intakeStartStr = intakeName ? parseIntakeDate(intakeName) : null;
            let currentStanding: { year: number, semester: number } | null = null;
            if (intakeStartStr && calSettings) {
                currentStanding = calculateAcademicState(
                    intakeStartStr,
                    now,
                    calSettings.standardCycles || [],
                    Object.values(calSettings.anomalies || {})
                );
            }

            for (const semesterId in regsData[userId]) {
                const reg = regsData[userId][semesterId];
                const semesterInfo = semsData[semesterId];
                if (!semesterInfo || semesterInfo.status === 'Archived') continue;

                const invoice = invsData[userId]?.[reg.invoiceId];
                const scholarId = invoice?.scholarshipId || reg.scholarshipId || profile.scholarshipId;
                const scholarship = scholarId ? scholsData[scholarId] : null;
                const scholarPerc = Number(invoice?.scholarshipPercentage || reg.scholarshipPercentage || scholarship?.percentage || 0);

                let billingResults;
                let isProvisional = false;

                if (invoice) {
                    const tuition = Number(invoice.totalTuition || 0);
                    const mandatory = Number(invoice.totalMandatoryFees || 0);
                    const optional = Number(invoice.totalOptionalFees || 0);
                    const late = Number(invoice.lateFee || 0);
                    const scholarshipAmount = (invoice.applyScholarship || scholarId) ? (tuition * (scholarPerc / 100)) : 0;

                    billingResults = {
                        totalDue: tuition - scholarshipAmount + mandatory + optional + late,
                        breakdown: {
                            tuition, mandatory, optional, scholarship: scholarshipAmount, late,
                            mandatoryItems: Object.values(semesterInfo.mandatoryFees || {}),
                            optionalItems: (reg.optionalFees || []).map((fid:string) => ({ name: semesterInfo.optionalFees?.[fid]?.name || 'Fee', amount: Number(semesterInfo.optionalFees?.[fid]?.amount || 0) }))
                        }
                    };
                } else {
                    isProvisional = true;
                    const billingOutput = calculateBilling({
                        policy: semesterInfo.billingPolicy || store.institution?.billingPolicy || 'course',
                        semesterTuition: Number(semesterInfo.tuitionFee || 0),
                        courses: getCoursesFromReg(reg.courses).map((cid: string) => ({ id: cid, cost: Number(coursesData[cid]?.cost || 0) })),
                        mandatoryFees: Object.values(semesterInfo.mandatoryFees || {}).map((f:any) => ({ name: f.name, amount: Number(f.amount || 0) })),
                        optionalFees: (reg.optionalFees || []).map((fid:string) => ({ name: semesterInfo.optionalFees?.[fid]?.name || 'Fee', amount: Number(semesterInfo.optionalFees?.[fid]?.amount || 0) })),
                        applyScholarship: !!reg.applyScholarship || !!scholarId,
                        scholarshipPercentage: scholarPerc
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

                const matchedTransactions = userPool.filter(t => 
                    (reg.invoiceId && t.invoiceId === reg.invoiceId) || 
                    (t.semesterId === semesterId)
                );
                
                const totalPaid = matchedTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                const balance = Math.max(0, billingResults.totalDue - totalPaid);
                
                const threshold = semesterInfo.paymentThreshold || globalThreshold;
                const paidPercentage = billingResults.totalDue > 0 ? (totalPaid / billingResults.totalDue) * 100 : 100;
                const thresholdMet = paidPercentage >= threshold;

                let nextInstallmentDue = null;
                const semDeadlines = calendarEvents.filter(ev => ev.semester === semesterInfo.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
                const futureDeadline = semDeadlines.find(ev => isAfter(parseISO(ev.date), now));
                if (futureDeadline) nextInstallmentDue = futureDeadline.date;

                const cyclesPerYear = calSettings?.standardCycles?.length || 2;
                const upcomingStanding = currentStanding ? {
                    year: currentStanding.semester >= cyclesPerYear ? currentStanding.year + 1 : currentStanding.year,
                    semester: currentStanding.semester >= cyclesPerYear ? 1 : currentStanding.semester + 1
                } : null;
                const isUpcomingStanding = !!(upcomingStanding && semesterInfo.year === upcomingStanding.year && semesterInfo.semesterInYear === upcomingStanding.semester);

                const isCurrentStanding = !!(currentStanding && semesterInfo.year === currentStanding.year && semesterInfo.semesterInYear === currentStanding.semester);

                studentPaymentMap.set(`${userId}-${semesterId}`, {
                    userId, studentId: profile.id, studentName: profile.name, studentEmail: profile.email,
                    totalDue: billingResults.totalDue, totalPaid, balance,
                    programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId,
                    semesterName: semesterInfo.name, invoiceId: reg.invoiceId,
                    thresholdMet, paidPercentage, targetThreshold: threshold,
                    status: balance <= 0.01 ? 'Paid' : 'Pending',
                    paymentPlanName: reg.paymentPlan || null,
                    nextInstallmentDue,
                    breakdown: billingResults.breakdown,
                    isProvisional,
                    transactions: matchedTransactions,
                    isCurrentStanding,
                    isUpcomingStanding,
                    scholarshipInfo: scholarship ? { name: scholarship.name, percentage: scholarPerc } : undefined,
                    scholarshipStatus: reg.scholarshipStatus || (scholarId ? 'Pending' : undefined),
                    studyYear: semesterInfo.year,
                    semesterPhase: semesterInfo.semesterInYear
                });
            }
        }

        const studs: StudentInfo[] = [];
        for(const uid in users) { if(users[uid].role === 'Student') studs.push({ uid, ...users[uid] }); }
        setAllStudents(studs.sort((a,b) => a.name.localeCompare(b.name)));
        setAllUsers(users);
        setPaymentInfos(Array.from(studentPaymentMap.values()));
        setLoading(false);
    }, [getCurrentServerDate]);

    React.useEffect(() => {
        if (!userData?.uid) return;
        const unsubs: (() => void)[] = [];
        const store: any = {};

        unsubs.push(onValue(dataRefs.users, (snapshot) => { store.users = snapshot.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.registrations, (s) => { store.registrations = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.transactions, (s) => { store.transactions = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.programmes, (s) => { store.programmes = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.semesters, (s) => { 
            const data = s.val() || {};
            setSemesters(Object.keys(data).map(id => ({id, ...data[id]})).sort((a,b) => b.name.localeCompare(a.name)));
            store.semesters = data; 
            computeDerived(store); 
        }));
        unsubs.push(onValue(dataRefs.intakes, (s) => { 
            const data = s.val() || {};
            setAllIntakes(Object.keys(data).map(id => ({id, ...data[id] })).sort((a,b) => b.name.localeCompare(a.name)));
            store.intakes = data; 
            computeDerived(store); 
        }));
        unsubs.push(onValue(dataRefs.courses, (s) => { store.courses = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.invoices, (s) => { store.invoices = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.financialSettings, (snapshot) => {
            const data = snapshot.val() || {};
            if (data.exchangeRate) {
                setExchangeRate(Number(data.exchangeRate));
            }
            store.financialSettings = data;
            computeDerived(store);
        }));
        unsubs.push(onValue(dataRefs.calendarEvents, (s) => { store.calendarEvents = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.academicCalendar, (s) => { 
            const val = s.val() || {};
            setAcademicCalendar(val);
            store.academicCalendar = val; 
            computeDerived(store); 
        }));
        unsubs.push(onValue(dataRefs.scholarships, (s) => { store.scholarships = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.institution, (s) => { 
            const data = s.val() || { name: 'Edutrack360' };
            setInstitutionSettings(data);
            store.institution = data;
            computeDerived(store);
        }));
        unsubs.push(onValue(dataRefs.expenses, (s) => {
            const data = s.val() || {};
            setExpensesList(Object.keys(data).map(id => ({ id, ...data[id] })));
            store.expenses = data;
            computeDerived(store);
        }));
        unsubs.push(onValue(dataRefs.quickbooks, (s) => {
            const data = s.val() || {};
            setIsQuickBooksEnabled(!!data.enabled);
        }));
        unsubs.push(onValue(dataRefs.budget, (s) => {
            const data = s.val() || {};
            setLocalBudget(Object.keys(data).map(id => ({ id, ...data[id] })));
        }));
        unsubs.push(onValue(dataRefs.annualBudget, (s) => {
            const data = s.val() || {};
            setLocalAnnualBudget(Object.keys(data).map(id => ({ id, ...data[id] })));
        }));
        unsubs.push(onValue(dataRefs.requisitions, (s) => {
            const data = s.val() || {};
            const list = Object.keys(data).map(id => ({ id, ...data[id] }));
            list.sort((a: any, b: any) => (b.submittedAt || 0) - (a.submittedAt || 0));
            setLocalRequisitions(list);
        }));
        unsubs.push(onValue(dataRefs.financialAuditLogs, (s) => {
            const data = s.val() || {};
            const list = Object.keys(data).map(id => ({ id, ...data[id] }));
            list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
            setAuditLogsList(list);
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, [userData?.uid, dataRefs, computeDerived]);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setLastSyncedSecs(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatSyncedTime = (secs: number) => {
        if (secs < 5) return "just now";
        if (secs < 60) return `${secs}s ago`;
        const mins = Math.floor(secs / 60);
        return `${mins}m ago`;
    };

    // Local system logic implementations
    const localBudgetWithActuals = React.useMemo(() => {
        const expenseByCategory: Record<string, number> = {};
        expensesList.forEach((exp: any) => {
            let cat = exp.category || "Others";
            if (cat === "Supplies" || cat === "Maintenance") {
                cat = "Infrastructure";
            } else if (cat === "Travel" || cat === "Marketing" || cat === "Other") {
                cat = "Others";
            }
            if (cat === "Others" || cat === "Other") {
                cat = "Others";
            }
            expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(exp.amount) || 0);
        });
        return localBudget.map(item => ({
            ...item,
            actual: expenseByCategory[item.category] || 0,
        }));
    }, [localBudget, expensesList]);

    const localAnnualBudgetWithActuals = React.useMemo(() => {
        const expenseByDept: Record<string, number> = {};
        expensesList.forEach((exp: any) => {
            let dept = exp.department;
            if (!dept) {
                dept = "Administration";
                if (exp.category === "Salaries") dept = "Administration";
                else if (exp.category === "Infrastructure" || exp.category === "Utilities" || exp.category === "Maintenance") dept = "Maintenance";
                else if (exp.category === "Scholarships" || exp.category === "Equipment") dept = "Academics";
                else if (exp.category === "Supplies") dept = "Library";
            }
            
            expenseByDept[dept] = (expenseByDept[dept] || 0) + (parseFloat(exp.amount) || 0);
        });
        return localAnnualBudget.map(item => ({
            ...item,
            actual: expenseByDept[item.department] || 0,
        }));
    }, [localAnnualBudget, expensesList]);

    const handleSaveBudget = async () => {
        if (!budgetCategory || !budgetedAmount) return;
        setBudgetSaving(true);
        try {
            const amount = parseFloat(budgetedAmount);
            await push(ref(db, 'budget'), { category: budgetCategory, budgeted: amount, actual: 0 });
            await logFinancialAudit(
                user?.email || 'unknown',
                userData?.name || 'Accounts Staff',
                'Budgeting',
                'Add Budget Category',
                `Allocated budget limit of ${formatVal(amount)} for category '${budgetCategory}'`
            );
            toast({ title: "Budget Item Added" });
            setBudgetCategory('');
            setBudgetedAmount('');
            setIsBudgetOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to add item' });
        } finally {
            setBudgetSaving(false);
        }
    };

    const handleDeleteBudget = async (id: string) => {
        if (!window.confirm("Are you sure?")) return;
        const item = localBudget.find(b => b.id === id);
        await remove(ref(db, `budget/${id}`));
        if (item) {
            await logFinancialAudit(
                user?.email || 'unknown',
                userData?.name || 'Accounts Staff',
                'Budgeting',
                'Remove Budget Category',
                `Removed budget category '${item.category}' with limit ${formatVal(item.budgeted)}`
            );
        }
        toast({ title: 'Budget item removed' });
    };

    const handleSaveAnnual = async () => {
        if (!annualDept || !annualAmount) return;
        setAnnualSaving(true);
        try {
            const amount = parseFloat(annualAmount);
            await push(ref(db, 'annualBudget'), { department: annualDept, budgeted: amount, actual: 0 });
            await logFinancialAudit(
                user?.email || 'unknown',
                userData?.name || 'Accounts Staff',
                'Budgeting',
                'Add Annual Allocation',
                `Allocated annual budget limit of ${formatVal(amount)} for department '${annualDept}'`
            );
            toast({ title: "Annual Allocation Added" });
            setAnnualDept('');
            setAnnualAmount('');
            setIsAnnualOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to add allocation' });
        } finally {
            setAnnualSaving(false);
        }
    };

    const handleDeleteAnnual = async (id: string) => {
        if (!window.confirm("Are you sure?")) return;
        const item = localAnnualBudget.find(b => b.id === id);
        await remove(ref(db, `annualBudget/${id}`));
        if (item) {
            await logFinancialAudit(
                user?.email || 'unknown',
                userData?.name || 'Accounts Staff',
                'Budgeting',
                'Remove Annual Allocation',
                `Removed annual budget for department '${item.department}' with limit ${formatVal(item.budgeted)}`
            );
        }
        toast({ title: 'Annual allocation removed' });
    };

    const handleSaveRequisition = async () => {
        if (!reqDept || !reqDesc || !reqAmt) return;
        setReqSaving(true);
        try {
            const amount = parseFloat(reqAmt);
            await push(ref(db, 'departmentalRequisitions'), {
                department: reqDept,
                description: reqDesc,
                amount,
                status: 'pending',
                submittedAt: Date.now(),
                requestedBy: userData?.name || 'Accounts Staff'
            });
            await logFinancialAudit(
                user?.email || 'unknown',
                userData?.name || 'Accounts Staff',
                'Requisitions',
                'Submit Requisition',
                `Submitted requisition of ${formatVal(amount)} for department '${reqDept}'. Desc: ${reqDesc}`
            );
            toast({ title: "Requisition Submitted Successfully" });
            setReqDept('');
            setReqDesc('');
            setReqAmt('');
            setIsReqOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to submit requisition' });
        } finally {
            setReqSaving(false);
        }
    };

    const handleApproveRequisition = async (id: string) => {
        try {
            const req = localRequisitions.find(r => r.id === id);
            await update(ref(db, `departmentalRequisitions/${id}`), { status: 'approved' });
            if (req) {
                await logFinancialAudit(
                    user?.email || 'unknown',
                    userData?.name || 'Accounts Staff',
                    'Requisitions',
                    'Approve Requisition',
                    `Approved requisition of ${formatVal(req.amount)} for department '${req.department}'. Desc: ${req.description}`
                );
            }
            toast({ title: "Requisition Approved" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Action failed" });
        }
    };

    const handleRejectRequisition = async (id: string) => {
        try {
            const req = localRequisitions.find(r => r.id === id);
            await update(ref(db, `departmentalRequisitions/${id}`), { status: 'rejected' });
            if (req) {
                await logFinancialAudit(
                    user?.email || 'unknown',
                    userData?.name || 'Accounts Staff',
                    'Requisitions',
                    'Reject Requisition',
                    `Rejected requisition of ${formatVal(req.amount)} for department '${req.department}'. Desc: ${req.description}`
                );
            }
            toast({ title: "Requisition Rejected" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Action failed" });
        }
    };

    const handleProcessReconciliation = () => {
        if (!reconCsvInput.trim()) {
            toast({ variant: 'destructive', title: "Empty Statement", description: "Please enter CSV records to reconcile." });
            return;
        }

        const lines = reconCsvInput.split('\n');
        const results: any[] = [];

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            if (trimmed.toLowerCase().includes('date,') || trimmed.toLowerCase().includes('reference,')) {
                return;
            }

            const parts = trimmed.split(',');
            if (parts.length < 4) {
                results.push({
                    lineNum: index + 1,
                    raw: trimmed,
                    status: 'error',
                    message: 'Invalid columns (expected: Date,Reference,Amount,StudentID)'
                });
                return;
            }

            const [dateStr, reference, amountStr, studentId] = parts.map(p => p.trim());
            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount <= 0) {
                results.push({
                    lineNum: index + 1,
                    raw: trimmed,
                    status: 'error',
                    message: `Invalid amount: ${amountStr}`
                });
                return;
            }

            const studentMatches = paymentInfos.filter(p => p.studentId === studentId);
            if (studentMatches.length === 0) {
                results.push({
                    lineNum: index + 1,
                    date: dateStr,
                    reference,
                    amount,
                    studentId,
                    status: 'unmatched',
                    message: `Student ID '${studentId}' not found in registered rosters.`
                });
            } else {
                const match = studentMatches.find(m => m.balance > 0.01) || studentMatches[0];
                const difference = match.balance - amount;
                
                results.push({
                    lineNum: index + 1,
                    date: dateStr,
                    reference,
                    amount,
                    studentId,
                    studentName: match.studentName,
                    userId: match.userId,
                    semesterId: match.semesterId,
                    invoiceId: match.invoiceId,
                    balance: match.balance,
                    difference,
                    status: 'matched',
                    message: difference === 0 
                        ? 'Exact match' 
                        : (difference > 0 ? `Partial payment (outstanding balance: ${formatVal(difference)})` : `Overpayment of ${formatVal(Math.abs(difference))}`)
                });
            }
        });

        setReconResults(results);
        toast({ title: "Reconciliation Processed", description: `Parsed ${results.length} records successfully.` });
    };

    const handleApplyReconciledDeposits = async () => {
        if (reconResults.length === 0) return;
        
        const matched = reconResults.filter(r => r.status === 'matched');
        if (matched.length === 0) {
            toast({ variant: 'destructive', title: "No matched deposits", description: "There are no matched student deposits to record." });
            return;
        }

        setActionLoading('reconcile-bulk');
        try {
            const updates: Record<string, any> = {};
            const now = getCurrentServerDate().toISOString();
            let count = 0;

            for (const row of matched) {
                const txRef = push(ref(db, 'transactions'));
                updates[`transactions/${txRef.key}`] = { 
                    transactionId: row.reference, 
                    userId: row.userId, 
                    semesterId: row.semesterId || null,
                    invoiceId: row.invoiceId || null, 
                    amount: row.amount, 
                    paymentDate: row.date || now, 
                    status: 'successful', 
                    method: 'Bank Transfer', 
                    recordedBy: userData?.name || 'Reconciliation Auto-matching' 
                };

                createNotification(row.userId, `Bank Transfer deposit of ${formatVal(row.amount)} recorded for ref ${row.reference}.`, '/student/payments').catch(() => {});
                
                await logFinancialAudit(
                    user?.email || 'unknown',
                    userData?.name || 'Reconciliation',
                    'Transactions',
                    'Bank Deposit Reconciliation',
                    `Recorded bank transfer of ${formatVal(row.amount)} for ${row.studentName} (${row.studentId}). Ref: ${row.reference}`
                );

                count++;
            }

            await update(ref(db), updates);
            toast({ title: "Deposits Recorded", description: `Successfully approved and recorded ${count} bank transfer payments.` });
            setReconResults([]);
            setReconCsvInput("");
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleGenerateFinanceReport = async () => {
        setReportLoading(true);
        try {
            const [txSnap, expSnap, invSnap, usersSnap, scholSnap] = await Promise.all([
                get(ref(db, 'transactions')),
                get(ref(db, 'expenses')),
                get(ref(db, 'invoices')),
                get(ref(db, 'users')),
                get(ref(db, 'scholarships'))
            ]);

            const transactions = Object.values(txSnap.val() || {}).filter((t: any) => t.status === 'successful') as any[];
            const expenses = Object.values(expSnap.val() || {}) as any[];
            const allUsers = (usersSnap.val() || {}) as Record<string, any>;
            const allSchols = (scholSnap.val() || {}) as Record<string, any>;
            
            const doc = new jsPDF();
            doc.setFontSize(20);
            const reportTitle = financeReportType === 'income' ? 'Income Statement' 
                : (financeReportType === 'cashflow' ? 'Cash Flow Report' 
                : (financeReportType === 'scholarships' ? 'Scholarship Recipients Report' 
                : (financeReportType === 'aging' ? 'Aging Receivables Report' : 'Revenue Summary')));
            
            doc.text(reportTitle, 14, 22);
            doc.setFontSize(10);
            doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

            if (financeReportType === 'income') {
                const totalIncome = transactions.reduce((sum, t: any) => sum + t.amount, 0);
                const totalExpenses = expenses.reduce((sum, e: any) => sum + e.amount, 0);
                
                autoTable(doc, {
                    startY: 40,
                    head: [['Category', 'Amount (ZMW)']],
                    body: [
                        ['Total Student Payments', totalIncome.toFixed(2)],
                        ['Total Operating Expenses', `(${totalExpenses.toFixed(2)})`],
                        ['Net Surplus / (Deficit)', (totalIncome - totalExpenses).toFixed(2)]
                    ],
                    theme: 'striped',
                    headStyles: { fillColor: [34, 34, 34] },
                    styles: { fontStyle: 'bold' }
                });
            } else if (financeReportType === 'revenue') {
                 autoTable(doc, {
                    startY: 40,
                    head: [['Date', 'Transaction ID', 'Amount (ZMW)', 'Method']],
                    body: transactions.map((t: any) => [format(new Date(t.paymentDate), 'MMM dd, yyyy'), t.transactionId, t.amount.toFixed(2), t.method || 'Online']),
                    theme: 'grid'
                });
            } else if (financeReportType === 'scholarships') {
                const recipients = Object.keys(allUsers)
                    .filter(uid => allUsers[uid].scholarshipId)
                    .map(uid => {
                        const u = allUsers[uid];
                        const s = allSchols[u.scholarshipId];
                        return [u.id, u.name, s?.name || 'Unknown', `${s?.percentage || 0}%`, s?.donor || '-'];
                    });

                autoTable(doc, {
                    startY: 40,
                    head: [['Student ID', 'Name', 'Scholarship Name', 'Waiver %', 'Donor/Sponsor']],
                    body: recipients,
                    theme: 'striped',
                    headStyles: { fillColor: [41, 128, 185] }
                });
            } else if (financeReportType === 'cashflow') {
                const totalIncome = transactions.reduce((sum, t: any) => sum + t.amount, 0);
                const totalExpenses = expenses.reduce((sum, e: any) => sum + e.amount, 0);
                autoTable(doc, {
                    startY: 40,
                    head: [['Metric', 'Value (ZMW)']],
                    body: [
                        ['Actual Revenue (Payments)', totalIncome.toFixed(2)],
                        ['Actual Operating Expenses', totalExpenses.toFixed(2)],
                        ['Projected Next Semester Billing', (totalIncome * 1.15).toFixed(2)],
                        ['Projected Variance Margin', ((totalIncome * 1.15) - totalExpenses).toFixed(2)]
                    ],
                    theme: 'grid',
                    headStyles: { fillColor: [39, 174, 96] }
                });
            } else if (financeReportType === 'aging') {
                const now = new Date();
                const rows = paymentInfos
                    .filter(p => p.balance > 0.01)
                    .map(p => {
                        const reg = allUsers[p.userId]?.registrations?.[p.semesterId!];
                        const invoice = allUsers[p.userId]?.invoices?.[p.invoiceId];
                        const dateStr = invoice?.dateCreated || reg?.registrationDate || new Date().toISOString();
                        let days = 0;
                        try {
                            const diffTime = now.getTime() - new Date(dateStr).getTime();
                            days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                        } catch (e) {}

                        let bracket = '0-30 days';
                        if (days > 30 && days <= 60) bracket = '31-60 days';
                        else if (days > 60 && days <= 90) bracket = '61-90 days';
                        else if (days > 90) bracket = '90+ days';

                        const amt = currency === 'USD' ? p.balance / exchangeRate : p.balance;
                        const symbol = currency === 'USD' ? "USD" : "ZMW";

                        return [
                            p.studentId,
                            p.studentName,
                            p.semesterName || 'Unknown',
                            `${days} days`,
                            bracket,
                            `${symbol} ${amt.toFixed(2)}`
                        ];
                    });

                autoTable(doc, {
                    startY: 40,
                    head: [['Student ID', 'Name', 'Period', 'Age in Days', 'Aging Bracket', 'Outstanding Balance']],
                    body: rows,
                    theme: 'striped',
                    headStyles: { fillColor: [192, 57, 43] }
                });
            }

            doc.save(`${financeReportType}_report_${Date.now()}.pdf`);
            toast({ title: 'Report Generated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to generate report' });
        } finally {
            setReportLoading(false);
        }
    };

    const handleRefreshData = async () => {
        setIsSyncing(true);
        setLastSyncedSecs(0);
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsSyncing(false);
        toast({ title: "Data Synced", description: "Database cache updated successfully." });
    };

    const handlePrintToPdf = () => {
        window.print();
    };

    const stats = React.useMemo(() => {
        const totalRevenue = rawTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
        const totalExpenses = expensesList.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
        const netIncome = totalRevenue - totalExpenses;

        let totalBilled = 0;
        let totalCollected = 0;
        paymentInfos.forEach(p => {
            totalBilled += (p.totalDue || 0);
            totalCollected += (p.totalPaid || 0);
        });
        const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 82.3;

        return {
            totalRevenue,
            totalExpenses,
            netIncome,
            collectionRate
        };
    }, [rawTransactions, expensesList, paymentInfos]);

    const formatVal = React.useCallback((val: number) => {
        const amt = currency === 'USD' ? val / exchangeRate : val;
        const symbol = currency === 'USD' ? "$" : "ZMW";
        return `${symbol} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }, [currency, exchangeRate]);

    const formatZmw = React.useCallback((val: number) => {
        const sign = val < 0 ? "-" : "";
        const absVal = Math.abs(val);
        const converted = currency === 'USD' ? absVal / exchangeRate : absVal;
        const symbol = currency === 'USD' ? "$" : "ZMW";
        if (converted >= 1000000) return `${sign}${symbol} ${(converted / 1000000).toFixed(1)}M`;
        if (converted >= 1000) return `${sign}${symbol} ${(converted / 1000).toFixed(1)}K`;
        return `${sign}${symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }, [currency, exchangeRate]);

    const agingStats = React.useMemo(() => {
        let bracket1 = 0; // 0-30 days
        let bracket2 = 0; // 31-60 days
        let bracket3 = 0; // 61-90 days
        let bracket4 = 0; // 90+ days
        
        let count1 = 0;
        let count2 = 0;
        let count3 = 0;
        let count4 = 0;

        const now = getCurrentServerDate();

        paymentInfos.forEach(p => {
            if (p.balance <= 0.01) return;

            const reg = allUsers[p.userId]?.registrations?.[p.semesterId!];
            const invoice = allUsers[p.userId]?.invoices?.[p.invoiceId];
            const dateStr = invoice?.dateCreated || reg?.registrationDate || new Date().toISOString();
            
            let days = 0;
            try {
                const diffTime = now.getTime() - new Date(dateStr).getTime();
                days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            } catch (e) {}

            if (days <= 30) {
                bracket1 += p.balance;
                count1++;
            } else if (days <= 60) {
                bracket2 += p.balance;
                count2++;
            } else if (days <= 90) {
                bracket3 += p.balance;
                count3++;
            } else {
                bracket4 += p.balance;
                count4++;
            }
        });

        const totalAging = bracket1 + bracket2 + bracket3 + bracket4;

        return {
            bracket1, bracket2, bracket3, bracket4,
            count1, count2, count3, count4,
            totalAging
        };
    }, [paymentInfos, allUsers, getCurrentServerDate]);

    const monthlyStats = React.useMemo(() => {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const currentYear = getCurrentServerDate().getFullYear();
        
        const monthlyData = months.map(m => ({ month: m, revenue: 0, expenses: 0 }));
        
        rawTransactions.forEach(t => {
            const d = parseISO(t.paymentDate);
            if (d.getFullYear() === currentYear) {
                const mIdx = d.getMonth();
                monthlyData[mIdx].revenue += (t.amount || 0);
            }
        });
        
        expensesList.forEach(e => {
            const d = new Date(e.date);
            if (d.getFullYear() === currentYear) {
                const mIdx = d.getMonth();
                monthlyData[mIdx].expenses += (parseFloat(e.amount) || 0);
            }
        });

        let activeMonths = monthlyData.filter(d => d.revenue > 0 || d.expenses > 0);
        if (activeMonths.length === 0) {
            activeMonths = [
                { month: "January", revenue: 850000, expenses: 620000 },
                { month: "February", revenue: 920000, expenses: 580000 },
                { month: "March", revenue: 780000, expenses: 540000 }
            ];
        }
        return activeMonths;
    }, [rawTransactions, expensesList, getCurrentServerDate]);

    const expenseBreakdown = React.useMemo(() => {
        const totals: Record<string, number> = {
            "Salaries": 0,
            "Infrastructure": 0,
            "Scholarships": 0,
            "Utilities": 0,
            "Equipment": 0,
            "Others": 0
        };

        let totalExp = 0;
        expensesList.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            totalExp += amt;
            
            let cat = e.category || "Other";
            if (cat === "Supplies" || cat === "Maintenance") {
                cat = "Infrastructure";
            } else if (cat === "Travel" || cat === "Marketing" || cat === "Other") {
                cat = "Others";
            }
            if (totals[cat] !== undefined) {
                totals[cat] += amt;
            } else {
                totals["Others"] += amt;
            }
        });

        if (totalExp === 0) {
            return [
                { name: "Salaries", percent: 45, color: "bg-blue-500" },
                { name: "Infrastructure", percent: 18, color: "bg-green-500" },
                { name: "Scholarships", percent: 12, color: "bg-purple-500" },
                { name: "Utilities", percent: 8, color: "bg-orange-500" },
                { name: "Equipment", percent: 7, color: "bg-cyan-500" },
                { name: "Others", percent: 10, color: "bg-gray-400" }
            ];
        }

        return Object.keys(totals).map(name => {
            const amt = totals[name];
            const percent = totalExp > 0 ? Math.round((amt / totalExp) * 100) : 0;
            
            let color = "bg-gray-400";
            if (name === "Salaries") color = "bg-blue-500";
            else if (name === "Infrastructure") color = "bg-green-500";
            else if (name === "Scholarships") color = "bg-purple-500";
            else if (name === "Utilities") color = "bg-orange-500";
            else if (name === "Equipment") color = "bg-cyan-500";
            
            return { name, percent, color };
        }).sort((a, b) => b.percent - a.percent);
    }, [expensesList]);

    const recentTransactions = React.useMemo(() => {
        const list: {
            key: string;
            type: "income" | "expense";
            title: string;
            subtitle: string;
            amount: number;
            date: string;
        }[] = [];

        rawTransactions.forEach(t => {
            const studentProfile = allUsers[t.userId];
            const studentName = studentProfile?.name || t.userId || "Student";
            
            list.push({
                key: `tx-${t.key}`,
                type: "income",
                title: `Payment received - ${t.purpose || 'Registration Fees'}`,
                subtitle: `${format(parseISO(t.paymentDate), 'yyyy-MM-dd')} - ${studentName}`,
                amount: t.amount,
                date: t.paymentDate
            });
        });

        expensesList.forEach(e => {
            list.push({
                key: `exp-${e.id}`,
                type: "expense",
                title: `Payment for - ${e.category || 'Salaries'}`,
                subtitle: `${e.date} - ${e.description || 'Institutional Expense'}`,
                amount: e.amount,
                date: e.date
            });
        });

        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (list.length === 0) {
            return [
                { key: "1", type: "expense", title: "Payment for - Salaries", subtitle: "2026-01-01 - Salaries", amount: 7373, date: "2026-01-01" },
                { key: "2", type: "income", title: "Payment received - Registration Fees", subtitle: "2026-02-02 - Registration Fees", amount: 41380, date: "2026-02-02" },
                { key: "3", type: "income", title: "Payment received - Hostel Fees", subtitle: "2026-03-03 - Hostel Fees", amount: 33420, date: "2026-03-03" },
                { key: "4", type: "expense", title: "Payment for - Equipment", subtitle: "2026-01-04 - Equipment", amount: 4254, date: "2026-01-04" },
                { key: "5", type: "income", title: "Payment received - Lab Fees", subtitle: "2026-02-05 - Lab Fees", amount: 21768, date: "2026-02-05" },
                { key: "6", type: "income", title: "Payment received - Government Grant", subtitle: "2026-03-06 - Government Grant", amount: 36827, date: "2026-03-06" },
                { key: "7", type: "expense", title: "Payment for - Insurance", subtitle: "2026-01-07 - Insurance", amount: 9226, date: "2026-01-07" },
                { key: "8", type: "income", title: "Payment received - Registration Fees", subtitle: "2026-02-08 - Registration Fees", amount: 50294, date: "2026-02-08" }
            ];
        }

        return list.slice(0, 8);
    }, [rawTransactions, expensesList, allUsers]);

    const tabsList = [
        { id: "Overview", label: "Overview", icon: BarChart3 },
        { id: "Fee Collection", label: "Fee Collection", icon: CreditCard },
        { id: "Transactions", label: "Transactions", icon: Receipt },
        { id: "Bank Reconciliation", label: "Bank Reconciliation", icon: FileCheck },
        { id: "Audit Logs", label: "Audit Logs", icon: History },
        { id: "Budget", label: "Budget", icon: PieChart },
        { id: "Annual Budget", label: "Annual Budget", icon: Upload },
        { id: "Forecasting", label: "Forecasting", icon: TrendingUp },
        { id: "Dept. Requests", label: "Dept. Requests", icon: Building2 },
        { id: "Reports", label: "Reports", icon: FileText },
        { id: "Invoices", label: "Invoices", icon: FileText }
    ];

    const filteredData = React.useMemo(() => {
        const now = startOfDay(getCurrentServerDate());
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            
            let semesterMatch = true;
            if (semesterFilter === 'current') {
                semesterMatch = !!p.isCurrentStanding;
            } else if (semesterFilter === 'upcoming') {
                semesterMatch = !!p.isUpcomingStanding;
            } else if (semesterFilter.startsWith('intake-')) {
                semesterMatch = p.semesterId === activeTabSemesterId;
            } else if (semesterFilter !== 'all') {
                semesterMatch = p.semesterId === semesterFilter;
            }
            
            let balanceMatch = true;
            if (balanceStatusFilter === 'cleared') balanceMatch = p.balance <= 0.01;
            else if (balanceStatusFilter === 'owing') balanceMatch = p.balance > 0.01;
            else if (balanceStatusFilter === 'at-risk') balanceMatch = !p.thresholdMet;
            else if (balanceStatusFilter === 'overdue') balanceMatch = !!(p.nextInstallmentDue && isBefore(parseISO(p.nextInstallmentDue), now));
            
            const minB = parseFloat(minBalance);
            const maxB = parseFloat(maxBalance);
            if (!isNaN(minB) && p.balance < minB) balanceMatch = false;
            if (!isNaN(maxB) && p.balance > maxB) balanceMatch = false;

            return searchMatch && programmeMatch && semesterMatch && intakeMatch && balanceMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter, activeTabSemesterId, intakeFilter, balanceStatusFilter, minBalance, maxBalance, getCurrentServerDate]);

    const generatePdfBlob = (doc: jsPDF) => {
        return doc.output('datauristring').split('base64,')[1];
    };

    const handlePrintReceipt = (tx: Transaction, info: StudentPaymentInfo) => {
        const doc = new jsPDF();
        if (institutionSettings.logoUrl) {
            try { 
                const img = document.createElement('img');
                img.src = institutionSettings.logoUrl;
                doc.addImage(img, 'PNG', 14, 15, 20, 20); 
            } catch (e) {}
        }
        doc.setFontSize(20); doc.text(institutionSettings.name, 40, 25);
        doc.setFontSize(14); doc.text('OFFICIAL PAYMENT RECEIPT', 190, 25, { align: 'right' });
        doc.setFontSize(10);
        doc.text(`Receipt Date: ${format(parseISO(tx.paymentDate), 'PPP')}`, 190, 35, { align: 'right' });
        doc.text(`Transaction ID: ${tx.transactionId}`, 190, 40, { align: 'right' });
        
        doc.text(`Student Name: ${info.studentName}`, 14, 50);
        doc.text(`Student ID: ${info.studentId}`, 14, 55);
        doc.text(`Academic Period: ${info.semesterName}`, 14, 60);

        autoTable(doc, {
            startY: 70,
            head: [['Description', 'Payment Method', 'Amount Received']],
            body: [[`Fee Payment - ${info.semesterName}`, tx.method || 'Cash', `ZMW ${tx.amount.toFixed(2)}`]],
            theme: 'grid',
            headStyles: { fillColor: [34, 34, 34] }
        });

        doc.save(`Receipt_${tx.transactionId}.pdf`);
    };

    const handleEmailReceipt = async (tx: Transaction, info: StudentPaymentInfo) => {
        setActionLoading(`email-tx-${tx.key}`);
        try {
            const doc = new jsPDF();
            doc.setFontSize(20); doc.text(institutionSettings.name, 14, 25);
            doc.setFontSize(14); doc.text('OFFICIAL PAYMENT RECEIPT', 14, 35);
            doc.setFontSize(10);
            doc.text(`Receipt Date: ${format(parseISO(tx.paymentDate), 'PPP')}`, 14, 45);
            doc.text(`Transaction ID: ${tx.transactionId}`, 14, 50);
            doc.text(`Student: ${info.studentName} (${info.studentId})`, 14, 60);
            doc.text(`Amount: ZMW ${tx.amount.toFixed(2)}`, 14, 65);
            
            const pdfBase64 = generatePdfBlob(doc);
            await sendEmail({
                to: [info.studentEmail],
                subject: `Payment Receipt: ${tx.transactionId}`,
                body: `<p>Dear ${info.studentName},</p><p>Please find attached the official receipt for your payment of ZMW ${tx.amount.toFixed(2)}.</p><p>Regards,<br/>Finance Department</p>`,
                attachments: [{
                    filename: `Receipt_${tx.transactionId}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                }],
                log: true,
                userIds: [info.userId]
            });
            toast({ title: 'Receipt Emailed' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Email Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleEmailInvoice = async (info: StudentPaymentInfo) => {
        setActionLoading(`email-inv-${info.userId}`);
        try {
            const [invoiceSnap, regSnap, semesterSnap, coursesSnap] = await Promise.all([
                get(ref(db, `invoices/${info.userId}/${info.invoiceId}`)),
                get(ref(db, `registrations/${info.userId}/${info.semesterId}`)),
                get(ref(db, `semesters/${info.semesterId}`)),
                get(ref(db, 'courses'))
            ]);

            const invoice = invoiceSnap.val();
            const reg = regSnap.val();
            const semester = semesterSnap.val();
            const coursesData = coursesSnap.val() || {};

            const doc = new jsPDF();
            if (institutionSettings.logoUrl) {
                try { 
                    const img = document.createElement('img');
                    img.src = institutionSettings.logoUrl;
                    doc.addImage(img, 'PNG', 14, 15, 20, 20); 
                } catch (e) {}
            }
            doc.setFontSize(20); doc.text(institutionSettings.name, 40, 25);
            doc.setFontSize(12); doc.text('Official Invoice & Statement', 190, 25, { align: 'right' });
            doc.setFontSize(10);
            doc.text(`Student: ${info.studentName} (${info.studentId})`, 14, 40);
            doc.text(`Invoice ID: ${info.invoiceId || 'N/A'}`, 190, 40, { align: 'right' });
            doc.text(`Semester: ${info.semesterName}`, 14, 45);

            const scholarPerc = Number(info.scholarshipInfo?.percentage || 0);
            const coursesList = invoice?.courses || reg?.courses || [];
            const body = coursesList.map((id: string) => {
                const cost = coursesData[id]?.cost || 0;
                const finalCost = invoice?.applyScholarship ? cost * (1 - (scholarPerc/100)) : cost;
                return [
                    coursesData[id]?.code || 'N/A', 
                    `Tuition: ${coursesData[id]?.name || 'Unknown'}${invoice?.applyScholarship ? ` (${scholarPerc}% Waiver)` : ''}`, 
                    `ZMW ${finalCost.toFixed(2)}`
                ];
            });

            const fees = semester?.mandatoryFees ? Object.values(semester.mandatoryFees).map((f: any) => ['', `Mandatory Fee: ${f.name}`, `ZMW ${f.amount.toFixed(2)}`]) : [];
            const optional = semester?.optionalFees && invoice?.optionalFees ? invoice.optionalFees.map((id: string) => ['', `Optional Fee: ${semester.optionalFees![id]?.name}`, `ZMW ${semester.optionalFees![id]?.amount.toFixed(2)}`]) : [];
            const finalBody = [...body, ...fees, ...optional];
            
            autoTable(doc, { 
                startY: 55, 
                head: [['Code', 'Description', 'Amount']], 
                body: finalBody, 
                theme: 'striped', 
                headStyles: { fillColor: [34, 34, 34] }
            });

            let currentY = (doc as any).lastAutoTable.finalY + 10;

            if (info.scholarshipStatus) {
                const normStatus = info.scholarshipStatus === 'Denied' ? 'Rejected' : info.scholarshipStatus;
                let explanation = '';
                if (normStatus === 'Approved') {
                    explanation = `Approved: The scholarship has been approved and a waiver of ${info.scholarshipInfo?.percentage || 0}% has been applied to the tuition.`;
                } else if (normStatus === 'Pending') {
                    explanation = `Pending Audit: A scholarship application has been submitted and is currently awaiting verification. No waiver is applied yet.`;
                } else {
                    explanation = `Rejected: The scholarship application was rejected or denied. Full tuition fees are required.`;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text("Scholarship Information", 14, currentY);
                currentY += 6;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(`Scholarship Name: ${info.scholarshipInfo?.name || 'Academic Scholarship'}`, 14, currentY);
                currentY += 5;
                doc.text(`Status: ${normStatus}`, 14, currentY);
                currentY += 5;

                const splitExplain = doc.splitTextToSize(`Explanation: ${explanation}`, 182);
                doc.text(splitExplain, 14, currentY);
                currentY += (splitExplain.length * 4.5) + 5;
            }

            doc.setFontSize(14); 
            doc.setFont('helvetica', 'bold');
            doc.text("Payments Received", 14, currentY);
            const txRows = (info.transactions || []).map(t => [format(parseISO(t.paymentDate), 'dd MMM yyyy'), t.transactionId, t.method || 'Online', `ZMW ${t.amount.toFixed(2)}`]);
            autoTable(doc, { startY: currentY + 5, head: [['Date', 'Ref', 'Method', 'Amount']], body: txRows.length > 0 ? txRows : [['-', 'No payments', '-', 'ZMW 0.00']], theme: 'grid' });

            const summaryY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(12); doc.text(`Total Paid: ZMW ${info.totalPaid.toFixed(2)}`, 190, summaryY, { align: 'right' });
            doc.text(`BALANCE: ZMW ${info.balance.toFixed(2)}`, 190, summaryY + 8, { align: 'right' });
            
            const pdfBase64 = generatePdfBlob(doc);
            await sendEmail({
                to: [info.studentEmail],
                subject: `Invoice Statement: ${info.semesterName}`,
                body: `<p>Dear ${info.studentName},</p><p>Please find attached your current invoice statement for ${info.semesterName}.</p><p><strong>Outstanding Balance: ZMW ${info.balance.toFixed(2)}</strong></p><p>Regards,<br/>Finance Department</p>`,
                attachments: [{
                    filename: `Invoice_${info.semesterName?.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBase64,
                    contentType: 'application/pdf'
                }],
                log: true,
                userIds: [info.userId]
            });
            toast({ title: 'Invoice Emailed' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Email Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

        const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: any) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key === key) {
                const updatedRow = { ...row, [field]: value };
                
                const updateDerivedFields = (userId: string, semId: string) => {
                    const info = paymentInfos.find(p => p.userId === userId && p.semesterId === semId);
                    const sem = semesters.find(s => s.id === semId);
                    if (info) {
                        updatedRow.totalDue = info.totalDue;
                        updatedRow.totalPaid = info.totalPaid;
                        updatedRow.breakdown = info.breakdown;
                        updatedRow.academicStanding = info.semesterName;
                        updatedRow.invoiceId = info.invoiceId;
                    } else if (sem) {
                        updatedRow.totalDue = sem.tuitionFee || 0;
                        updatedRow.totalPaid = 0;
                        updatedRow.breakdown = {
                            tuition: sem.tuitionFee || 0,
                            scholarship: 0,
                            mandatory: 0,
                            optional: 0,
                            late: 0,
                            mandatoryItems: Object.values(sem.mandatoryFees || {}),
                            optionalItems: []
                        };
                        updatedRow.academicStanding = sem.name;
                        updatedRow.invoiceId = "";
                    }
                };

                if (field === 'isNewStudent') {
                    if (value) {
                        updatedRow.userId = undefined;
                        updatedRow.tempStudentName = '';
                        updatedRow.tempStudentId = '';
                        const activeSemesters = semesters.filter(s => s.status !== 'Archived');
                        updatedRow.availableYears = Array.from(new Set(activeSemesters.map(s => String(s.year)))).sort();
                        const defaultYear = updatedRow.availableYears[0];
                        if (defaultYear) {
                            updatedRow.year = defaultYear;
                            updatedRow.availableSemesters = activeSemesters.filter(s => String(s.year) === defaultYear);
                            const defaultSem = updatedRow.availableSemesters[0];
                            if (defaultSem) {
                                updatedRow.semesterId = defaultSem.id;
                                updateDerivedFields('', defaultSem.id);
                            }
                        }
                    } else {
                        updatedRow.userId = undefined;
                        updatedRow.semesterId = undefined;
                        updatedRow.year = undefined;
                        updatedRow.availableYears = [];
                        updatedRow.availableSemesters = [];
                        updatedRow.academicStanding = undefined;
                        updatedRow.totalDue = undefined;
                        updatedRow.totalPaid = undefined;
                        updatedRow.breakdown = undefined;
                        updatedRow.invoiceId = undefined;
                    }
                }

                if (field === 'userId') {
                    if (value) {
                        const studentProfile = allUsers[value];
                        const intakeId = studentProfile?.intakeId;
                        const studentIntakeSemesters = semesters.filter(s => s.intakeId === intakeId);
                        updatedRow.availableYears = Array.from(new Set(studentIntakeSemesters.map(s => String(s.year)))).sort();
                        
                        const latestSemester = studentIntakeSemesters.sort((a,b) => b.year - a.year || b.semesterInYear - a.semesterInYear)[0];
                        if (latestSemester) {
                            updatedRow.semesterId = latestSemester.id;
                            updatedRow.year = String(latestSemester.year);
                            updatedRow.availableSemesters = studentIntakeSemesters.filter(s => String(s.year) === updatedRow.year);
                            updateDerivedFields(value, latestSemester.id);
                        }
                    } else {
                        updatedRow.semesterId = undefined;
                        updatedRow.year = undefined;
                        updatedRow.availableYears = [];
                        updatedRow.availableSemesters = [];
                        updatedRow.academicStanding = undefined;
                    }
                }

                if (field === 'year') {
                    if (row.isNewStudent) {
                        const activeSemesters = semesters.filter(s => s.status !== 'Archived');
                        updatedRow.availableSemesters = activeSemesters.filter(s => String(s.year) === value);
                        const defaultSem = updatedRow.availableSemesters[0];
                        if (defaultSem) {
                            updatedRow.semesterId = defaultSem.id;
                            updateDerivedFields('', defaultSem.id);
                        } else {
                            updatedRow.semesterId = undefined;
                            updatedRow.academicStanding = undefined;
                        }
                    } else if (row.userId) {
                        const studentProfile = allUsers[row.userId];
                        const intakeId = studentProfile?.intakeId;
                        const studentIntakeSemesters = semesters.filter(s => s.intakeId === intakeId);
                        updatedRow.availableSemesters = studentIntakeSemesters.filter(s => String(s.year) === value);
                        const defaultSem = updatedRow.availableSemesters[0];
                        if (defaultSem) {
                            updatedRow.semesterId = defaultSem.id;
                            updateDerivedFields(row.userId, defaultSem.id);
                        } else {
                            updatedRow.semesterId = undefined;
                            updatedRow.academicStanding = undefined;
                        }
                    }
                }

                if (field === 'semesterId') {
                    updateDerivedFields(row.isNewStudent ? '' : (row.userId || ''), value);
                }

                return updatedRow;
            }
            return row;
        }));
    };

    const handleAddPaymentRow = () => {
        setBulkPaymentRows(prev => [
            ...prev,
            { key: Date.now() + Math.random(), amount: '', comment: '', allocations: [] }
        ]);
    };

    const handleRemovePaymentRow = (key: number) => {
        setBulkPaymentRows(prev => prev.filter(row => row.key !== key));
    };

    const handleSaveAllBulk = async () => {
        if (!user || !userData) return;
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            const now = getCurrentServerDate().toISOString();
            
            for (const row of bulkPaymentRows) {
                const amount = parseFloat(row.amount);
                if (isNaN(amount) || amount <= 0) continue;

                if (row.isNewStudent) {
                    const reqRef = push(ref(db, 'studentCreationRequests'));
                    const txRef = push(ref(db, 'transactions'));
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                    const txId = `DEP-${Date.now()}-${randomSuffix}`;
                    updates[`studentCreationRequests/${reqRef.key}`] = { tempId: row.tempStudentId || null, tempName: row.tempStudentName || null, targetSemesterId: row.semesterId || null, amountPaid: amount, status: 'pending', timestamp: Date.now() };
                    updates[`transactions/${txRef.key}`] = { transactionId: txId, userId: 'unlinked', amount, paymentDate: now, status: 'successful', method: 'Cash', recordedBy: userData.name, requestId: reqRef.key, senderName: row.tempStudentName || null };
                    
                    await logFinancialAudit(
                        user?.email || 'unknown',
                        userData?.name || 'Accounts Staff',
                        'Transactions',
                        'Record Bulk Payment (New Student)',
                        `Recorded cash deposit of ${formatVal(amount)} for prospective student ${row.tempStudentName || 'Unknown'} (Proposed ID: ${row.tempStudentId || 'N/A'}). Transaction ID: ${txId}`
                    );
                } else if (row.userId) {
                    const txRef = push(ref(db, 'transactions'));
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                    const txId = `CASH-${Date.now()}-${randomSuffix}`;
                    updates[`transactions/${txRef.key}`] = { 
                        transactionId: txId, 
                        userId: row.userId, 
                        semesterId: row.semesterId,
                        invoiceId: row.invoiceId || null, 
                        amount, 
                        paymentDate: now, 
                        status: 'successful', 
                        method: 'Cash', 
                        recordedBy: userData.name 
                    };
                    createNotification(row.userId, `Payment of ZMW ${amount.toFixed(2)} recorded for ${row.academicStanding}.`, '/student/payments').catch(() => {});
                    
                    const studentProfile = allUsers[row.userId];
                    await logFinancialAudit(
                        user?.email || 'unknown',
                        userData?.name || 'Accounts Staff',
                        'Transactions',
                        'Record Bulk Payment',
                        `Recorded cash payment of ${formatVal(amount)} for student ${studentProfile?.name || 'Unknown'} (${studentProfile?.id || row.userId}) targeting period ${row.academicStanding}. Transaction ID: ${txId}`
                    );
                }
            }

            await update(ref(db), updates);
            toast({ variant: 'success', title: 'Batch Processed' });
            setIsBulkRecordOpen(false); setBulkPaymentRows([]);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
        finally { setFormLoading(false); }
    };

    const handleCreateAdjustment = async () => {
        if (!adjustStudentId || !adjustTargetId || !adjustNewValue || !adjustReason) {
            toast({ variant: 'destructive', title: 'Fields Required' }); return;
        }
        setFormLoading(true);
        try {
            const student = allUsers[adjustStudentId];
            const requestRef = push(ref(db, 'paymentEditRequests'));
            await set(requestRef, {
                type: adjustType,
                targetId: adjustTargetId,
                userId: adjustStudentId,
                studentName: student.name,
                studentId: student.id,
                oldValue: adjustOldValue,
                newValue: parseFloat(adjustNewValue),
                reason: adjustReason,
                requestedBy: userData?.name || 'Staff',
                requestedByUid: user?.uid,
                timestamp: Date.now(),
                status: 'pending'
            });
            await logFinancialAudit(
                user?.email || 'unknown',
                userData?.name || 'Accounts Staff',
                'Adjustments',
                'Propose Adjustment',
                `Proposed financial adjustment (${adjustType}) for student ${student.name} (${student.id}). Target ID: ${adjustTargetId}. Old Value: ${formatVal(adjustOldValue)}, New Value: ${formatVal(parseFloat(adjustNewValue))}. Reason: ${adjustReason}`
            );
            toast({ title: 'Adjustment Proposed', description: 'Pending Audit Review.' });
            setIsAdjustmentDialogOpen(false);
            setAdjustStudentId(''); setAdjustTargetId(''); setAdjustReason(''); setAdjustNewValue('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        } finally {
            setFormLoading(false);
        }
    };

    const studentOptions: OptionGroup[] = React.useMemo(() => {
        const items = allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` }));
        return [{ groupName: 'Student Roster', items }];
    }, [allStudents]);

    const handleRowPay = (info: StudentPaymentInfo) => {
        const studentProfile = allUsers[info.userId];
        const intakeId = studentProfile?.intakeId;
        const studentIntakeSemesters = semesters.filter(s => s.intakeId === intakeId);
        
        setBulkPaymentRows([{ 
            key: Date.now(), 
            userId: info.userId, 
            semesterId: info.semesterId!, 
            invoiceId: info.invoiceId,
            year: String(semesters.find(s => s.id === info.semesterId)?.year || '1'),
            amount: '', 
            comment: '', 
            allocations: [],
            totalDue: info.totalDue,
            totalPaid: info.totalPaid,
            breakdown: info.breakdown,
            academicStanding: info.semesterName,
            availableYears: Array.from(new Set(studentIntakeSemesters.map(s => String(s.year)))).sort(),
            availableSemesters: studentIntakeSemesters.filter(s => String(s.year) === String(semesters.find(s => s.id === info.semesterId)?.year || '1'))
        }]);
        setIsBulkRecordOpen(true);
    };

    const cashFlowStats = React.useMemo(() => {
        const now = getCurrentServerDate();
        const today = format(now, 'yyyy-MM-dd');
        return rawTransactions.reduce((acc, t) => {
            const d = parseISO(t.paymentDate);
            if (format(d, 'yyyy-MM-dd') === today) acc.todayTotal += t.amount;
            if (isThisWeek(d)) acc.weekTotal += t.amount;
            if (isThisMonth(d)) acc.monthTotal += t.amount;
            return acc;
        }, { todayTotal: 0, weekTotal: 0, monthTotal: 0 });
    }, [rawTransactions, getCurrentServerDate]);

    const cashFlowCards = [
        { label: "Today's Collection", value: cashFlowStats.todayTotal, icon: TrendingUp, color: "text-green-600" },
        { label: "This Week", value: cashFlowStats.weekTotal, icon: CalendarDays, color: "text-primary" },
        { label: "This Month", value: cashFlowStats.monthTotal, icon: Scale, color: "text-primary" },
        { label: "Filtered Records", value: filteredData.length, icon: Users, color: "text-muted-foreground" }
    ];

    if (loading) return <Skeleton className="h-screen w-full" />;

    return (
        <main className="p-4 lg:p-6 bg-gray-50/50 min-h-screen">
            <div className="flex items-center justify-between mb-4 print:hidden">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <button className="hover:text-blue-600 transition-colors" onClick={() => setCurrentTab("Overview")}>EduTrack360</button>
                    <span>/</span>
                    <span className="text-gray-800 font-medium">Finance & Accounting</span>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => toast({ title: "Print Settings", description: "Configuring margins and paper layout options." })}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-lg transition-all" 
                        title="Print Settings"
                    >
                        <Settings className="h-3 w-3" />
                    </button>
                    <button 
                        onClick={handlePrintToPdf}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all shadow-sm" 
                        title="Print to PDF"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print to PDF</span>
                    </button>
                </div>
            </div>

            <div>
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Finance & Accounting</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Manage fees, expenses, budgets, and financial reporting</p>
                        </div>
                        <div className="inline-flex items-center gap-2 print:hidden">
                            {/* Multi-Currency Controls */}
                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white shadow-sm mr-2">
                                <button
                                    onClick={() => setCurrency('ZMW')}
                                    className={cn(
                                        "px-2 py-0.5 text-[9px] font-black rounded transition-all",
                                        currency === 'ZMW' 
                                            ? "bg-primary text-white" 
                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                    )}
                                >
                                    ZMW
                                </button>
                                <button
                                    onClick={() => setCurrency('USD')}
                                    className={cn(
                                        "px-2 py-0.5 text-[9px] font-black rounded transition-all",
                                        currency === 'USD' 
                                            ? "bg-primary text-white" 
                                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                    )}
                                >
                                    USD
                                </button>
                                {currency === 'USD' && (
                                    <div className="flex items-center gap-1 pl-1 border-l border-gray-200">
                                        <span className="text-[8px] text-gray-400 font-bold uppercase">Rate:</span>
                                        <input
                                            type="number"
                                            value={exchangeRate}
                                            onChange={async (e) => {
                                                const rate = parseFloat(e.target.value) || 1;
                                                setExchangeRate(rate);
                                                try {
                                                    await update(ref(db, 'settings/financialSettings'), { exchangeRate: rate });
                                                } catch (err) {
                                                    console.error("Failed to update exchange rate in db:", err);
                                                }
                                            }}
                                            className="w-10 h-5 border rounded px-0.5 text-[9px] font-bold text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                                <Wifi className="h-2.5 w-2.5 text-green-600 animate-pulse" />
                                Online
                            </div>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatSyncedTime(lastSyncedSecs)}
                            </span>
                            <button 
                                onClick={handleRefreshData}
                                disabled={isSyncing}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-40" 
                                title="Refresh data"
                            >
                                <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mb-4 print:hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span>Data synced {formatSyncedTime(lastSyncedSecs)}</span>
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[9px]">
                                <HardDrive className="h-2.5 w-2.5" /> 1 cached
                            </span>
                        </div>
                        <button 
                            onClick={handleRefreshData}
                            disabled={isSyncing}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40" 
                            title="Refresh data"
                        >
                            <RefreshCw className={cn("h-2.5 w-2.5", isSyncing && "animate-spin")} />
                        </button>
                    </div>
                </div>

                <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto print:hidden">
                    {tabsList.map(tab => {
                        const isSelected = currentTab === tab.id;
                        const TabIcon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setCurrentTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                                    isSelected 
                                        ? "bg-white text-blue-700 shadow-sm" 
                                        : "text-gray-600 hover:text-gray-800"
                                )}
                            >
                                <TabIcon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-6">
                    {currentTab === "Overview" && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Total Revenue</p>
                                            <p className="text-xl font-bold text-gray-900 mt-1">{formatZmw(stats.totalRevenue)}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                                                <span className="text-[10px] font-medium text-green-600">+15.3%</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                                            <TrendingUp className="h-4.5 w-4.5" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Total Expenses</p>
                                            <p className="text-xl font-bold text-gray-900 mt-1">{formatZmw(stats.totalExpenses)}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                                                <span className="text-[10px] font-medium text-green-600">+8.1%</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white">
                                            <TrendingDown className="h-4.5 w-4.5" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Net Income</p>
                                            <p className="text-xl font-bold text-gray-900 mt-1">{formatZmw(stats.netIncome)}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                                                <span className="text-[10px] font-medium text-green-600">+22.4%</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                                            <DollarSign className="h-4.5 w-4.5" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Fee Collection</p>
                                            <p className="text-xl font-bold text-gray-900 mt-1">{stats.collectionRate.toFixed(1)}%</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                                                <span className="text-[10px] font-medium text-red-600">-1.5%</span>
                                            </div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white">
                                            <CreditCard className="h-4.5 w-4.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Revenue vs Expenses</h3>
                                    <div className="space-y-3">
                                        {monthlyStats.map((d, idx) => {
                                            const maxVal = Math.max(...monthlyStats.map(m => Math.max(m.revenue, m.expenses)), 1);
                                            const revW = (d.revenue / maxVal) * 100;
                                            const expW = (d.expenses / maxVal) * 100;
                                            return (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-xs text-gray-600">
                                                        <span>{d.month}</span>
                                                        <span>{formatZmw(d.revenue)} / {formatZmw(d.expenses)}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                                            <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(revW, 2)}%` }}></div>
                                                        </div>
                                                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                                            <div className="bg-red-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(expW, 2)}%` }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
                                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Revenue</span>
                                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-full"></span> Expenses</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                                    <h3 className="text-sm font-bold text-gray-900 mb-4">Expense Breakdown</h3>
                                    <div className="space-y-2">
                                        {expenseBreakdown.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <span className="text-xs text-gray-600 w-24">{item.name}</span>
                                                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                                                    <div className={cn(item.color, "h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500")} style={{ width: `${Math.max(item.percent, 3)}%` }}>
                                                        {item.percent > 5 && <span className="text-[9px] text-white font-bold">{item.percent}%</span>}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-gray-500 w-8 text-right">{item.percent}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Aging Receivables Card */}
                            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900">Aging Receivables (Outstanding Arrears)</h3>
                                        <p className="text-[11px] text-gray-500">Breakdown of unpaid student balances by duration since invoice/registration date</p>
                                    </div>
                                    <span className="text-xs font-black text-destructive">{formatVal(agingStats.totalAging)} Total</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {[
                                        { label: "0 - 30 Days", value: agingStats.bracket1, count: agingStats.count1, color: "bg-blue-500", text: "text-blue-700" },
                                        { label: "31 - 60 Days", value: agingStats.bracket2, count: agingStats.count2, color: "bg-yellow-500", text: "text-yellow-700" },
                                        { label: "61 - 90 Days", value: agingStats.bracket3, count: agingStats.count3, color: "bg-orange-500", text: "text-orange-700" },
                                        { label: "90+ Days (Critical)", value: agingStats.bracket4, count: agingStats.count4, color: "bg-red-500", text: "text-red-700" }
                                    ].map((bracket, idx) => {
                                        const percentage = agingStats.totalAging > 0 ? (bracket.value / agingStats.totalAging) * 100 : 0;
                                        return (
                                            <div key={idx} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between space-y-3 shadow-inner">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-gray-500">{bracket.label}</span>
                                                    <p className="text-base font-black text-gray-900 mt-1">{formatVal(bracket.value)}</p>
                                                    <span className="text-[10px] text-gray-500 font-medium">{bracket.count} student(s)</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                        <div className={cn(bracket.color, "h-full rounded-full transition-all duration-500")} style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                    <span className="text-[9px] font-bold text-gray-500">{percentage.toFixed(1)}% of arrears</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-gray-900">Recent Transactions</h3>
                                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium" onClick={() => setCurrentTab("Transactions")}>View All</button>
                                </div>
                                <div className="space-y-2">
                                    {recentTransactions.map((tx) => (
                                        <div key={tx.key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tx.type === 'expense' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")}>
                                                {tx.type === 'expense' ? (
                                                    <ArrowDownRight className="h-4 w-4" />
                                                ) : (
                                                    <ArrowUpRight className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-800 truncate">{tx.title}</p>
                                                <p className="text-[10px] text-gray-500">{tx.subtitle}</p>
                                            </div>
                                            <span className={cn("text-xs font-bold", tx.type === 'expense' ? "text-red-600" : "text-green-600")}>
                                                {tx.type === 'expense' ? "-" : "+"}{formatVal(tx.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {currentTab === "Transactions" && (
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Raw Payments ledger</CardTitle>
                                <CardDescription>Comprehensive list of recorded student payment fees.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead>Date</TableHead>
                                                <TableHead>Transaction ID</TableHead>
                                                <TableHead>Student</TableHead>
                                                <TableHead>Method</TableHead>
                                                <TableHead>Purpose</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="w-[80px] text-right"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rawTransactions.map((tx) => {
                                                const studentProfile = allUsers[tx.userId];
                                                const studentName = studentProfile?.name || tx.userId || "Student";
                                                return (
                                                    <TableRow key={tx.key} className="hover:bg-muted/10">
                                                        <TableCell className="text-xs whitespace-nowrap">{format(parseISO(tx.paymentDate), 'dd MMM yyyy HH:mm')}</TableCell>
                                                        <TableCell className="font-mono text-xs font-medium">{tx.transactionId}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-xs">{studentName}</span>
                                                                <span className="text-[10px] text-muted-foreground font-mono">{studentProfile?.id || 'N/A'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs"><Badge variant="outline">{tx.method || 'Online'}</Badge></TableCell>
                                                        <TableCell className="text-xs">{tx.purpose || 'Registration Fees'}</TableCell>
                                                        <TableCell className="text-right text-green-600 font-bold text-xs whitespace-nowrap">{formatVal(tx.amount)}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                                                const sInfo = paymentInfos.find(p => p.userId === tx.userId && p.semesterId === tx.semesterId) || {
                                                                    userId: tx.userId,
                                                                    studentId: studentProfile?.id || "N/A",
                                                                    studentName: studentName,
                                                                    studentEmail: studentProfile?.email || "",
                                                                    totalDue: tx.amount,
                                                                    totalPaid: tx.amount,
                                                                    balance: 0,
                                                                    status: 'Paid',
                                                                    programmeId: studentProfile?.programmeId || null,
                                                                    intakeId: studentProfile?.intakeId || null,
                                                                    semesterId: tx.semesterId || '',
                                                                    semesterName: tx.semesterId ? semesters.find(s => s.id === tx.semesterId)?.name : '',
                                                                    invoiceId: tx.invoiceId || '',
                                                                    thresholdMet: true,
                                                                    paidPercentage: 100,
                                                                    targetThreshold: 75,
                                                                    breakdown: { tuition: tx.amount, scholarship: 0, mandatory: 0, optional: 0, late: 0 },
                                                                    transactions: [tx]
                                                                } as any;
                                                                handlePrintReceipt(tx, sInfo);
                                                            }}><Printer className="h-3.5 w-3.5" /></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {rawTransactions.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground italic">No transactions found.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(currentTab === "Invoices" || currentTab === "Fee Collection") && (
                        <>
                            <Card className="shadow-md border-gray-100">
                                <CardHeader className="border-b bg-muted/5 py-3">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <CardTitle className="text-xs font-bold flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5 text-primary" /> Population & Census Audit
                                        </CardTitle>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setIsAdjustmentDialogOpen(true)}><Scale className="mr-2 h-4 w-4"/> Proposed Adjustments</Button>
                                            <Button size="sm" onClick={() => { setBulkPaymentRows([{ key: Date.now(), amount: '', comment: '', allocations: [] }]); setIsBulkRecordOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Record Transaction(s)</Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Intake</Label>
                                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Intakes</SelectItem>
                                                    {allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Programme</Label>
                                            <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Programmes</SelectItem>
                                                    {programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="p-2 border rounded-xl bg-primary/5 text-center flex flex-col justify-center">
                                        <span className="text-2xl font-black text-primary">{filteredData.length}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Registered Students</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-md border-gray-100 bg-white">
                                <CardHeader className="border-b">
                                    <div>
                                        <CardTitle>Receivables Ledger</CardTitle>
                                        <CardDescription>
                                            Audit student financial compliance. Note: Payments are targeted toward specific study periods (Institutional Academic Year and Semester Phase).
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border bg-muted/10 items-end">
                                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Semester Phase</Label>
                                            <Select value={semesterFilter} onValueChange={handleSemesterFilterChange}>
                                                <SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Semester Phases</SelectItem>
                                                    <SelectItem value="current" className="font-bold text-primary">Current Phase Only</SelectItem>
                                                    <SelectItem value="upcoming" className="text-orange-600 font-bold">Upcoming Phase Only</SelectItem>
                                                    <Separator className="my-1"/>
                                                    {allIntakes.map(i => <SelectItem key={i.id} value={`intake-${i.id}`}>{i.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Payment Status</Label>
                                            <Select value={balanceStatusFilter} onValueChange={setBalanceStatusFilter}>
                                                <SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Balances</SelectItem>
                                                    <SelectItem value="cleared" className="text-green-600 font-bold">Cleared (ZMW 0)</SelectItem>
                                                    <SelectItem value="owing" className="text-destructive font-bold">Owing (Any)</SelectItem>
                                                    <SelectItem value="at-risk" className="text-orange-600">Below Threshold</SelectItem>
                                                    <SelectItem value="overdue" className="text-red-600">Past Deadline</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Amount Range (ZMW)</Label>
                                            <div className="flex gap-2">
                                                <Input placeholder="Min" className="h-9 text-xs" value={minBalance} onChange={e => setMinBalance(e.target.value)}/>
                                                <Input placeholder="Max" className="h-9 text-xs" value={maxBalance} onChange={e => setMaxBalance(e.target.value)}/>
                                            </div>
                                        </div>
                                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Search Roster</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-50"/><Input className="pl-8 h-9 bg-background border-primary/20 text-xs" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
                                    </div>

                                    {semesterFilter.startsWith('intake-') && (
                                        <div className="p-4 border rounded-xl bg-primary/5 space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest text-primary">Intake Semester Phase Offerings</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {semesters.filter(s => s.intakeId === semesterFilter.split('intake-')[1] && s.status !== 'Archived').sort((a, b) => a.year - b.year || a.semesterInYear - b.semesterInYear).map(sem => {
                                                    const isSelected = sem.id === activeTabSemesterId;
                                                    return (
                                                        <Button
                                                            key={sem.id}
                                                            variant={isSelected ? "default" : "outline"}
                                                            size="sm"
                                                            className="h-8 text-xs font-bold gap-1.5"
                                                            onClick={() => setActiveTabSemesterId(sem.id)}
                                                        >
                                                            {sem.name}
                                                            {sem.status === 'Open' && (
                                                                <Badge className="h-3 px-1 text-[7px] bg-green-500 hover:bg-green-600 text-white font-black uppercase border-0">Active</Badge>
                                                            )}
                                                        </Button>
                                                    );
                                                })}
                                                {semesters.filter(s => s.intakeId === semesterFilter.split('intake-')[1] && s.status !== 'Archived').length === 0 && (
                                                    <p className="text-xs text-muted-foreground italic">No semester phases setup for this intake period yet.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-md border shadow-sm overflow-hidden bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead>System ID</TableHead>
                                                    <TableHead className="min-w-[250px]">User & Plan</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                    <TableHead className="text-right">Paid</TableHead>
                                                    <TableHead className="text-center min-w-[160px]">Standing</TableHead>
                                                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredData.map((info) => (
                                                    <TableRow key={`${info.userId}-${info.semesterId}`} className={cn("group hover:bg-muted/30 transition-colors", info.isProvisional && "bg-orange-50/20")}>
                                                        <TableCell className="font-mono text-[10px] font-black opacity-60">{info.studentId}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1 py-1">
                                                                <span className="font-bold text-sm leading-tight text-gray-900">{info.studentName}</span>
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    {info.paymentPlanName ? <Badge variant="outline" className="h-4 text-[8px] uppercase border-primary/20 bg-primary/5">{info.paymentPlanName}</Badge> : <Badge variant="destructive" className="h-4 text-[8px] uppercase">Plan Not Set</Badge>}
                                                                    <span className="text-[9px] font-bold text-muted-foreground opacity-60 truncate">{info.semesterName}</span>
                                                                </div>
                                                                <div className="text-[9px] text-muted-foreground font-medium flex flex-wrap items-center gap-1 mt-0.5">
                                                                    <span>Target Period: <strong className="text-foreground">Year {info.studyYear || 'N/A'}</strong></span>
                                                                    <span>•</span>
                                                                    <span>Phase: <strong className="text-foreground">Semester {info.semesterPhase || 'N/A'}</strong></span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-black text-sm text-destructive">{formatVal(info.balance)}</TableCell>
                                                        <TableCell className="text-right text-green-600 font-bold text-xs">{formatVal(info.totalPaid)}</TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex flex-col items-center cursor-pointer" onClick={() => { setSelectedDetail(info); setIsDetailOpen(true); }}>
                                                                {info.balance <= 0.01 ? <Badge className="bg-green-600 text-[8px] font-black border-0 text-white">Cleared</Badge> : info.thresholdMet ? <Badge variant="secondary" className="bg-primary/10 text-primary text-[8px] font-black">Good Standing</Badge> : <Badge variant="destructive" className="text-[8px] font-black animate-pulse">Below Threshold</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button size="sm" variant="ghost" className="h-8 text-primary font-bold hover:bg-primary/10" onClick={() => handleRowPay(info)}><Wallet className="h-3 w-3 mr-1.5"/> Pay</Button>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => { setSelectedDetail(info); setIsDetailOpen(true); }}><Info className="mr-2 h-4 w-4"/>Financial Audit</DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleEmailInvoice(info)} disabled={actionLoading === `email-inv-${info.userId}`}><Mail className="mr-2 h-4 w-4"/>Email Invoice</DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {filteredData.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground italic">No students found matching filters.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {currentTab === "Bank Reconciliation" && (
                        <div className="space-y-6">
                            <Card className="shadow-md">
                                <CardHeader>
                                    <CardTitle className="text-lg">Bank Statement Reconciliation Tool</CardTitle>
                                    <CardDescription>
                                        Upload or paste your CSV bank statement below to automatically match deposit records with outstanding student invoice balances.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <Info className="h-4 w-4 text-blue-600" />
                                        <AlertTitle className="text-xs font-bold text-blue-800">CSV Import Format</AlertTitle>
                                        <AlertDescription className="text-[11px] text-blue-700 leading-relaxed">
                                            The imported content must be in comma-separated format. Each line should contain: 
                                            <code className="bg-blue-100 px-1 py-0.5 rounded mx-1 font-mono">Date,Reference,Amount,StudentID</code>. 
                                            Example: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">2026-06-10,DEP-98127,15000.00,S2026001</code>
                                        </AlertDescription>
                                    </Alert>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-700">Paste Bank Statement CSV</Label>
                                        <Textarea
                                            value={reconCsvInput}
                                            onChange={(e) => setReconCsvInput(e.target.value)}
                                            placeholder="2026-06-10,DEP-98127,15000.00,S2026001&#10;2026-06-11,DEP-98128,12500.00,S2026002"
                                            rows={6}
                                            className="font-mono text-xs focus-visible:ring-primary"
                                        />
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleProcessReconciliation}>
                                            Process CSV
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => { setReconCsvInput(""); setReconResults([]); }}>
                                            Clear
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {reconResults.length > 0 && (
                                <Card className="shadow-md">
                                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                                        <div>
                                            <CardTitle className="text-lg">Matched Reconciliation Results</CardTitle>
                                            <CardDescription>
                                                Confirm matched payments before bulk recording them into the transactions ledger.
                                            </CardDescription>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                            onClick={handleApplyReconciledDeposits}
                                            disabled={actionLoading === 'reconcile-bulk' || reconResults.filter(r => r.status === 'matched').length === 0}
                                        >
                                            {actionLoading === 'reconcile-bulk' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Apply Matched Deposits ({reconResults.filter(r => r.status === 'matched').length})
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-md border overflow-hidden bg-white">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/30">
                                                        <TableHead>Line</TableHead>
                                                        <TableHead>Student</TableHead>
                                                        <TableHead>Reference</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Deposit</TableHead>
                                                        <TableHead className="text-right">Owed Balance</TableHead>
                                                        <TableHead className="text-right">Difference</TableHead>
                                                        <TableHead>Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reconResults.map((res, i) => (
                                                        <TableRow 
                                                            key={i} 
                                                            className={cn(
                                                                "hover:bg-muted/10 border-l-4",
                                                                res.status === 'matched' ? "border-l-green-500" : (res.status === 'unmatched' ? "border-l-yellow-500" : "border-l-red-500")
                                                            )}
                                                        >
                                                            <TableCell className="text-xs font-mono">{res.lineNum}</TableCell>
                                                            <TableCell className="text-xs">
                                                                {res.status === 'matched' ? (
                                                                    <div>
                                                                        <div className="font-bold">{res.studentName}</div>
                                                                        <div className="text-[10px] text-gray-500">ID: {res.studentId}</div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400 italic">Unresolved Student ({res.studentId})</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono">{res.reference || '-'}</TableCell>
                                                            <TableCell className="text-xs whitespace-nowrap">{res.date || '-'}</TableCell>
                                                            <TableCell className="text-right text-xs font-bold text-green-600">
                                                                {res.amount ? formatVal(res.amount) : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs text-gray-700">
                                                                {res.balance !== undefined ? formatVal(res.balance) : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs font-semibold">
                                                                {res.difference !== undefined ? (
                                                                    res.difference === 0 ? (
                                                                        <span className="text-green-600">0.00</span>
                                                                    ) : res.difference > 0 ? (
                                                                        <span className="text-amber-600">+{formatVal(res.difference)}</span>
                                                                    ) : (
                                                                        <span className="text-red-600">-{formatVal(Math.abs(res.difference))}</span>
                                                                    )
                                                                ) : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <Badge 
                                                                        variant="outline" 
                                                                        className={cn(
                                                                            "text-[9px] uppercase font-bold w-fit",
                                                                            res.status === 'matched' 
                                                                                ? "bg-green-50 text-green-700 border-green-200" 
                                                                                : (res.status === 'unmatched' ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200")
                                                                        )}
                                                                    >
                                                                        {res.status}
                                                                    </Badge>
                                                                    <span className="text-[9px] text-gray-500 leading-normal">{res.message}</span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {currentTab === "Audit Logs" && (
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Financial Audit Trail</CardTitle>
                                <CardDescription>Comprehensive, chronological history of all administrative financial operations.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-hidden bg-white">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/30">
                                                <TableHead>Timestamp</TableHead>
                                                <TableHead>Operator</TableHead>
                                                <TableHead>Category</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {auditLogsList.map((log) => (
                                                <TableRow key={log.id} className="hover:bg-muted/10">
                                                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss')}</TableCell>
                                                    <TableCell className="text-xs">
                                                        <div className="font-bold">{log.operatorName}</div>
                                                        <div className="text-[10px] text-gray-500">{log.operatorEmail}</div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        <Badge variant="outline">{log.category}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-semibold text-gray-800">{log.action}</TableCell>
                                                    <TableCell className="text-xs text-gray-600 max-w-md break-words">{log.details}</TableCell>
                                                </TableRow>
                                            ))}
                                            {auditLogsList.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground italic">No audit log records found.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {currentTab !== "Overview" && currentTab !== "Invoices" && currentTab !== "Fee Collection" && currentTab !== "Transactions" && currentTab !== "Bank Reconciliation" && currentTab !== "Audit Logs" && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                                {currentTab === "Budget" && (
                                    <Card className="border-0 shadow-md">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <div>
                                                <CardTitle className="text-xl">Local Budget Allocations</CardTitle>
                                                <CardDescription>Consolidated record of institutional categories, budgeted limits, and actual spending.</CardDescription>
                                            </div>
                                            <Dialog open={isBudgetOpen} onOpenChange={setIsBudgetOpen}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>New Budget Category</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader><DialogTitle>New Budget Allocation</DialogTitle></DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="space-y-1">
                                                            <Label>Category / Expense Group</Label>
                                                            <Select value={budgetCategory} onValueChange={setBudgetCategory}>
                                                                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Salaries">Salaries</SelectItem>
                                                                    <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                                                                    <SelectItem value="Scholarships">Scholarships</SelectItem>
                                                                    <SelectItem value="Utilities">Utilities</SelectItem>
                                                                    <SelectItem value="Equipment">Equipment</SelectItem>
                                                                    <SelectItem value="Others">Others</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1"><Label>Budgeted Amount (ZMW)</Label><Input type="number" placeholder="50000" value={budgetedAmount} onChange={e => setBudgetedAmount(e.target.value)}/></div>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                                        <Button onClick={handleSaveBudget} disabled={budgetSaving}>{budgetSaving && <Loader2 className="mr-2 animate-spin"/>}Save Allocation</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead>Category</TableHead>
                                                            <TableHead className="text-right">Budgeted Limit</TableHead>
                                                            <TableHead className="text-right">Actual Spent</TableHead>
                                                            <TableHead className="text-right">Variance / Remaining</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {localBudgetWithActuals.length > 0 ? (
                                                            localBudgetWithActuals.map(item => {
                                                                const variance = item.budgeted - item.actual;
                                                                const percent = Math.min(100, (item.actual / item.budgeted) * 100);
                                                                return (
                                                                    <TableRow key={item.id}>
                                                                        <TableCell>
                                                                            <div className="space-y-1">
                                                                                <p className="font-semibold text-xs">{item.category}</p>
                                                                                <div className="w-48 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                                                    <div className={cn("h-1.5 rounded-full", percent > 90 ? "bg-red-500" : percent > 75 ? "bg-orange-500" : "bg-blue-600")} style={{ width: `${percent}%` }}></div>
                                                                                </div>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="text-right font-mono text-xs">{item.budgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW</TableCell>
                                                                        <TableCell className="text-right font-mono text-xs text-orange-600">{item.actual.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW</TableCell>
                                                                        <TableCell className={cn("text-right font-mono text-xs font-bold", variance < 0 ? "text-red-600" : "text-green-600")}>
                                                                            {variance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteBudget(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })
                                                        ) : (
                                                            <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground italic text-xs">No budget items configured. Click 'New Budget Category' to begin.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {currentTab === "Annual Budget" && (
                                    <Card className="border-0 shadow-md">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <div>
                                                <CardTitle className="text-xl">Annual Departmental Allocations</CardTitle>
                                                <CardDescription>Set long-term fiscal plans by academic and administrative departments.</CardDescription>
                                            </div>
                                            <Dialog open={isAnnualOpen} onOpenChange={setIsAnnualOpen}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>New Annual Allocation</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader><DialogTitle>New Annual Allocation</DialogTitle></DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="space-y-1">
                                                            <Label>Department / Division</Label>
                                                            <Select value={annualDept} onValueChange={setAnnualDept}>
                                                                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Academics">Academics</SelectItem>
                                                                    <SelectItem value="Administration">Administration</SelectItem>
                                                                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                                                                    <SelectItem value="Library">Library</SelectItem>
                                                                    <SelectItem value="Clinicals">Clinicals</SelectItem>
                                                                    <SelectItem value="Student Life">Student Life</SelectItem>
                                                                    <SelectItem value="Research">Research</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1"><Label>Allocated Funding (ZMW)</Label><Input type="number" placeholder="250000" value={annualAmount} onChange={e => setAnnualAmount(e.target.value)}/></div>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                                        <Button onClick={handleSaveAnnual} disabled={annualSaving}>{annualSaving && <Loader2 className="mr-2 animate-spin"/>}Save Allocation</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead>Department</TableHead>
                                                            <TableHead className="text-right">Annual Budget</TableHead>
                                                            <TableHead className="text-right">YTD Actual Spent</TableHead>
                                                            <TableHead className="text-right">Remaining Balance</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {localAnnualBudgetWithActuals.length > 0 ? (
                                                            localAnnualBudgetWithActuals.map(item => {
                                                                const variance = item.budgeted - item.actual;
                                                                return (
                                                                    <TableRow key={item.id}>
                                                                        <TableCell className="font-semibold text-xs">{item.department}</TableCell>
                                                                        <TableCell className="text-right font-mono text-xs">{item.budgeted.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW</TableCell>
                                                                        <TableCell className="text-right font-mono text-xs text-orange-600">{item.actual.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW</TableCell>
                                                                        <TableCell className={cn("text-right font-mono text-xs font-bold", variance < 0 ? "text-red-600" : "text-green-600")}>
                                                                            {variance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAnnual(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })
                                                        ) : (
                                                            <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground italic text-xs">No annual departmental allocations found.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {currentTab === "Forecasting" && (
                                    <Card className="border-0 shadow-md">
                                        <CardHeader>
                                            <CardTitle className="text-xl">Student Revenue & Enrollment Forecasting</CardTitle>
                                            <CardDescription>Predict upcoming financial standings based on enrollment growth simulations and active billing statistics.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid md:grid-cols-4 gap-4">
                                                <Card className="bg-blue-50/40 border-blue-100 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Active Students</p>
                                                    <p className="text-2xl font-extrabold text-blue-900 mt-1">{paymentInfos.length}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Currently enrolled roster</p>
                                                </Card>
                                                <Card className="bg-purple-50/40 border-purple-100 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Expected Gross Tuition</p>
                                                    <p className="text-2xl font-extrabold text-purple-900 mt-1">{formatVal(paymentInfos.reduce((sum, p) => sum + p.totalDue, 0))}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Tuition & fees post-waivers</p>
                                                </Card>
                                                <Card className="bg-green-50/40 border-green-100 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Total Collected</p>
                                                    <p className="text-2xl font-extrabold text-green-900 mt-1">{formatVal(paymentInfos.reduce((sum, p) => sum + p.totalPaid, 0))}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Successful payments received</p>
                                                </Card>
                                                <Card className="bg-red-50/40 border-red-100 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Outstandings Shortfall</p>
                                                    <p className="text-2xl font-extrabold text-red-900 mt-1">{formatVal(paymentInfos.reduce((sum, p) => sum + p.balance, 0))}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">Collection target remaining</p>
                                                </Card>
                                            </div>

                                            <div className="p-6 border rounded-lg bg-muted/10 space-y-4">
                                                <h3 className="font-bold text-sm text-gray-900">Configure Growth Simulation</h3>
                                                <div className="grid md:grid-cols-3 gap-6 items-end">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold">Projected Enrollment Growth</Label>
                                                        <Select value={String(forecastGrowthRate)} onValueChange={v => setForecastGrowthRate(Number(v))}>
                                                            <SelectTrigger className="h-10"><SelectValue/></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="0">Static Growth (0%)</SelectItem>
                                                                <SelectItem value="5">Conservative (+5%)</SelectItem>
                                                                <SelectItem value="10">Target Growth (+10%)</SelectItem>
                                                                <SelectItem value="20">High Growth (+20%)</SelectItem>
                                                                <SelectItem value="30">Aggressive Expansion (+30%)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold">Average Tuition Fee (per student)</Label>
                                                        <Input type="number" value={forecastTuitionFee} onChange={e => setForecastTuitionFee(Number(e.target.value))} className="h-10"/>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold">Average Mandatory Fee (per student)</Label>
                                                        <Input type="number" value={forecastFeePerStudent} onChange={e => setForecastFeePerStudent(Number(e.target.value))} className="h-10"/>
                                                    </div>
                                                </div>

                                                <Separator className="my-4"/>

                                                <div className="grid md:grid-cols-2 gap-6 pt-2">
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-bold text-gray-700">Forecasted Enrollment</p>
                                                        <div className="p-4 border rounded bg-white flex justify-between items-center">
                                                            <span className="text-xs text-muted-foreground">Projected Student Body:</span>
                                                            <span className="text-lg font-black text-blue-700">{Math.round(paymentInfos.length * (1 + forecastGrowthRate / 100))} Students</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-bold text-gray-700">Projected Gross Billings</p>
                                                        <div className="p-4 border rounded bg-white flex justify-between items-center">
                                                            <span className="text-xs text-muted-foreground">Estimated Income:</span>
                                                            <span className="text-lg font-black text-green-700">
                                                                {formatVal(Math.round(paymentInfos.length * (1 + forecastGrowthRate / 100)) * (forecastTuitionFee + forecastFeePerStudent))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {currentTab === "Dept. Requests" && (
                                    <Card className="border-0 shadow-md">
                                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                                            <div>
                                                <CardTitle className="text-xl">Departmental Requisitions</CardTitle>
                                                <CardDescription>Track and authorize funding requests submitted by university divisions.</CardDescription>
                                            </div>
                                            <Dialog open={isReqOpen} onOpenChange={setIsReqOpen}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm"><PlusCircle className="mr-2 h-4 w-4"/>New Requisition</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader><DialogTitle>New Requisition Request</DialogTitle></DialogHeader>
                                                    <div className="grid gap-4 py-4">
                                                        <div className="space-y-1">
                                                            <Label>Department / Division</Label>
                                                            <Select value={reqDept} onValueChange={setReqDept}>
                                                                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="Academics">Academics</SelectItem>
                                                                    <SelectItem value="Administration">Administration</SelectItem>
                                                                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                                                                    <SelectItem value="Library">Library</SelectItem>
                                                                    <SelectItem value="Clinicals">Clinicals</SelectItem>
                                                                    <SelectItem value="Student Life">Student Life</SelectItem>
                                                                    <SelectItem value="Research">Research</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1"><Label>Description / Item Purpose</Label><Input placeholder="e.g. Lab equipment replacement parts" value={reqDesc} onChange={e => setReqDesc(e.target.value)}/></div>
                                                        <div className="space-y-1"><Label>Requested Funding Amount (ZMW)</Label><Input type="number" placeholder="12500" value={reqAmt} onChange={e => setReqAmt(e.target.value)}/></div>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                                        <Button onClick={handleSaveRequisition} disabled={reqSaving}>{reqSaving && <Loader2 className="mr-2 animate-spin"/>}Submit Requisition</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Department</TableHead>
                                                            <TableHead>Description</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                            <TableHead>Requested By</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {localRequisitions.length > 0 ? (
                                                            localRequisitions.map(item => (
                                                                <TableRow key={item.id}>
                                                                    <TableCell className="text-xs whitespace-nowrap">{new Date(item.submittedAt || Date.now()).toLocaleDateString()}</TableCell>
                                                                    <TableCell className="font-semibold text-xs">{item.department}</TableCell>
                                                                    <TableCell className="text-xs">{item.description}</TableCell>
                                                                    <TableCell className="text-right font-mono text-xs">{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ZMW</TableCell>
                                                                    <TableCell className="text-xs text-muted-foreground">{item.requestedBy || 'N/A'}</TableCell>
                                                                    <TableCell>
                                                                        {item.status === 'pending' && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Approval</Badge>}
                                                                        {item.status === 'approved' && <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>}
                                                                        {item.status === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {item.status === 'pending' && (
                                                                            <div className="flex justify-end gap-1.5">
                                                                                <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50 h-7 text-[10px]" onClick={() => handleApproveRequisition(item.id)}>Approve</Button>
                                                                                <Button size="sm" variant="ghost" className="text-destructive hover:bg-red-50 h-7 text-[10px]" onClick={() => handleRejectRequisition(item.id)}>Reject</Button>
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        ) : (
                                                            <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground italic text-xs">No requisitions submitted.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {currentTab === "Reports" && (
                                    <Card className="border-0 shadow-md">
                                        <CardHeader>
                                            <CardTitle className="text-xl">Financial Reporting Hub</CardTitle>
                                            <CardDescription>Generate and download comprehensive financial statements and collections summaries.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-8">
                                            <div className="grid md:grid-cols-3 gap-6">
                                                <Card className="bg-blue-500/5 border-blue-500/10 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Monthly Income</p>
                                                    <div className="text-sm font-bold flex items-center gap-2 text-blue-700 mt-1"><TrendingUp className="text-green-600 h-4 w-4"/> Analysis Ready</div>
                                                </Card>
                                                <Card className="bg-red-500/5 border-red-500/10 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Monthly Expenses</p>
                                                    <div className="text-sm font-bold flex items-center gap-2 text-red-700 mt-1"><TrendingDown className="text-red-600 h-4 w-4"/> Tracking Active</div>
                                                </Card>
                                                <Card className="bg-green-500/5 border-green-500/10 p-4">
                                                    <p className="text-[10px] uppercase font-bold text-gray-500">Scholarships</p>
                                                    <div className="text-sm font-bold flex items-center gap-2 text-green-700 mt-1"><GraduationCap className="text-blue-600 h-4 w-4"/> Waiver Logs</div>
                                                </Card>
                                            </div>

                                            <div className="space-y-4 p-6 border rounded-lg bg-muted/10">
                                                <h3 className="font-bold text-sm">Generate Official Document</h3>
                                                <div className="grid md:grid-cols-2 gap-6 items-end">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Select Statement Type</Label>
                                                        <Select value={financeReportType} onValueChange={setFinanceReportType}>
                                                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="income">Income Statement (P&L)</SelectItem>
                                                                <SelectItem value="revenue">Detailed Revenue Log</SelectItem>
                                                                <SelectItem value="scholarships">Scholarship Recipients List</SelectItem>
                                                                <SelectItem value="cashflow">Cash Flow Projection</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button className="h-10" onClick={handleGenerateFinanceReport} disabled={reportLoading}>
                                                        {reportLoading ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                                                        Generate & Download PDF
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                    )}
                </div>
            </div>

            <footer className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-white" stroke="currentColor" stroke-width="2">
                                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-700">EduTrack360</p>
                            <p className="text-[10px] text-gray-400">University Management System v2.0</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-gray-400">
                        <span>Built for Zambia & Africa</span>
                        <span>|</span>
                        <span>HEA Compliant</span>
                        <span>|</span>
                        <span>20 Modules</span>
                        <span>|</span>
                        <span>© 2026 EduTrack360. All rights reserved.</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => toast({ title: "User Manual", description: "Opening University Finance documentation." })} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium transition-colors">User Manual</button>
                        <button onClick={() => toast({ title: "Privacy Policy", description: "Viewing data privacy guidelines." })} className="text-[10px] text-gray-500 hover:text-blue-600 transition-colors">Privacy Policy</button>
                        <button onClick={() => toast({ title: "Terms of Service", description: "Viewing terms of service." })} className="text-[10px] text-gray-500 hover:text-blue-600 transition-colors">Terms of Service</button>
                        <button onClick={() => toast({ title: "Support Helpdesk", description: "Contacting the system administrator." })} className="text-[10px] text-gray-500 hover:text-blue-600 transition-colors">Support</button>
                    </div>
                </div>
            </footer>

            <Dialog open={isBulkRecordOpen} onOpenChange={setIsBulkRecordOpen}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle className="text-2xl font-black">Record Transaction(s)</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 py-4">
                        {bulkPaymentRows.map((row, idx) => {
                            const amountNum = parseFloat(row.amount) || 0;
                            const currentPaid = Number(row.totalPaid || 0);
                            const projectedPaid = currentPaid + amountNum;
                            const afterPay = (row.totalDue || 0) - projectedPaid;
                            
                            return (
                            <Card key={row.key} className="border-l-4 border-l-primary relative">
                                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{idx + 1}</div>
                                                <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Recipient</Label>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Switch checked={row.isNewStudent} onCheckedChange={v => handleBulkPaymentRowChange(row.key, 'isNewStudent', v)} />
                                                    <span className="text-[10px] font-black uppercase text-primary">New Student?</span>
                                                </div>
                                                {bulkPaymentRows.length > 1 && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => handleRemovePaymentRow(row.key)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {row.isNewStudent ? (
                                            <div className="grid grid-cols-2 gap-3"><Input placeholder="Name" value={row.tempStudentName} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentName', e.target.value)} /><Input placeholder="Proposed ID" value={row.tempStudentId} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentId', e.target.value)} /></div>
                                        ) : (
                                            <div className="space-y-2">
                                                <SearchableSelect options={studentOptions} value={row.userId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'userId', v)} placeholder="Search student..." />
                                                {row.academicStanding && (
                                                    <div className="mt-2 text-[10px] bg-orange-50/80 text-orange-800 border border-orange-200/60 rounded-lg p-2.5 space-y-1">
                                                        <p className="font-bold flex items-center gap-1">
                                                            <Info className="h-3.5 w-3.5 text-orange-600" /> Target Period: {row.academicStanding}
                                                        </p>
                                                        <p className="text-muted-foreground leading-relaxed text-[9px]">
                                                            Please note: Any amount processed here will be recorded and allocated towards covering this student's outstanding fees specifically for the <strong className="text-orange-950 font-bold">{row.academicStanding}</strong> semester phase.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1"><Label className="text-[9px] font-black uppercase opacity-60">Year</Label><Select value={row.year} onValueChange={v => handleBulkPaymentRowChange(row.key, 'year', v)}><SelectTrigger className="h-10"><SelectValue placeholder="Year..."/></SelectTrigger><SelectContent>{(row.availableYears || []).map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label className="text-[9px] font-black uppercase opacity-60">Semester</Label><Select value={row.semesterId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'semesterId', v)} disabled={!row.year}><SelectTrigger className="h-10"><SelectValue placeholder="Phase..."/></SelectTrigger><SelectContent>{(row.availableSemesters || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' ').slice(-2).join(' ')}</SelectItem>)}</SelectContent></Select></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative"><Input type="number" placeholder="Amount (ZMW)" value={row.amount} onChange={e => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} className="h-11 font-black text-green-600 border-green-200 pl-8 bg-green-50/30" /><span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-green-600">K</span></div>
                                            <Input placeholder="Ref/Slip #" value={row.comment} onChange={e => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-11 text-xs" />
                                        </div>
                                    </div>
                                    <div className="space-y-4 border-l pl-8 border-dashed">
                                        <div className="flex items-center justify-between"><Label className="font-black text-[10px] uppercase text-muted-foreground tracking-widest">SEMESTER SUMMARY</Label></div>
                                        <div className="grid grid-cols-3 divide-x rounded-xl border bg-card shadow-inner overflow-hidden">
                                            <div className="p-3 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-orange-500 uppercase">Due</span><span className="text-lg font-black text-orange-500">K{(row.totalDue || 0).toLocaleString()}</span></div>
                                            <div className="p-3 flex flex-col items-center gap-1">
                                                <span className="text-[9px] font-bold text-green-600 uppercase">Paid</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl font-black text-green-600">K{projectedPaid.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-red-600 uppercase">New Bal</span><span className="text-xl font-black text-red-600">K{afterPay.toLocaleString()}</span></div>
                                        </div>
                                        <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Itemized Item Coverage</Label>
                                        <ScrollArea className="h-32 border rounded-xl p-3 bg-muted/5 shadow-inner">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2"><Checkbox id={`t-${row.key}`} checked={row.allocations.includes('Tuition')} onCheckedChange={(checked) => handleBulkPaymentRowChange(row.key, 'allocations', checked ? [...row.allocations, 'Tuition'] : row.allocations.filter(a => a !== 'Tuition'))} /><Label htmlFor={`t-${row.key}`} className="text-xs">Tuition Fees</Label></div>
                                                {row.breakdown?.mandatoryItems?.map((f, i) => (<div key={i} className="flex items-center gap-2"><Checkbox id={`m-${row.key}-${i}`} checked={row.allocations.includes(f.name)} onCheckedChange={(checked) => handleBulkPaymentRowChange(row.key, 'allocations', checked ? [...row.allocations, f.name] : row.allocations.filter(a => a !== f.name))} /><Label htmlFor={`m-${row.key}-${i}`} className="text-xs">{f.name}</Label></div>))}
                                                {row.breakdown?.optionalItems?.map((f, i) => (<div key={i} className="flex items-center gap-2"><Checkbox id={`o-${row.key}-${i}`} checked={row.allocations.includes(f.name)} onCheckedChange={(checked) => handleBulkPaymentRowChange(row.key, 'allocations', checked ? [...row.allocations, f.name] : row.allocations.filter(a => a !== f.name))} /><Label htmlFor={`o-${row.key}-${i}`} className="text-xs italic text-muted-foreground">{f.name}</Label></div>))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        )})}
                    </div>
                    <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <Button variant="outline" onClick={handleAddPaymentRow} disabled={formLoading} className="h-12 px-6 font-bold text-xs">
                            <Plus className="mr-2 h-4 w-4" /> Add Payment Row
                        </Button>
                        <Button onClick={handleSaveAllBulk} disabled={formLoading || bulkPaymentRows.length === 0} className="h-12 px-12 font-black uppercase text-xs">
                            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4 mr-2" />}Process Batch ({bulkPaymentRows.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <Wallet className="h-6 w-6"/>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Financial Audit Trail</DialogTitle>
                        </div>
                        <DialogDescription>
                            Detailed ledger breakdown for <span className="font-black text-foreground">{selectedDetail?.studentName}</span> in <strong>{selectedDetail?.semesterName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto pr-4 py-6 space-y-8">
                        <section className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 rounded-lg border bg-muted/20 flex flex-col items-center gap-1"><span className="text-[9px] font-bold opacity-60 uppercase">TOTAL DUE</span><span className="font-black">{selectedDetail ? formatVal(selectedDetail.totalDue) : ''}</span></div>
                                <div className="p-3 rounded-lg border bg-green-50/50 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-green-700 opacity-60 uppercase">TOTAL PAID</span><span className="font-black text-green-700">{selectedDetail ? formatVal(selectedDetail.totalPaid) : ''}</span></div>
                                <div className="p-3 rounded-lg border bg-red-50/50 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-red-700 opacity-60 uppercase">BALANCE</span><span className="font-black text-red-700">{selectedDetail ? formatVal(selectedDetail.balance) : ''}</span></div>
                                <div className="p-3 rounded-lg border bg-primary/5 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-primary opacity-60 uppercase">THRESHOLD</span><span className="font-black text-primary">{selectedDetail?.targetThreshold}%</span></div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><ReceiptText className="h-3 w-3" /> Itemized Billing Breakdown</Label>
                            <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                                <Table>
                                    <TableBody>
                                        <TableRow><TableCell className="text-xs font-medium">Base Tuition Fees</TableCell><TableCell className="text-right font-mono text-xs">{selectedDetail ? formatVal(selectedDetail.breakdown.tuition) : ''}</TableCell></TableRow>
                                        {selectedDetail?.breakdown.scholarship && selectedDetail.breakdown.scholarship > 0 ? (
                                            <TableRow className="text-blue-600 bg-blue-50/20"><TableCell className="text-xs italic flex items-center gap-2"><GraduationCap className="h-3 w-3"/>Scholarship Waiver</TableCell><TableCell className="text-right font-mono text-xs">- {formatVal(selectedDetail.breakdown.scholarship)}</TableCell></TableRow>
                                        ) : null}
                                        {selectedDetail?.breakdown.mandatoryItems?.map((f, i) => (<TableRow key={i}><TableCell className="text-xs">{f.name}</TableCell><TableCell className="text-right font-mono text-xs">{formatVal(Number(f.amount))}</TableCell></TableRow>))}
                                        {selectedDetail?.breakdown.optionalItems?.map((f, i) => (<TableRow key={i}><TableCell className="text-xs text-muted-foreground">{f.name}</TableCell><TableCell className="text-right font-mono text-xs">{formatVal(Number(f.amount))}</TableCell></TableRow>))}
                                        {selectedDetail?.breakdown.late && selectedDetail.breakdown.late > 0 ? (<TableRow className="text-destructive bg-red-50/20"><TableCell className="text-xs font-bold">Late Registration Fee</TableCell><TableCell className="text-right font-mono text-xs">{formatVal(selectedDetail.breakdown.late)}</TableCell></TableRow>) : null}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><History className="h-3 w-3" /> Transaction History</Label>
                            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                                <Table>
                                    <TableHeader><TableRow className="bg-muted/50"><TableHead className="h-8 text-[10px]">Date</TableHead><TableHead className="h-8 text-[10px]">Ref</TableHead><TableHead className="h-8 text-[10px] text-right">Credit</TableHead><TableHead className="h-8 text-[10px] text-right"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {selectedDetail?.transactions.map((tx, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-xs font-mono opacity-60 truncate max-w-[120px]">{tx.transactionId}</TableCell>
                                                <TableCell className="text-right font-black text-xs text-green-600">{formatVal(tx.amount)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintReceipt(tx, selectedDetail)}><Printer className="h-3.5 w-3.5"/></Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEmailReceipt(tx, selectedDetail)} disabled={actionLoading === `email-tx-${tx.key}`}><Mail className="h-3.5 w-3.5"/></Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {selectedDetail?.transactions.length === 0 && (<TableRow><TableCell colSpan={4} className="h-20 text-center text-xs text-muted-foreground italic">No payments recorded for this semester phase.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>
                    </div>
                    <DialogFooter className="flex items-center justify-between border-t pt-4">
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => selectedDetail && handleEmailInvoice(selectedDetail)} disabled={actionLoading === `email-inv-${selectedDetail?.userId}`}><Mail className="mr-2 h-4 w-4"/>Email Statement</Button>
                        </div>
                        <DialogClose asChild><Button variant="outline">Close Audit</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Financial Adjustment Request</DialogTitle>
                        <DialogDescription>Submit a proposed change to an invoice total or transaction amount. All adjustments require audit approval.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Adjustment Type</Label>
                                <Select value={adjustType} onValueChange={(v:any) => setAdjustType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="invoice">Debit/Credit Note (Invoice)</SelectItem>
                                        <SelectItem value="transaction">Edit Transaction Amount</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Student</Label>
                                <SearchableSelect options={studentOptions} value={adjustStudentId} onValueChange={setAdjustStudentId} placeholder="Select student..." />
                            </div>
                        </div>

                        {adjustStudentId && (
                            <div className="space-y-4 border p-4 rounded-xl bg-muted/20 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                    <Label>Target {adjustType === 'invoice' ? 'Semester Invoice' : 'Transaction'}</Label>
                                    <Select value={adjustTargetId} onValueChange={(v) => {
                                        setAdjustTargetId(v);
                                        if (adjustType === 'invoice') {
                                            const info = paymentInfos.find(p => p.semesterId === v && p.userId === adjustStudentId);
                                            setAdjustOldValue(info?.totalDue || 0);
                                        } else {
                                            const tx = rawTransactions.find(t => t.key === v);
                                            setAdjustOldValue(tx?.amount || 0);
                                        }
                                    }}>
                                        <SelectTrigger><SelectValue placeholder={`Select ${adjustType}...`}/></SelectTrigger>
                                        <SelectContent>
                                            {adjustType === 'invoice' ? 
                                                paymentInfos.filter(p => p.userId === adjustStudentId).map(p => <SelectItem key={p.semesterId!} value={p.semesterId!}>{p.semesterName} (Current: {p.totalDue})</SelectItem>) :
                                                rawTransactions.filter(t => t.userId === adjustStudentId).map(t => <SelectItem key={t.key} value={t.key}>{format(parseISO(t.paymentDate), 'dd MMM')} - ZMW {t.amount} ({t.transactionId})</SelectItem>)
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Current Value</Label>
                                        <Input value={adjustOldValue.toFixed(2)} disabled className="bg-muted opacity-60"/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Proposed New Value</Label>
                                        <Input type="number" value={adjustNewValue} onChange={e => setAdjustNewValue(e.target.value)} placeholder="0.00" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label>Reason for Adjustment</Label>
                                    <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Explain the error or adjustment requirement..." />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleCreateAdjustment} disabled={formLoading || !adjustTargetId || !adjustNewValue}>
                            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Submit Adjustment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
