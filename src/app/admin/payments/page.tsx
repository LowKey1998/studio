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
    Download
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, getRegistrarIds, createNotification } from '@/lib/firebase';
import { ref, get, set, push, onValue, off, serverTimestamp, update } from 'firebase/database';
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
    const [allUsers, setAllUsers] = React.useState<Record<string, any>>({});
    const [programmes, setProgrammes] = React.useState<any[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    
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
        institution: ref(db, 'settings/institution')
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
        unsubs.push(onValue(dataRefs.financialSettings, (snapshot) => { store.financialSettings = snapshot.val(); computeDerived(store); }));
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
                    updates[`studentCreationRequests/${reqRef.key}`] = { tempId: row.tempStudentId || null, tempName: row.tempStudentName || null, targetSemesterId: row.semesterId || null, amountPaid: amount, status: 'pending', timestamp: Date.now() };
                    updates[`transactions/${txRef.key}`] = { transactionId: `DEP-${Date.now()}-${randomSuffix}`, userId: 'unlinked', amount, paymentDate: now, status: 'successful', method: 'Cash', recordedBy: userData.name, requestId: reqRef.key, senderName: row.tempStudentName || null };
                } else if (row.userId) {
                    const txRef = push(ref(db, 'transactions'));
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                    updates[`transactions/${txRef.key}`] = { 
                        transactionId: `CASH-${Date.now()}-${randomSuffix}`, 
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
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div><CardTitle className="font-headline text-2xl text-primary">Financial Audit Hub</CardTitle><CardDescription>Institutional revenue and compliance audit.</CardDescription></div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {cashFlowCards.map((c, i) => (
                            <Card key={i} className="bg-card border-0 shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-[10px] font-black uppercase text-muted-foreground">{c.label}</CardTitle>
                                    <c.icon className={cn("h-4 w-4", c.color)} />
                                </CardHeader>
                                <CardContent>
                                    <div className={cn("text-2xl font-black", c.color)}>
                                        {typeof c.value === 'number' && i < 3 ? `ZMW ${c.value.toFixed(2)}` : c.value}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
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
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Intake</Label><Select value={intakeFilter} onValueChange={setIntakeFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Intakes</SelectItem>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-[10px] font-black uppercase opacity-60">Programme</Label><Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="p-2 border rounded-xl bg-primary/5 text-center flex flex-col justify-center">
                        <span className="text-2xl font-black text-primary">{filteredData.length}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Registered Students</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-md">
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
                                        <TableCell className="text-right font-black text-sm text-destructive">ZMW {info.balance.toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center cursor-pointer" onClick={() => { setSelectedDetail(info); setIsDetailOpen(true); }}>
                                                {info.balance <= 0.01 ? <Badge className="bg-green-600 text-[8px] font-black">Cleared</Badge> : info.thresholdMet ? <Badge variant="secondary" className="bg-primary/10 text-primary text-[8px] font-black">Good Standing</Badge> : <Badge variant="destructive" className="text-[8px] font-black animate-pulse">Below Threshold</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="sm" variant="ghost" className="h-8 text-primary font-bold hover:bg-primary/10" onClick={() => handleRowPay(info)}><Wallet className="h-3 w-3 mr-1.5"/> Pay</Button>
                                                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setSelectedDetail(info); setIsDetailOpen(true); }}><Info className="mr-2 h-4 w-4"/>Financial Audit</DropdownMenuItem><DropdownMenuItem onClick={() => handleEmailInvoice(info)} disabled={actionLoading === `email-inv-${info.userId}`}><Mail className="mr-2 h-4 w-4"/>Email Invoice</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
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
                                <div className="p-3 rounded-lg border bg-muted/20 flex flex-col items-center gap-1"><span className="text-[9px] font-bold opacity-60 uppercase">TOTAL DUE</span><span className="font-black">ZMW {selectedDetail?.totalDue.toFixed(2)}</span></div>
                                <div className="p-3 rounded-lg border bg-green-50/50 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-green-700 opacity-60 uppercase">TOTAL PAID</span><span className="font-black text-green-700">ZMW {selectedDetail?.totalPaid.toFixed(2)}</span></div>
                                <div className="p-3 rounded-lg border bg-red-50/50 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-red-700 opacity-60 uppercase">BALANCE</span><span className="font-black text-red-700">ZMW {selectedDetail?.balance.toFixed(2)}</span></div>
                                <div className="p-3 rounded-lg border bg-primary/5 flex flex-col items-center gap-1"><span className="text-[9px] font-bold text-primary opacity-60 uppercase">THRESHOLD</span><span className="font-black text-primary">{selectedDetail?.targetThreshold}%</span></div>
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
                                    <TableHeader><TableRow className="bg-muted/50"><TableHead className="h-8 text-[10px]">Date</TableHead><TableHead className="h-8 text-[10px]">Ref</TableHead><TableHead className="h-8 text-[10px] text-right">Credit</TableHead><TableHead className="h-8 text-[10px] text-right"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {selectedDetail?.transactions.map((tx, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                <TableCell className="text-xs font-mono opacity-60 truncate max-w-[120px]">{tx.transactionId}</TableCell>
                                                <TableCell className="text-right font-black text-xs text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell>
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
        </div>
    );
}
