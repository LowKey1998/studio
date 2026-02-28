
"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    CheckCircle2, 
    Loader2, 
    Download, 
    Calculator, 
    AlertTriangle, 
    Search,
    PlusCircle,
    Users,
    Scale,
    ChevronsUpDown,
    Clock,
    CalendarDays,
    Wallet,
    Calendar as CalendarIcon,
    Save,
    Info,
    X,
    MoreVertical,
    Plus,
    FileCheck,
    TrendingUp,
    ArrowRight,
    HandCoins,
    History,
    ReceiptText,
    GraduationCap,
    ShieldX
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, push, onValue, off, serverTimestamp, update } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, parseISO, startOfDay, isAfter, addDays, isWithinInterval, isBefore, isToday, isThisWeek, isThisMonth, startOfMonth } from 'date-fns';
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
import { useAuth } from '@/hooks/use-auth';
import { Calendar } from '@/components/ui/calendar';
import { parseIntakeDate, calculateAcademicState } from '@/lib/semester-utils';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { calculateBilling, type BillingPolicy } from '@/lib/billing-utils';

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
};

type PaymentRecord = {
    key: number;
    userId?: string;
    isNewStudent?: boolean;
    tempId?: string;
    tempName?: string;
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
    globalStanding?: string;
    invoiceId?: string;
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
    purpose?: string;
    recordedBy?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; tuitionFee?: number; mandatoryFees?: Record<string, any>; paymentThreshold?: number; gracePeriodDays?: number; billingPolicy?: 'course' | 'semester'; isFeesSet?: boolean; activeConfigId?: string; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

type OptionGroup = { groupName: string; items: { value: string; label: string } };

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
                    <input 
                        placeholder="Search roster..." 
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
    const [allUsers, setAllUsers] = React.useState<Record<string, any>>({});
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('current');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [balanceStatusFilter, setBalanceStatusFilter] = React.useState('all');

    const [countIntakeId, setCountIntakeId] = React.useState('all');
    const [countProgrammeId, setCountProgrammeId] = React.useState('all');

    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [selectedDetail, setSelectedDetail] = React.useState<StudentPaymentInfo | null>(null);

    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);
    
    const [isAdjustmentOpen, setIsAdjustmentOpen] = React.useState(false);
    const [adjustmentTarget, setAdjustmentTarget] = React.useState<{ type: 'debit' | 'credit', id: string, userId: string, studentName: string, studentId: string, invoiceId: string } | null>(null);
    const [adjAmount, setAdjAmount] = React.useState('');
    const [adjReason, setAdjReason] = React.useState('');

    const [formLoading, setFormLoading] = React.useState(false);

    const { toast } = useToast();

    const getCurrentServerDate = React.useCallback(() => {
        return new Date(Date.now() + serverTimeOffset);
    }, [serverTimeOffset]);

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
        configs: ref(db, 'semesterConfigs'),
        scholarships: ref(db, 'scholarships')
    }), []);

    React.useEffect(() => {
        const offsetRef = ref(db, '.info/serverTimeOffset');
        onValue(offsetRef, (snap) => setServerTimeOffset(snap.val() || 0));
        return () => off(offsetRef);
    }, []);

    const computeDerived = React.useCallback((store: any) => {
        if (!store.users || !store.registrations || !store.semesters || !store.intakes) return;

        const users = store.users;
        const regsData = store.registrations;
        const txsData = store.transactions || {};
        const semsData = store.semesters;
        const intsData = store.intakes;
        const invsData = store.invoices || {};
        const calendarEvents = Object.values(store.calendarEvents || {}) as any[];
        const finData = store.financialSettings || { paymentThreshold: 75 };
        const coursesData = store.courses || {};
        const configsData = store.configs || {};
        const scholsData = store.scholarships || {};

        const now = getCurrentServerDate();

        const transactionsList: Transaction[] = [];
        for (const txId in txsData) {
            const tx = txsData[txId];
            if(tx.status !== 'successful') continue;
            transactionsList.push({ key: txId, ...tx });
        }
        setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));

        const studentPaymentMap = new Map<string, StudentPaymentInfo>();
        const globalThreshold = finData.paymentThreshold || 75;

        for (const userId in regsData) {
            const profile = users[userId];
            if (!profile || profile.role?.toLowerCase() !== 'student') continue;

            for (const semesterId in regsData[userId]) {
                const reg = regsData[userId][semesterId];
                const semesterInfo = semsData[semesterId];
                if (!semesterInfo || semesterInfo.status === 'Archived') continue;

                const invoice = invsData[userId]?.[reg.invoiceId];
                let billingResults;
                let isProvisional = false;

                const configSnapshot = (reg.configId && configsData[semesterId]?.[reg.configId]) || (invoice?.configId && configsData[semesterId]?.[invoice.configId]);
                const activeSemesterRules = configSnapshot || semesterInfo;

                const scholarId = invoice?.scholarshipId || reg.scholarshipId || profile.scholarshipId;
                const scholarPerc = Number(invoice?.scholarshipPercentage || reg.scholarshipPercentage || (scholarId ? (scholsData[scholarId]?.percentage || 0) : 0));

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
                            mandatoryItems: Object.values(activeSemesterRules.mandatoryFees || {}),
                            optionalItems: (reg.optionalFees || []).map((fid:string) => ({ name: activeSemesterRules.optionalFees?.[fid]?.name || 'Fee', amount: Number(activeSemesterRules.optionalFees?.[fid]?.amount || 0) }))
                        }
                    };
                } else {
                    isProvisional = true;
                    const billingOutput = calculateBilling({
                        policy: activeSemesterRules.billingPolicy || 'course',
                        semesterTuition: Number(activeSemesterRules.tuitionFee || 0),
                        courses: (reg.courses || []).map((cid: string) => ({ id: cid, cost: Number(activeSemesterRules.coursePrices?.[cid] || coursesData[cid]?.cost || 0) })),
                        mandatoryFees: Object.values(activeSemesterRules.mandatoryFees || {}).map((f:any) => ({ name: f.name, amount: Number(f.amount || 0) })),
                        optionalFees: (reg.optionalFees || []).map((fid:string) => ({ name: activeSemesterRules.optionalFees?.[fid]?.name || 'Fee', amount: Number(activeSemesterRules.optionalFees?.[fid]?.amount || 0) })),
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

                const invoiceTransactions = transactionsList.filter(t => t.userId === userId && t.invoiceId === reg.invoiceId && !!reg.invoiceId);
                const totalPaid = invoiceTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
                const balance = Math.max(0, billingResults.totalDue - totalPaid);
                
                const threshold = semesterInfo.paymentThreshold || globalThreshold;
                const paidPercentage = billingResults.totalDue > 0 ? (totalPaid / billingResults.totalDue) * 100 : 100;
                const thresholdMet = paidPercentage >= threshold;

                let nextInstallmentDue = null;
                const semDeadlines = calendarEvents.filter(ev => ev.semester === semesterInfo.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
                const futureDeadline = semDeadlines.find(ev => isAfter(parseISO(ev.date), now));
                if (futureDeadline) nextInstallmentDue = futureDeadline.date;

                const mapKey = `${userId}-${semesterId}`;
                studentPaymentMap.set(mapKey, {
                    userId, studentId: profile.id, studentName: profile.name,
                    totalDue: billingResults.totalDue, totalPaid, balance,
                    programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId,
                    semesterName: semesterInfo.name, invoiceId: reg.invoiceId,
                    thresholdMet, paidPercentage, targetThreshold: threshold,
                    status: balance <= 0.01 ? 'Paid' : 'Pending',
                    paymentPlanName: reg.paymentPlan || null,
                    nextInstallmentDue,
                    breakdown: billingResults.breakdown,
                    isProvisional,
                    transactions: invoiceTransactions
                });
            }
        }

        setPaymentInfos(Array.from(studentPaymentMap.values()));
        setLoading(false);
    }, [getCurrentServerDate]);

    React.useEffect(() => {
        if (!userData?.uid) return;
        
        const unsubs: (() => void)[] = [];
        const store: any = {};

        unsubs.push(onValue(dataRefs.users, (snapshot) => { 
            const data = snapshot.val() || {};
            setAllUsers(data);
            setAllStudents(Object.entries(data).filter(([_, u]: [string, any]) => u.role === 'Student').map(([uid, u]: [string, any]) => ({ uid, ...u })));
            store.users = data; computeDerived(store); 
        }));
        unsubs.push(onValue(dataRefs.registrations, (s) => { store.registrations = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.transactions, (s) => { store.transactions = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.programmes, (s) => { setProgrammes(Object.entries(s.val() || {}).map(([id, d]:[string,any]) => ({id, ...d}))); store.programmes = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.semesters, (s) => { setSemesters(Object.entries(s.val() || {}).map(([id, d]:[string,any]) => ({id, ...d}))); store.semesters = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.intakes, (s) => { setAllIntakes(Object.entries(s.val() || {}).map(([id, d]:[string,any]) => ({id, ...d}))); store.intakes = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.courses, (s) => { store.courses = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.invoices, (s) => { store.invoices = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.financialSettings, (snapshot) => { setFinancialSettings(snapshot.val()); store.financialSettings = snapshot.val(); computeDerived(store); }));
        unsubs.push(onValue(dataRefs.calendarEvents, (s) => { store.calendarEvents = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.academicCalendar, (snapshot) => { setCalendarSettings(snapshot.val()); store.academicCalendar = snapshot.val(); computeDerived(store); }));
        unsubs.push(onValue(dataRefs.paymentPlans, (s) => { setAllPaymentPlans(Object.keys(s.val() || {}).map(id => ({id, ...s.val()[id]}))); store.paymentPlans = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.configs, (s) => { store.configs = s.val() || {}; computeDerived(store); }));
        unsubs.push(onValue(dataRefs.scholarships, (s) => { store.scholarships = s.val() || {}; computeDerived(store); }));

        return () => unsubs.forEach(unsub => unsub());
    }, [userData?.uid, dataRefs, computeDerived]);

    const filteredData = React.useMemo(() => {
        const now = startOfDay(getCurrentServerDate());
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            
            let semesterMatch = true;
            if (semesterFilter === 'current') {
                const sem = semesters.find(s => s.id === p.semesterId);
                if (!sem || !sem.startDate || !sem.endDate) semesterMatch = false;
                else {
                    const start = startOfDay(parseISO(sem.startDate));
                    const end = startOfDay(parseISO(sem.endDate));
                    semesterMatch = isWithinInterval(now, { start, end });
                }
            } else if (semesterFilter !== 'all') {
                semesterMatch = p.semesterId === semesterFilter;
            }
            
            let balanceMatch = true;
            if (balanceStatusFilter === 'cleared') balanceMatch = p.balance <= 0.01;
            else if (balanceStatusFilter === 'owing') balanceMatch = p.balance > 0.01;
            else if (balanceStatusFilter === 'at-risk') balanceMatch = !p.thresholdMet;
            else if (balanceStatusFilter === 'overdue') balanceMatch = !!(p.nextInstallmentDue && isBefore(parseISO(p.nextInstallmentDue), now));
            
            return searchMatch && programmeMatch && semesterMatch && intakeMatch && balanceMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter, intakeFilter, balanceStatusFilter, semesters, getCurrentServerDate]);

    const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: any) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key === key) {
                const updatedRow = { ...row, [field]: value };
                
                const updateDerivedFields = (userId: string, semId: string) => {
                    const info = paymentInfos.find(p => p.userId === userId && p.semesterId === semId);
                    if (info) {
                        updatedRow.totalDue = info.totalDue;
                        updatedRow.totalPaid = info.totalPaid;
                        updatedRow.breakdown = info.breakdown;
                        updatedRow.academicStanding = info.semesterName;
                        updatedRow.invoiceId = info.invoiceId;
                    } else {
                        const sem = semesters.find(s => s.id === semId);
                        if (sem) {
                            const tuition = Number(sem.tuitionFee || 0);
                            const mandatory = Object.values(sem.mandatoryFees || {}).reduce((sum, f: any) => sum + Number(f.amount || 0), 0);
                            updatedRow.totalDue = tuition + mandatory;
                            updatedRow.totalPaid = 0;
                            updatedRow.breakdown = { tuition, mandatory, optional: 0, scholarship: 0, late: 0 };
                            updatedRow.academicStanding = sem.name;
                            updatedRow.invoiceId = undefined;
                        }
                    }
                };

                if (field === 'year') {
                    updatedRow.semesterId = '';
                    if (updatedRow.isNewStudent) {
                        updatedRow.availableSemesters = semesters.filter(s => String(s.year) === value && s.status === 'Open');
                    } else {
                        const studentProfile = allUsers[updatedRow.userId || ''];
                        updatedRow.availableSemesters = semesters.filter(s => s.intakeId === studentProfile?.intakeId && String(s.year) === value);
                    }
                }

                if (field === 'userId' && !updatedRow.isNewStudent) {
                    const studentProfile = allUsers[value];
                    const intakeId = studentProfile?.intakeId;
                    const studentIntakeSemesters = semesters.filter(s => s.intakeId === intakeId);
                    updatedRow.availableYears = Array.from(new Set(studentIntakeSemesters.map(s => String(s.year)))).sort();

                    if (!updatedRow.semesterId) {
                        const intakeStartStr = parseIntakeDate(allIntakes.find(i => i.id === intakeId)?.name || '');
                        let globalStandingLabel = 'Year 1 Semester 1';
                        if (intakeStartStr && calendarSettings) {
                            const state = calculateAcademicState(intakeStartStr, getCurrentServerDate(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {}));
                            globalStandingLabel = `Year ${state.year} Semester ${state.semester}`;
                        }
                        const latestSemester = studentIntakeSemesters.find(s => s.name.includes(globalStandingLabel));
                        if (latestSemester) {
                            updatedRow.semesterId = latestSemester.id;
                            updatedRow.year = String(latestSemester.year);
                            updatedRow.availableSemesters = studentIntakeSemesters.filter(s => String(s.year) === updatedRow.year);
                            updateDerivedFields(value, latestSemester.id);
                        }
                    } else {
                        updateDerivedFields(value, updatedRow.semesterId);
                    }
                }

                if (field === 'isNewStudent') {
                    updatedRow.userId = undefined;
                    updatedRow.tempStudentId = '';
                    updatedRow.tempStudentName = '';
                    updatedRow.year = '';
                    updatedRow.semesterId = '';
                    const maxYear = Math.max(...semesters.map(s => s.year), 1);
                    updatedRow.availableYears = Array.from({length: maxYear}, (_, i) => String(i + 1));
                }

                if (field === 'semesterId') {
                    updateDerivedFields(updatedRow.userId || '', value);
                }

                if (field === 'amount' || field === 'userId' || field === 'semesterId' || field === 'allocations') {
                    if (updatedRow.breakdown && field !== 'allocations') {
                        const amountVal = parseFloat(field === 'amount' ? value : updatedRow.amount) || 0;
                        const cumulativePaid = (updatedRow.totalPaid || 0) + amountVal;
                        let rem = cumulativePaid;
                        const autoAllocations: string[] = [];
                        if (updatedRow.breakdown.mandatoryItems) {
                            for (const f of updatedRow.breakdown.mandatoryItems) {
                                if (rem >= f.amount) { autoAllocations.push(f.name); rem -= f.amount; }
                            }
                        }
                        if (updatedRow.breakdown.optionalItems) {
                            for (const f of updatedRow.breakdown.optionalItems) {
                                if (rem >= f.amount) { autoAllocations.push(f.name); rem -= f.amount; }
                            }
                        }
                        const netTuition = (updatedRow.breakdown.tuition || 0) - (updatedRow.breakdown.scholarship || 0);
                        if (rem >= netTuition && netTuition > 0) autoAllocations.push('Tuition');
                        updatedRow.allocations = autoAllocations;
                    }
                }

                return updatedRow;
            }
            return row;
        }));
    };

    const handleSaveAllBulk = async () => {
        if (!user || !userData) return;
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            const now = new Date().toISOString();
            let processCount = 0;

            for (const row of bulkPaymentRows) {
                const amount = parseFloat(row.amount);
                if (isNaN(amount) || amount <= 0) continue;

                if (row.isNewStudent) {
                    const reqRef = push(ref(db, 'studentCreationRequests'));
                    const txRef = push(ref(db, 'transactions'));
                    updates[`studentCreationRequests/${reqRef.key}`] = { 
                        tempId: row.tempStudentId || null, 
                        tempName: row.tempStudentName || null, 
                        targetSemesterId: row.semesterId || null, 
                        amountPaid: amount, 
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
                        recordedBy: userData.name, 
                        isUnlinked: true, 
                        requestId: reqRef.key, 
                        senderName: row.tempStudentName || null, 
                        tempId: row.tempStudentId || null 
                    };
                    processCount++;
                } else if (row.userId) {
                    const txRef = push(ref(db, 'transactions'));
                    updates[`transactions/${txRef.key}`] = { 
                        transactionId: `CASH-${Date.now()}`, 
                        userId: row.userId, 
                        invoiceId: row.invoiceId || null, 
                        amount, 
                        paymentDate: now, 
                        status: 'successful', 
                        method: 'Cash/Direct', 
                        purpose: row.allocations.join(', ') || 'Fees Payment', 
                        recordedBy: userData.name 
                    };
                    createNotification(row.userId, `Payment of ZMW ${amount.toFixed(2)} recorded for ${row.academicStanding}.`, '/student/payments').catch(() => {});
                    processCount++;
                }
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                toast({ variant: 'success', title: 'Batch Processed', description: `Successfully recorded ${processCount} payment(s).` });
                setIsBulkRecordOpen(false);
                setBulkPaymentRows([]);
            } else {
                toast({ variant: 'destructive', title: 'Invalid Batch', description: 'No valid payments found in the form.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
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

    const calculatedStudentCount = React.useMemo(() => {
        return allStudents.filter(s => {
            const matchesIntake = countIntakeId === 'all' || s.intakeId === countIntakeId;
            const matchesProgramme = countProgrammeId === 'all' || s.programmeId === countProgrammeId;
            return matchesIntake && matchesProgramme;
        }).length;
    }, [allStudents, countIntakeId, countProgrammeId]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div><CardTitle className="font-headline text-2xl text-primary">Financial Audit Hub</CardTitle><CardDescription>Institutional revenue and compliance audit.</CardDescription></div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Today's Collection</CardTitle><TrendingUp className="h-4 w-4 text-green-600"/></CardHeader><CardContent><div className="text-2xl font-black text-green-600">ZMW {cashFlowStats.todayTotal.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">This Week</CardTitle><CalendarDays className="h-4 w-4 text-primary"/></CardHeader><CardContent><div className="text-2xl font-black text-primary">ZMW {cashFlowStats.weekTotal.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">This Month</CardTitle><Scale className="h-4 w-4 text-primary"/></CardHeader><CardContent><div className="text-2xl font-black text-primary">ZMW {cashFlowStats.monthTotal.toFixed(2)}</div></CardContent></Card>
                        <Card className="bg-card border-0 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground">Filtered Students</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-black">{filteredData.length}</div></CardContent></Card>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md border-primary/10">
                <CardHeader className="bg-primary/5 border-b"><CardTitle className="text-sm font-bold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Student Population Audit</CardTitle></CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Intake</Label><Select value={countIntakeId} onValueChange={setCountIntakeId}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] uppercase font-black opacity-60">Programme</Label><Select value={countProgrammeId} onValueChange={setCountProgrammeId}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="text-center p-2 bg-muted/20 rounded-xl border border-dashed"><span className="block text-2xl font-black text-primary">{calculatedStudentCount}</span><span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Registered Students</span></div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div><CardTitle>Receivables Ledger</CardTitle><CardDescription>Filter and audit student financial compliance.</CardDescription></div>
                        <Button size="sm" onClick={() => { setBulkPaymentRows([{ key: Date.now(), amount: '', comment: '', allocations: [] }]); setIsBulkRecordOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Record Transaction(s)</Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-xl border bg-muted/10 items-end">
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Intake</Label><Select value={intakeFilter} onValueChange={setIntakeFilter}><SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Semester Phase</Label>
                            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                                <SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Semesters</SelectItem>
                                    <SelectItem value="current" className="font-bold text-primary">Current Academic Phase</SelectItem>
                                    <Separator className="my-1"/>
                                    {semesters.filter(s => intakeFilter === 'all' || s.intakeId === intakeFilter).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Search Roster</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 opacity-50"/><Input className="pl-8 h-9 bg-background border-primary/20 text-xs" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
                        <Button variant="outline" size="sm" className="h-9 font-bold" onClick={() => { setSearchTerm(''); setProgrammeFilter('all'); setIntakeFilter('all'); setSemesterFilter('current'); setBalanceStatusFilter('all'); }}>Reset</Button>
                    </div>

                    <div className="rounded-md border shadow-sm overflow-hidden">
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
                                                <span className="font-bold text-sm leading-tight">{info.studentName}</span>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {info.paymentPlanName ? <Badge variant="outline" className="h-4 text-[8px] uppercase border-primary/20 bg-primary/5">{info.paymentPlanName}</Badge> : <Badge variant="destructive" className="h-4 text-[8px] uppercase animate-pulse">Plan Not Set</Badge>}
                                                    <span className="text-[9px] font-bold text-muted-foreground opacity-60 truncate">{info.semesterName}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-sm text-destructive">ZMW {info.balance.toFixed(2)}</span>
                                                {info.isProvisional && <Badge variant="outline" className="h-3 text-[7px] font-black uppercase border-orange-200 text-orange-600 bg-orange-50/50">Provisional</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform" onClick={() => { setSelectedDetail(info); setIsDetailOpen(true); }}>
                                                {info.balance <= 0.01 ? <Badge className="bg-green-600 text-[8px] font-black">Cleared</Badge> : info.thresholdMet ? <Badge variant="secondary" className="bg-primary/10 text-primary text-[8px] font-black">Good Standing</Badge> : <Badge variant="destructive" className="text-[8px] font-black animate-pulse">Below Threshold</Badge>}
                                                {info.nextInstallmentDue && <span className="text-[8px] font-bold opacity-60 mt-1 uppercase">Next: {format(parseISO(info.nextInstallmentDue), 'dd MMM')}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="sm" variant="ghost" className="h-8 text-primary font-bold hover:bg-primary/10" onClick={() => handleRowPay(info)}>
                                                    <Wallet className="h-3 w-3 mr-1.5"/> Pay
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => { setSelectedDetail(info); setIsDetailOpen(true); }}><Info className="mr-2 h-4 w-4"/>Financial Audit</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => { setAdjustmentTarget({ type: 'credit', id: info.userId, userId: info.userId, studentName: info.studentName, studentId: info.studentId, invoiceId: info.invoiceId }); setIsAdjustmentOpen(true); }}><Plus className="mr-2 h-4 w-4 rotate-45 text-blue-600"/>Issue Credit</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => { setAdjustmentTarget({ type: 'debit', id: info.userId, userId: info.userId, studentName: info.studentName, studentId: info.studentId, invoiceId: info.invoiceId }); setIsAdjustmentOpen(true); }} className="text-destructive"><Plus className="mr-2 h-4 w-4"/>Issue Debit</DropdownMenuItem>
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
                                        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{idx + 1}</div><Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Recipient</Label></div><div className="flex items-center gap-2"><Switch checked={row.isNewStudent} onCheckedChange={v => handleBulkPaymentRowChange(row.key, 'isNewStudent', v)} /><span className="text-[10px] font-black uppercase text-primary">New Student?</span></div></div>
                                        {row.isNewStudent ? (
                                            <div className="grid grid-cols-2 gap-3"><Input placeholder="Name" value={row.tempStudentName} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentName', e.target.value)} /><Input placeholder="Proposed ID" value={row.tempStudentId} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentId', e.target.value)} /></div>
                                        ) : (
                                            <div className="space-y-2">
                                                <SearchableSelect options={studentOptions} value={row.userId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'userId', v)} placeholder="Search student..." />
                                                <div className="flex flex-wrap gap-2">
                                                    {row.globalStanding && <Badge variant="secondary" className="text-[9px] uppercase font-bold bg-primary/5 text-primary border-primary/10">Live Profile: {row.globalStanding}</Badge>}
                                                    {row.academicStanding && row.academicStanding !== row.globalStanding && <Badge variant="outline" className="text-[9px] uppercase font-bold bg-orange-50 text-orange-700 border-orange-200">Record Selected: {row.academicStanding}</Badge>}
                                                </div>
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
                                        <div className="flex items-center justify-between"><Label className="font-black text-[10px] uppercase text-muted-foreground tracking-widest">SEMESTER SUMMARY</Label><Badge variant="outline" className="h-6 gap-1 border-primary/30 text-[10px] font-bold">Audit <Info className="h-3 w-3"/></Badge></div>
                                        <div className="grid grid-cols-3 divide-x rounded-xl border bg-card shadow-inner overflow-hidden">
                                            <div className="p-3 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-orange-500 uppercase">Due</span><span className="text-lg font-black text-orange-500">K{(row.totalDue || 0).toLocaleString()}</span></div>
                                            <div className="p-3 flex flex-col items-center gap-1">
                                                <span className="text-[9px] font-bold text-green-600 uppercase">Paid</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl font-black text-green-600">K{projectedPaid.toLocaleString()}</span>
                                                    {amountNum > 0 && <span className="text-[8px] opacity-60 font-bold">({currentPaid.toLocaleString()} + {amountNum.toLocaleString()})</span>}
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-red-600 uppercase">New Bal</span><span className="text-xl font-black text-red-600">K{afterPay.toLocaleString()}</span></div>
                                        </div>
                                        <Separator />
                                        <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Itemized Item Coverage</Label>
                                        <ScrollArea className="h-32 border rounded-xl p-3 bg-muted/5 shadow-inner">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox 
                                                            id={`t-${row.key}`} 
                                                            checked={row.allocations.includes('Tuition')} 
                                                            onCheckedChange={(checked) => {
                                                                const next = checked ? [...row.allocations, 'Tuition'] : row.allocations.filter(a => a !== 'Tuition');
                                                                handleBulkPaymentRowChange(row.key, 'allocations', next);
                                                            }}
                                                        />
                                                        <Label htmlFor={`t-${row.key}`} className="text-xs font-medium opacity-70">Tuition Fees</Label>
                                                    </div>
                                                    <span className="text-[10px] font-mono opacity-60">ZMW {(row.breakdown?.tuition || 0).toFixed(2)}</span>
                                                </div>
                                                {row.breakdown?.mandatoryItems?.map((f, i) => (
                                                    <div key={i} className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox 
                                                                id={`m-${row.key}-${i}`} 
                                                                checked={row.allocations.includes(f.name)} 
                                                                onCheckedChange={(checked) => {
                                                                    const next = checked ? [...row.allocations, f.name] : row.allocations.filter(a => a !== f.name);
                                                                    handleBulkPaymentRowChange(row.key, 'allocations', next);
                                                                }}
                                                            />
                                                            <Label htmlFor={`m-${row.key}-${i}`} className="text-xs opacity-70">{f.name}</Label>
                                                        </div>
                                                        <span className="text-[10px] font-mono opacity-60">ZMW {(f.amount || 0).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {row.breakdown?.optionalItems?.map((f, i) => (
                                                    <div key={i} className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox 
                                                                id={`o-${row.key}-${i}`} 
                                                                checked={row.allocations.includes(f.name)} 
                                                                onCheckedChange={(checked) => {
                                                                    const next = checked ? [...row.allocations, f.name] : row.allocations.filter(a => a !== f.name);
                                                                    handleBulkPaymentRowChange(row.key, 'allocations', next);
                                                                }}
                                                            />
                                                            <Label htmlFor={`o-${row.key}-${i}`} className="text-xs opacity-70 italic text-muted-foreground">{f.name}</Label>
                                                        </div>
                                                        <span className="text-[10px] font-mono opacity-60">ZMW {(f.amount || 0).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        )})}
                    </div>
                    <DialogFooter className="bg-muted/10 p-6 border-t rounded-b-lg"><Button onClick={handleSaveAllBulk} disabled={formLoading || bulkPaymentRows.length === 0} className="h-12 px-12 font-black uppercase text-xs">{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileCheck className="mr-2 h-4 w-4" />}Process Batch</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogContent>
                    <DialogHeader><div className="flex items-center gap-2 text-primary mb-2"><PlusCircle className="h-5 w-5"/><DialogTitle className="text-xl font-headline uppercase">Issue {adjustmentTarget?.type === 'credit' ? 'Credit' : 'Debit'} Note</DialogTitle></div><DialogDescription>Applying adjustment to <span className="font-black text-foreground">{adjustmentTarget?.studentName}'s</span> ledger.</DialogDescription></DialogHeader>
                    <div className="space-y-6 py-6 border-y border-dashed my-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Adjustment Amount (ZMW)</Label><div className="relative"><Input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} className="h-14 text-2xl font-black bg-muted/20 border-primary/20 pl-10" /><span className="absolute left-4 top-1/2 -translate-y-1/2 font-black opacity-30 text-xl">K</span></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">Audit Reason</Label><Textarea value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Required context..." rows={4} /></div></div>
                    <DialogFooter><DialogClose asChild><Button variant="ghost">Discard</Button></DialogClose><Button onClick={handleSaveAllBulk} disabled={formLoading || !adjAmount || !adjReason.trim()}>{formLoading ? <Loader2 className="animate-spin h-4 w-4"/> : <FileCheck className="mr-2 h-4 w-4"/>}Post Adjustment</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center gap-3 text-primary mb-2">
                            <HandCoins className="h-6 w-6"/>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Financial Audit Trail</DialogTitle>
                        </div>
                        <DialogDescription>
                            Detailed ledger breakdown for <span className="font-black text-foreground">{selectedDetail?.studentName}</span> in <strong>{selectedDetail?.semesterName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto pr-4 py-6 space-y-8">
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Enrollment Status</Label>
                                <Badge variant={selectedDetail?.thresholdMet ? "default" : "destructive"}>
                                    {selectedDetail?.thresholdMet ? "Threshold Met" : "Below Threshold"}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 rounded-lg border bg-muted/20 flex flex-col items-center gap-1"><span className="text-[9px] font-bold opacity-60">TOTAL DUE</span><span className="font-black">ZMW {selectedDetail?.totalDue.toFixed(2)}</span></div>
                                <div className="p-3 rounded-lg border bg-green-50/50 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-green-700 opacity-60">TOTAL PAID</span><span className="font-black text-green-700">ZMW {selectedDetail?.totalPaid.toFixed(2)}</span></div>
                                <div className="p-3 rounded-lg border bg-red-50/50 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-red-700 opacity-60">OUTSTANDING</span><span className="font-black text-red-700">ZMW {selectedDetail?.balance.toFixed(2)}</span></div>
                                <div className="p-3 rounded-lg border bg-primary/5 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-primary opacity-60">THRESHOLD</span><span className="font-black text-primary">{selectedDetail?.targetThreshold}%</span></div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><ReceiptText className="h-3 w-3" /> Itemized Billing Breakdown</Label>
                            <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                                <Table>
                                    <TableBody>
                                        <TableRow><TableCell className="text-xs font-medium">Base Tuition Fees</TableCell><TableCell className="text-right font-mono text-xs">{selectedDetail?.breakdown.tuition.toFixed(2)}</TableCell></TableRow>
                                        {selectedDetail?.breakdown.scholarship && selectedDetail.breakdown.scholarship > 0 ? (
                                            <TableRow className="text-blue-600 bg-blue-50/20"><TableCell className="text-xs italic flex items-center gap-2"><GraduationCap className="h-3 w-3"/>Scholarship Waiver</TableCell><TableCell className="text-right font-mono text-xs">- {selectedDetail.breakdown.scholarship.toFixed(2)}</TableCell></TableRow>
                                        ) : null}
                                        {selectedDetail?.breakdown.mandatoryItems?.map((f, i) => (<TableRow key={i}><TableCell className="text-xs">{f.name}</TableCell><TableCell className="text-right font-mono text-xs">{Number(f.amount).toFixed(2)}</TableCell></TableRow>))}
                                        {selectedDetail?.breakdown.optionalItems?.map((f, i) => (<TableRow key={i}><TableCell className="text-xs text-muted-foreground">{f.name}</TableCell><TableCell className="text-right font-mono text-xs">{Number(f.amount).toFixed(2)}</TableCell></TableRow>))}
                                        {selectedDetail?.breakdown.late && selectedDetail.breakdown.late > 0 ? (<TableRow className="text-destructive bg-red-50/20"><TableCell className="text-xs font-bold">Late Registration Fee</TableCell><TableCell className="text-right font-mono text-xs">{selectedDetail.breakdown.late.toFixed(2)}</TableCell></TableRow>) : null}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2"><History className="h-3 w-3" /> Transaction History</Label>
                            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                                <Table>
                                    <TableHeader><TableRow className="bg-muted/50"><TableHead className="h-8 text-[10px]">Date</TableHead><TableHead className="h-8 text-[10px]">Reference</TableHead><TableHead className="h-8 text-[10px]">Method</TableHead><TableHead className="h-8 text-[10px] text-right">Credit</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {selectedDetail?.transactions.map((tx, i) => (
                                            <TableRow key={i}><TableCell className="text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell><TableCell className="text-xs font-mono opacity-60 truncate max-w-[120px]">{tx.transactionId}</TableCell><TableCell className="text-[10px] uppercase font-bold opacity-70">{tx.method || 'Online'}</TableCell><TableCell className="text-right font-black text-xs text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                        {selectedDetail?.transactions.length === 0 && (<TableRow><TableCell colSpan={4} className="h-20 text-center text-xs text-muted-foreground italic">No payments recorded for this semester.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>
                    </div>
                    
                    <DialogFooter className="bg-muted/5 p-4 border-t rounded-b-lg">
                        <DialogClose asChild><Button variant="outline">Close Audit</Button></DialogClose>
                        {selectedDetail && selectedDetail.balance > 0.01 && (<Button onClick={() => { setIsDetailOpen(false); handleRowPay(selectedDetail); }} className="font-bold"><Wallet className="mr-2 h-4 w-4"/> Record Payment Now</Button>)}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
