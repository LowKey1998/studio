'use client';
import * as React from 'react';
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
    GraduationCap
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, update, push, set, onValue, off, serverTimestamp } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, isAfter, addDays, startOfDay } from 'date-fns';
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
    const [adjustmentTarget, setAdjustmentTarget] = React.useState<{ type: 'transaction' | 'invoice', id: string, oldValue: number, userId: string, studentName: string, studentId: string } | null>(null);
    const [adjNewValue, setAdjNewValue] = React.useState('');
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
                        const paidPercentage = totalPayable > 0 ? (totalPaid / totalPayable) * 100 : 100;
                        const thresholdMet = paidPercentage >= threshold;

                        const semDeadlines = calendarEvents.filter(ev => ev.semester === semesterInfo.name && ev.title.includes('Deadline')).sort((a,b) => a.date.localeCompare(b.date));
                        const grace = semesterInfo.gracePeriodDays ?? 7;
                        const passedDeadlines = semDeadlines.filter(ev => isAfter(now, addDays(parseISO(ev.date), grace)));
                        const penaltiesActive = passedDeadlines.length > 0 && !thresholdMet;

                        studentPaymentMap[`${userId}-${semesterId}`] = {
                            userId, studentId: profile.id, studentName: profile.name,
                            totalDue: totalPayable, totalPaid, balance,
                            programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId,
                            invoiceId: reg.invoiceId, enrolledCourses: reg.courses || [],
                            thresholdMet, penaltiesActive, isScholarship: !!invoice.applyScholarship,
                            paidPercentage, targetThreshold: threshold, gracePeriod: grace,
                            status: balance <= 0.01 ? 'Paid' : 'Pending',
                            breakdown: {
                                tuition,
                                mandatory,
                                optional,
                                scholarship: scholarshipAmount,
                                late,
                                mandatoryItems: Object.values(semesterInfo.mandatoryFees || {}),
                                optionalItems: (reg.optionalFees || []).map((fid:string) => ({ name: semesterInfo.optionalFees?.[fid]?.name || 'Fee', amount: Number(semesterInfo.optionalFees?.[fid]?.amount || 0) }))
                            }
                        };
                    }
                }
            }

            transactionsList.filter(t => t.isUnlinked).forEach(t => {
                const key = `unlinked-${t.key}`;
                studentPaymentMap[key] = {
                    userId: t.userId || 'NEW', studentId: 'NEW-REQ', studentName: t.senderName || 'Unknown Prospect',
                    totalDue: 0, totalPaid: t.amount, balance: 0,
                    programmeId: null, intakeId: null, semesterId: t.semesterId || null,
                    invoiceId: 'none', enrolledCourses: [],
                    thresholdMet: true, penaltiesActive: false, isScholarship: false,
                    paidPercentage: 100, targetThreshold: 0, gracePeriod: 0,
                    status: 'Pending', isUnlinked: true, tempStudentName: t.senderName,
                    breakdown: { tuition: 0, mandatory: 0, optional: 0, scholarship: 0, late: 0 }
                };
            });

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
        unsubs.push(onValue(dataRefs.financialSettings, (s) => { 
            setFinancialSettings(s.val()); 
            store.financialSettings = s.val(); 
            computeDerived(); 
        }));
        unsubs.push(onValue(dataRefs.calendarEvents, (s) => { store.calendarEvents = s.val() || {}; computeDerived(); }));
        unsubs.push(onValue(dataRefs.academicCalendar, (s) => { 
            setCalendarSettings(s.val()); 
            store.academicCalendar = s.val(); 
            computeDerived(); 
        }));

        const savedFiltersRef = ref(db, `settings/paymentFilters/${userData.uid}`);
        get(savedFiltersRef).then(snap => {
            if (snap.exists()) {
                const f = snap.val();
                if(f.programmeFilter) setProgrammeFilter(f.programmeFilter);
                if(f.intakeFilter) setIntakeFilter(f.intakeFilter);
                if(f.timeFilter) setTimeFilter(f.timeFilter);
                if(f.minPaidFilter) setMinPaidFilter(f.minPaidFilter);
                if(f.maxPaidFilter) setMaxPaidFilter(f.maxPaidFilter);
                if(f.equalPaidFilter) setEqualPaidFilter(f.equalPaidFilter);
            }
        });

        return () => unsubs.forEach(unsub => unsub());
    }, [userData?.uid, serverTimeOffset, dataRefs]);

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
        const uidsInPeriod = new Set(filteredTransactions.map(t => t.userId));
        const isGroupingFilterActive = programmeFilter !== 'all' || semesterFilter !== 'all' || intakeFilter !== 'all' || minPaidFilter !== '' || maxPaidFilter !== '' || equalPaidFilter !== '';
        
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const semesterMatch = semesterFilter === 'all' || p.semesterId === semesterFilter;
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            
            const minMatch = minPaidFilter === '' || p.totalPaid >= parseFloat(minPaidFilter);
            const maxMatch = maxPaidFilter === '' || p.totalPaid <= parseFloat(maxPaidFilter);
            const equalMatch = equalPaidFilter === '' || Math.abs(p.totalPaid - parseFloat(equalPaidFilter)) < 0.01;
            
            const timeMatch = timeFilter === 'all' || isGroupingFilterActive || uidsInPeriod.has(p.userId);

            return searchMatch && programmeMatch && semesterMatch && intakeMatch && minMatch && maxMatch && equalMatch && timeMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter, intakeFilter, minPaidFilter, maxPaidFilter, equalPaidFilter, filteredTransactions, timeFilter]);

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

    const handleSaveAsDefault = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await set(ref(db, `settings/paymentFilters/${user.uid}`), {
                programmeFilter, intakeFilter, timeFilter, minPaidFilter, maxPaidFilter, equalPaidFilter
            });
            toast({ title: 'Default Filters Saved' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to save defaults' });
        } finally {
            setSaving(false);
        }
    };

    const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: any) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key === key) {
                const nextRow = { ...row, [field]: value };
                
                if (field === 'userId' && !row.isNewStudent) {
                    const studentInfo = allStudents.find(s => s.uid === value);
                    if (studentInfo) {
                        const validSemesters = semesters.filter(s => s.intakeId === studentInfo.intakeId);
                        const years = Array.from(new Set(validSemesters.map(s => String(s.year)))).sort();
                        nextRow.availableYears = years;
                        nextRow.year = '';
                        nextRow.semesterId = ''; 
                        nextRow.availableSemesters = [];
                        nextRow.totalDue = 0;
                        nextRow.totalPaid = 0;
                        nextRow.breakdown = undefined;
                    }
                } else if (field === 'isNewStudent') {
                    if (value) {
                        nextRow.userId = undefined;
                        nextRow.availableYears = Array.from(new Set(semesters.map(s => String(s.year)))).sort();
                    } else {
                        nextRow.tempStudentId = undefined;
                        nextRow.tempStudentName = undefined;
                    }
                    nextRow.year = '';
                    nextRow.semesterId = '';
                    nextRow.availableSemesters = [];
                    nextRow.totalDue = 0;
                    nextRow.totalPaid = 0;
                    nextRow.breakdown = undefined;
                } else if (field === 'year') {
                    if (row.isNewStudent) {
                        nextRow.availableSemesters = semesters.filter(s => String(s.year) === value);
                    } else {
                        const studentInfo = allStudents.find(s => s.uid === row.userId);
                        nextRow.availableSemesters = semesters.filter(s => s.intakeId === studentInfo?.intakeId && String(s.year) === value);
                    }
                    nextRow.semesterId = '';
                    nextRow.totalDue = 0;
                    nextRow.totalPaid = 0;
                    nextRow.breakdown = undefined;
                } else if (field === 'semesterId') {
                    const studentUid = row.userId;
                    const existingInfo = paymentInfos.find(p => p.userId === studentUid && p.semesterId === value);
                    
                    if (existingInfo) {
                        nextRow.totalDue = existingInfo.totalDue;
                        nextRow.totalPaid = existingInfo.totalPaid;
                        nextRow.breakdown = existingInfo.breakdown;
                    } else {
                        const sem = semesters.find(s => s.id === value);
                        if (sem) {
                            let tuition = 0;
                            if (sem.billingPolicy === 'semester') tuition = Number(sem.tuitionFee || 0);
                            const mandatory = sem.mandatoryFees ? Object.values(sem.mandatoryFees).reduce((sum, f) => sum + (Number(f.amount) || 0), 0) : 0;
                            
                            nextRow.totalDue = tuition + mandatory;
                            nextRow.totalPaid = 0;
                            nextRow.breakdown = {
                                tuition,
                                mandatory,
                                optional: 0,
                                scholarship: 0,
                                late: 0,
                                mandatoryItems: Object.values(sem.mandatoryFees || {}) as FeeItem[],
                                optionalItems: []
                            };
                        }
                    }
                }
                
                return nextRow;
            }
            return row;
        }));
    };

    const handleRemovePaymentRow = (key: number) => {
        setBulkPaymentRows(prev => prev.filter(r => r.key !== key));
    };

    const handleSaveAllBulk = async () => {
        const paymentsToRecord = bulkPaymentRows.filter(p => parseFloat(p.amount) > 0 && (p.userId || (p.isNewStudent && p.tempStudentName && p.semesterId)));
        if(paymentsToRecord.length === 0) { toast({ variant: 'destructive', title: 'No valid payments entered.' }); return; }
        
        setFormLoading(true);
        const updates: Record<string, any> = {};
        const now = new Date().toISOString();

        try {
            for (const record of paymentsToRecord) {
                const amountFloat = parseFloat(record.amount);
                
                if (record.isNewStudent) {
                    const requestRef = push(ref(db, 'studentCreationRequests'));
                    const requestId = requestRef.key!;
                    updates[`studentCreationRequests/${requestId}`] = {
                        tempId: record.tempStudentId || 'TBA',
                        tempName: record.tempStudentName,
                        targetSemesterId: record.semesterId,
                        timestamp: serverTimestamp(),
                        amountPaid: amountFloat,
                        comment: record.comment || '',
                        status: 'pending'
                    };

                    const txRef = push(ref(db, 'transactions'));
                    updates[`transactions/${txRef.key}`] = {
                        transactionId: `NEW-REQ-${Date.now()}-${txRef.key?.slice(-4)}`,
                        amount: amountFloat,
                        paymentDate: now,
                        status: 'successful',
                        method: 'Manual/Deposit',
                        isUnlinked: true,
                        requestId: requestId,
                        senderName: record.tempStudentName,
                        semesterId: record.semesterId,
                        comment: record.comment || 'Payment for new student registration'
                    };
                } else {
                    const studentUid = record.userId!;
                    const semId = record.semesterId!;
                    const semesterInfo = semesters.find(s => s.id === semId);
                    const studentStanding = paymentInfos.find(p => p.userId === studentUid && p.semesterId === semId);

                    let invoiceId = studentStanding?.invoiceId;
                    if (!invoiceId && semesterInfo) {
                        const newInvoiceRef = push(ref(db, `invoices/${studentUid}`));
                        invoiceId = newInvoiceRef.key!;
                        updates[`invoices/${studentUid}/${invoiceId}`] = {
                            invoiceId, 
                            totalTuition: record.breakdown?.tuition || 0,
                            totalMandatoryFees: record.breakdown?.mandatory || 0,
                            totalOptionalFees: 0,
                            dateCreated: now, 
                            semester: semesterInfo.name, 
                            semesterId: semId, 
                            courses: [], 
                            optionalFees: [],
                        };
                        updates[`registrations/${studentUid}/${semId}/invoiceId`] = invoiceId;
                    }

                    const txRef = push(ref(db, 'transactions'));
                    updates[`transactions/${txRef.key}`] = {
                        transactionId: `MANUAL-${Date.now()}-${txRef.key?.slice(-4)}`,
                        userId: studentUid, 
                        invoiceId: invoiceId || 'manual-entry', 
                        amount: amountFloat, 
                        currency: 'ZMW', 
                        status: 'successful',
                        paymentDate: now, 
                        method: 'Manual', 
                        comment: record.comment || ''
                    };
                    
                    createNotification(studentUid, `Payment of ZMW ${amountFloat.toFixed(2)} recorded${semesterInfo ? ` for ${semesterInfo.name}` : ''}.`, '/student/payments').catch(() => {});
                }
            }
            
            await update(ref(db), updates);
            toast({ title: "Transactions Recorded", description: `Processed ${paymentsToRecord.length} records.` });
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Save Failed', description: e.message }); }
        finally { setFormLoading(false); }
    };

    const handleRequestAdjustment = async () => {
        if (!adjustmentTarget || !adjNewValue || !adjReason.trim() || !user || !userData) return;
        setFormLoading(true);
        try {
            const requestRef = push(ref(db, 'paymentEditRequests'));
            await set(requestRef, {
                type: adjustmentTarget.type,
                targetId: adjustmentTarget.id,
                userId: adjustmentTarget.userId,
                studentName: adjustmentTarget.studentName,
                studentId: adjustmentTarget.studentId,
                oldValue: adjustmentTarget.oldValue,
                newValue: parseFloat(adjNewValue),
                reason: adjReason,
                requestedBy: userData.name,
                requestedByUid: user.uid,
                timestamp: serverTimestamp(),
                status: 'pending'
            });
            toast({ title: 'Request Submitted', description: 'Your proposed adjustment is now awaiting approval.' });
            setIsAdjustmentOpen(false);
            setAdjReason('');
            setAdjNewValue('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setLoading(false);
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
        doc.text("Institutional Payment Audit", 14, 22);
        autoTable(doc, { head, body, startY: 30 });
        doc.save(`finance_report_${format(getCurrentServerDate(), 'yyyy-MM-dd')}.pdf`);
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
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Semester Total</CardTitle>
                                <CalendarDays className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black">ZMW {summaryStats.totalPaid.toFixed(2)}</div>
                                <p className="text-[8px] text-muted-foreground font-bold mt-1 uppercase">Sum of all current year sessions</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">This Month</CardTitle>
                                <PiggyBank className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent><div className="text-2xl font-black">ZMW {revenueMetrics.month.toFixed(2)}</div></CardContent>
                        </Card>
                        <Card className="bg-card border-0 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Period Collected</CardTitle>
                                <Scale className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-primary">ZMW {summaryStats.periodCollected.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Receivables & Audit</CardTitle>
                            <CardDescription>Filter and audit student financial compliance.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleSaveAsDefault} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save Defaults</Button>
                            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                            <Button size="sm" onClick={() => { setBulkPaymentRows([{ key: Date.now(), amount: '', comment: '' }]); setIsBulkRecordOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Record Transaction(s)</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 rounded-xl border bg-muted/10 items-end">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Programme</Label>
                            <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                                <SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue placeholder="All Programmes"/></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Intake</Label>
                            <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                <SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue placeholder="All Intakes"/></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Paid Range (ZMW)</Label>
                            <div className="flex items-center gap-2">
                                <Input className="h-9 bg-background border-primary/20 text-xs" placeholder="Min" value={minPaidFilter} onChange={e => setMinPaidFilter(e.target.value)} />
                                <Input className="h-9 bg-background border-primary/20 text-xs" placeholder="Max" value={maxPaidFilter} onChange={e => setMaxPaidFilter(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase">Equal To (ZMW)</Label>
                            <div className="relative">
                                <Equal className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                                <Input className="h-9 pl-8 bg-background border-primary/20 text-xs" placeholder="Exact..." value={equalPaidFilter} onChange={e => setEqualPaidFilter(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1 lg:col-span-2">
                            <Label className="text-[10px] font-black uppercase">Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8 h-9 bg-background shadow-sm border-primary/20" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {loading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="rounded-md border shadow-sm overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>System ID</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Programme</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="text-right">Total Paid</TableHead>
                                        <TableHead className="text-center">Standing</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((info) => (
                                        <TableRow key={`${info.userId}-${info.semesterId}`} className="group hover:bg-muted/30">
                                            <TableCell className="font-mono text-[10px] font-black opacity-60">
                                                {info.isUnlinked ? <Badge variant="destructive" className="h-4 text-[8px] uppercase">Unlinked</Badge> : info.studentId}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm">{info.studentName}</span>
                                                        {info.isScholarship && (
                                                            <Badge variant="outline" className="h-4 text-[8px] uppercase border-blue-200 bg-blue-50 text-blue-700">
                                                                <GraduationCap className="h-2.5 w-2.5 mr-1"/> Scholarship
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{semesters.find(s=>s.id===info.semesterId)?.name || 'General Record'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">{programmes.find(p=>p.id===info.programmeId)?.name || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-black text-sm">ZMW {info.balance.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">
                                                {info.isUnlinked ? (
                                                    <Badge variant="destructive" className="uppercase text-[9px] h-5 px-2 animate-pulse gap-1">
                                                        <ShieldAlert className="h-2.5 w-2.5"/> Needs Account Link
                                                    </Badge>
                                                ) : (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="flex flex-col items-center gap-1 cursor-pointer">
                                                                <Badge variant={info.status === 'Paid' ? 'default' : (info.thresholdMet ? 'secondary' : 'destructive')} className="uppercase text-[9px] h-5 px-2">
                                                                    {info.status === 'Paid' ? 'Cleared' : (info.thresholdMet ? 'Good Standing' : 'Below Threshold')}
                                                                </Badge>
                                                                {info.penaltiesActive && <span className="text-[8px] font-black uppercase text-destructive animate-pulse flex items-center gap-1"><ShieldAlert className="h-2 w-2"/> Penalties Active</span>}
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80 p-4 shadow-2xl border-primary/20">
                                                            <div className="space-y-4">
                                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2">Compliance Audit</h4>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Threshold Target:</span>
                                                                        <span className="font-bold">{info.targetThreshold}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Current Standing:</span>
                                                                        <span className={cn("font-bold", info.thresholdMet ? "text-green-600" : "text-destructive")}>{info.paidPercentage.toFixed(1)}%</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="text-muted-foreground">Grace Period:</span>
                                                                        <span className="font-bold">{info.gracePeriod} Days</span>
                                                                    </div>
                                                                    
                                                                    <Separator className="my-3"/>
                                                                    
                                                                    <div className="space-y-2">
                                                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Restriction Status</p>
                                                                        <div className="grid gap-1.5 text-[10px]">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="opacity-70">Course Registration:</span>
                                                                                <div className="flex items-center gap-1">
                                                                                    {restrictions.registration ? <Lock className="h-2.5 w-2.5 text-destructive"/> : <Unlock className="h-2.5 w-2.5 text-green-600"/>}
                                                                                    <span className={cn(restrictions.registration ? "text-destructive" : "text-green-600")}>{restrictions.registration ? 'Enforced' : 'Unrestricted'}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="opacity-70">Exam Publication:</span>
                                                                                <div className="flex items-center gap-1">
                                                                                    {restrictions.results ? <Lock className="h-2.5 w-2.5 text-destructive"/> : <Unlock className="h-2.5 w-2.5 text-green-600"/>}
                                                                                    <span className={cn(restrictions.results ? "text-destructive" : "text-green-600")}>{restrictions.results ? 'Enforced' : 'Unrestricted'}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="opacity-70">Library Access:</span>
                                                                                <div className="flex items-center gap-1">
                                                                                    {restrictions.library ? <Lock className="h-2.5 w-2.5 text-destructive"/> : <Unlock className="h-2.5 w-2.5 text-green-600"/>}
                                                                                    <span className={cn(restrictions.library ? "text-destructive" : "text-green-600")}>{restrictions.library ? 'Enforced' : 'Unrestricted'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {!info.thresholdMet && (
                                                                        <div className="mt-4 p-2 bg-destructive/5 border border-destructive/10 rounded-md">
                                                                            <p className="text-[10px] font-bold text-destructive uppercase">Arrears Clearing Amount</p>
                                                                            <p className="text-xs font-black">ZMW {( (info.totalDue * (info.targetThreshold/100)) - info.totalPaid ).toFixed(2)}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }}><HistoryIcon className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setBulkPaymentRows([{ key: Date.now(), userId: info.userId, year: String(semesters.find(s=>s.id===info.semesterId)?.year || ''), semesterId: info.semesterId || '', amount: '', comment: '' }]); setIsBulkRecordOpen(true); }}><PlusCircle className="h-4 w-4" /></Button>
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

            <Dialog open={isBulkRecordOpen} onOpenChange={setIsBulkRecordOpen}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Record Transaction(s)</DialogTitle><DialogDescription>Batch process multiple manual student payments.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 py-4">
                        {bulkPaymentRows.map((row, idx) => (
                            <Card key={row.key} className="border-l-4 border-l-primary shadow-sm bg-muted/5 relative group">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemovePaymentRow(row.key)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{idx + 1}</div><Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Student Identity</Label></div>
                                            <div className="flex items-center gap-2">
                                                <Switch checked={row.isNewStudent} onCheckedChange={v => handleBulkPaymentRowChange(row.key, 'isNewStudent', v)} />
                                                <span className="text-[10px] font-bold uppercase text-primary">New Student?</span>
                                            </div>
                                        </div>
                                        {row.isNewStudent ? (
                                            <div className="space-y-3 animate-in fade-in border p-3 rounded-lg bg-background/50 shadow-inner">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Full Name</Label>
                                                        <Input placeholder="Enter full name..." value={row.tempStudentName} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentName', e.target.value)} className="h-9 text-xs" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase">Proposed Student ID</Label>
                                                        <Input placeholder="e.g. STU-NEW" value={row.tempStudentId} onChange={e => handleBulkPaymentRowChange(row.key, 'tempStudentId', e.target.value)} className="h-9 text-xs" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <SearchableSelect options={studentOptions} value={row.userId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'userId', v)} placeholder="Search student name or ID..." />
                                                {row.userId && (
                                                    <div className="text-[10px] font-bold text-primary flex items-center gap-1.5 px-1">
                                                        <UserCheck className="h-3 w-3" />
                                                        Current Stand: {calculateStandingForUser(row.userId)}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        
                                        <div className="pt-2 border-t">
                                            <Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Target Allocation (Payment For)</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] uppercase font-bold">Target Year</Label>
                                                    <Select value={row.year} onValueChange={v => handleBulkPaymentRowChange(row.key, 'year', v)}>
                                                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Year..."/></SelectTrigger>
                                                        <SelectContent>{(row.availableYears || []).map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] uppercase font-bold">Target Semester</Label>
                                                    <Select value={row.semesterId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'semesterId', v)} disabled={!row.year}>
                                                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Semester..."/></SelectTrigger>
                                                        <SelectContent>{(row.availableSemesters || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' ').slice(-2).join(' ')}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 border-l pl-6 bg-background/50 rounded-r-lg">
                                        <div className="flex justify-between items-center"><Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Transaction Details</Label>{row.semesterId && <Badge variant="outline" className="text-[9px] font-bold bg-white">Audit</Badge>}</div>
                                        {row.semesterId ? (
                                            <div className="grid grid-cols-3 gap-2 bg-white border p-2 rounded-md shadow-inner text-center">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="flex flex-col cursor-help group">
                                                            <span className="text-[8px] uppercase font-bold opacity-50 group-hover:text-primary">Due</span>
                                                            <span className="font-black text-xs border-b border-dotted text-primary">K{(row.totalDue || 0).toFixed(0)}</span>
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-3 shadow-xl border-primary/20">
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 mb-3">Balance Breakdown</h4>
                                                        {row.breakdown ? (
                                                            <div className="space-y-2 text-xs font-medium">
                                                                <div className="flex justify-between"><span>Base Tuition:</span> <span>K{row.breakdown.tuition.toFixed(2)}</span></div>
                                                                {row.breakdown.scholarship > 0 && <div className="flex justify-between text-blue-600 font-bold"><span>Scholarship:</span> <span>- K{row.breakdown.scholarship.toFixed(2)}</span></div>}
                                                                
                                                                {row.breakdown.mandatoryItems?.map((item, i) => (
                                                                    <div key={`m-${i}`} className="flex justify-between text-[10px] opacity-60">
                                                                        <span>+ {item.name}:</span>
                                                                        <span>K{item.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                                
                                                                {row.breakdown.optionalItems?.map((item, i) => (
                                                                    <div key={`o-${i}`} className="flex justify-between text-[10px] opacity-60">
                                                                        <span>+ {item.name}:</span>
                                                                        <span>K{item.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}

                                                                {row.breakdown.late > 0 && <div className="flex justify-between text-destructive"><span>Late Fee:</span> <span>K{row.breakdown.late.toFixed(2)}</span></div>}
                                                                <Separator className="my-1"/>
                                                                <div className="flex justify-between font-black text-primary"><span>TOTAL PAYABLE:</span> <span>K{row.totalDue?.toFixed(2)}</span></div>
                                                            </div>
                                                        ) : <p className="text-[10px] italic opacity-60">Breakdown unavailable for manual prediction.</p>}
                                                    </PopoverContent>
                                                </Popover>
                                                <div className="flex flex-col border-x"><span className="text-[8px] uppercase font-bold opacity-50">Paid</span><span className="font-black text-xs text-green-600">K{(row.totalPaid || 0).toFixed(0)}</span></div>
                                                <div className="flex flex-col"><span className="text-[8px] uppercase font-bold opacity-50">After Pay</span><span className="font-black text-xs text-destructive">K{( (row.totalDue || 0) - (row.totalPaid || 0) - (parseFloat(row.amount) || 0) ).toFixed(0)}</span></div>
                                            </div>
                                        ) : <div className="h-10 border border-dashed rounded flex items-center justify-center text-[10px] text-muted-foreground italic px-4 text-center">{row.isNewStudent ? "New registration deposit" : "Complete selection to view audit"}</div>}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1"><Label className="text-[9px]">Amount (ZMW)</Label><Input type="number" placeholder="0.00" value={row.amount} onChange={e => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} className="h-9 font-black text-primary" /></div>
                                            <div className="space-y-1"><Label className="text-[9px]">Comment</Label><Input placeholder="Ref..." value={row.comment} onChange={e => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-9 text-xs" /></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setBulkPaymentRows(p => [...p, { key: Date.now(), amount: '', comment: '' }])}><PlusCircle className="mr-2 h-4 w-4"/>Add Transaction Row</Button>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsBulkRecordOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveAllBulk} disabled={formLoading || bulkPaymentRows.length === 0}>
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : null}
                            Confirm Transactions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={(o) => { if(!o) setHistoryStudent(null); setIsHistoryOpen(o); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <DialogTitle>Account Statement: {historyStudent?.studentName}</DialogTitle>
                                <DialogDescription>Viewing ledger for {historyStudent?.studentId}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {historyStudent && (
                        <Tabs defaultValue={historyStudent.semesterId || ''} className="flex-1 overflow-hidden flex flex-col mt-4">
                            <TabsList className="justify-start h-10 w-full overflow-x-auto bg-muted/50 p-1 shrink-0 scrollbar-hide">
                                {paymentInfos
                                    .filter(p => p.userId === historyStudent.userId)
                                    .map(p => {
                                        const sem = semesters.find(s => s.id === p.semesterId);
                                        return <TabsTrigger key={p.semesterId} value={p.semesterId || ''} className="text-[10px] font-black uppercase px-4">{sem?.name || 'General'}</TabsTrigger>
                                    })
                                }
                            </TabsList>
                            {paymentInfos
                                .filter(p => p.userId === historyStudent.userId)
                                .map(p => (
                                    <TabsContent key={p.semesterId} value={p.semesterId || ''} className="flex-1 flex flex-col min-h-0 pt-4 data-[state=active]:flex">
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="p-3 rounded-lg border bg-muted/20 flex flex-col justify-between items-start group relative">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Total Invoiced</p>
                                                    <p className="text-lg font-black">ZMW {p.totalDue.toFixed(2)}</p>
                                                </div>
                                                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold text-primary hover:no-underline" onClick={() => {
                                                    setAdjustmentTarget({ type: 'invoice', id: p.invoiceId, oldValue: p.totalDue, userId: p.userId, studentName: p.studentName, studentId: p.studentId });
                                                    setAdjNewValue(String(p.totalDue));
                                                    setIsAdjustmentOpen(true);
                                                }}><Pencil className="h-2.5 w-2.5 mr-1"/> Request Adjust</Button>
                                            </div>
                                            <div className="p-3 rounded-lg border bg-green-50/50">
                                                <p className="text-[9px] font-black uppercase text-green-700 tracking-widest">Amount Paid</p>
                                                <p className="text-lg font-black text-green-600">ZMW {p.totalPaid.toFixed(2)}</p>
                                            </div>
                                            <div className="p-3 rounded-lg border bg-red-50/50">
                                                <p className="text-[9px] font-black uppercase text-red-700 tracking-widest">Balance</p>
                                                <p className="text-lg font-black text-destructive">ZMW {p.balance.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-auto border rounded-xl shadow-inner bg-background">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-background z-10 border-b">
                                                    <TableRow>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Method</TableHead>
                                                        <TableHead>Comment</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                        <TableHead className="w-10"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {rawTransactions
                                                        .filter(t => t.userId === p.userId && t.invoiceId === p.invoiceId)
                                                        .map(tx => (
                                                            <TableRow key={tx.key} className="group hover:bg-muted/20">
                                                                <TableCell className="text-xs font-medium">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                                <TableCell><Badge variant="outline" className="text-[9px] uppercase font-black">{tx.method}</Badge></TableCell>
                                                                <TableCell className="text-xs text-muted-foreground italic truncate max-w-[200px]">{tx.comment || '-'}</TableCell>
                                                                <TableCell className="text-right font-black text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell>
                                                                <TableCell>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => {
                                                                        setAdjustmentTarget({ type: 'transaction', id: tx.key, oldValue: tx.amount, userId: p.userId, studentName: p.studentName, studentId: p.studentId });
                                                                        setAdjNewValue(String(tx.amount));
                                                                        setIsAdjustmentOpen(true);
                                                                    }}><Pencil className="h-3 w-3"/></Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    }
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                ))
                            }
                        </Tabs>
                    )}
                    <DialogFooter className="border-t pt-4">
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Request Adjustment</DialogTitle>
                        <DialogDescription>Propose a financial correction for administrative review.</DialogDescription>
                    </DialogHeader>
                    {adjustmentTarget && (
                        <div className="space-y-4 py-4">
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Target</Label>
                                <p className="text-sm font-bold capitalize">{adjustmentTarget.type}: {adjustmentTarget.studentName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-xs">Original Value</Label>
                                    <div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm line-through opacity-50 font-mono">ZMW {adjustmentTarget.oldValue.toFixed(2)}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-primary">New Value</Label>
                                    <Input type="number" value={adjNewValue} onChange={e => setAdjNewValue(e.target.value)} placeholder="0.00" className="border-primary/40 font-mono font-bold" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Reason for Change</Label>
                                <Textarea value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="Explain the correction..." rows={4} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAdjustmentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRequestAdjustment} disabled={formLoading || !adjNewValue || !adjReason.trim()}>
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : null}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
