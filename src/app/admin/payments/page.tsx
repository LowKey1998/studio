'use client';
import * as React from 'react';
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
    Filter,
    Save,
    CheckCircle,
    XCircle,
    ShieldAlert,
    GraduationCap,
    Info,
    X,
    UserCheck,
    Lock,
    Unlock,
    ArrowRight,
    MoreVertical
} from 'lucide-react';
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle, 
    CardFooter 
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, push, set, onValue, off } from 'firebase/database';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
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
    penaltiesActive: boolean;
    isScholarship: boolean;
    paidPercentage: number;
    targetThreshold: number;
    gracePeriod: number;
};

type PaymentRecord = {
    key: number;
    userId?: string;
    year?: string;
    semesterId?: string;
    amount: string;
    comment: string;
    setTotalDue?: string; 
    totalDue?: number;
    totalPaid?: number;
    availableYears?: string[];
    availableSemesters?: Semester[];
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
    intakeName?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentPlanIds?: Record<string, boolean>; gracePeriodDays?: number; paymentThreshold?: number; billingPolicy?: 'course' | 'semester'; tuitionFee?: number; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };

type OptionGroup = { groupName: string; items: { value: string; label: string }[] };

// --- COMPONENTS ---

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
                <Button variant="outline" className="w-full justify-between h-10 px-3 bg-background border-primary/20" disabled={disabled}>
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" side="bottom" align="start">
                <div className="p-2">
                    <Input 
                        placeholder="Search roster..." 
                        className="h-9" 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>
                <Separator />
                <ScrollArea className="h-200px">
                    <div className="p-1">
                    {filteredOptions.length > 0 ? filteredOptions.map(group => (
                        <div key={group.groupName} className="p-1">
                            <div className="px-2 py-1.5 text-[10px] font-black uppercase text-muted-foreground tracking-widest">{group.groupName}</div>
                            {group.items.map(option => (
                                <Button
                                    key={option.value}
                                    variant="ghost"
                                    className="w-full justify-start h-auto py-2 px-2 text-left text-sm"
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
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    
    const [loading, setLoading] = React.useState(true);
    const isFirstLoad = React.useRef(true);
    const [saving, setSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [minPaidFilter, setMinPaidFilter] = React.useState('');
    const [maxPaidFilter, setMaxPaidFilter] = React.useState('');
    const [equalPaidFilter, setEqualPaidFilter] = React.useState('');
    const [timeFilter, setTimeFilter] = React.useState<'today' | 'week' | 'month' | 'period' | 'all'>('all');
    const [customRange, setCustomRange] = React.useState<DateRange | undefined>();

    // Single Recording State
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
    const [selectedStudent, setSelectedStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [singleYear, setSingleYear] = React.useState('');
    const [singleSemId, setSingleSemId] = React.useState('');
    const [paymentAmount, setPaymentAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState('Cash');
    const [transactionId, setTransactionId] = React.useState('');
    const [manualTotalDue, setManualTotalDue] = React.useState('');

    // Bulk Recording State
    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);
    
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);

    const { toast } = useToast();

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
        
        const refs = [
            ref(db, 'users'),
            ref(db, 'registrations'),
            ref(db, 'transactions'),
            ref(db, 'programmes'),
            ref(db, 'semesters'),
            ref(db, 'intakes'),
            ref(db, 'invoices'),
            ref(db, 'settings/financialSettings'),
            ref(db, 'calendarEvents'),
            ref(db, 'settings/academicCalendar')
        ];

        const unsubs = refs.map((r, index) => onValue(r, (snapshot) => {
            const data = snapshot.val() || {};
            switch(index) {
                case 0: {
                    const users = data;
                    const studentList: StudentInfo[] = [];
                    for (const uid in users) {
                        if (users[uid].role?.toLowerCase() === 'student') {
                            studentList.push({ uid, id: users[uid].id, name: users[uid].name, intakeId: users[uid].intakeId, programmeId: users[uid].programmeId });
                        }
                    }
                    setAllStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));
                } break;
                case 3: setProgrammes(Object.entries(data).map(([id, d]:[string,any]) => ({id, ...d}))); break;
                case 4: setSemesters(Object.entries(data).map(([id, d]:[string,any]) => ({id, ...d}))); break;
                case 5: setAllIntakes(Object.entries(data).map(([id, d]:[string,any]) => ({id, ...d}))); break;
                case 7: setFinancialSettings(data); break;
                case 9: setCalendarSettings(data); break;
            }
            
            const refreshDerived = async () => {
                if(isFirstLoad.current) setLoading(true);
                
                const [u, r, t, p, s, i, inv, f, ev] = await Promise.all(refs.slice(0, 9).map(ref => get(ref)));
                
                const users = u.val() || {};
                const regsData = r.val() || {};
                const txsData = t.val() || {};
                const semsData = s.val() || {};
                const intsData = i.val() || {};
                const invsData = inv.val() || {};
                const calendarEvents = Object.values(ev.val() || {}) as any[];
                const finData = f.val() || { paymentThreshold: 75 };

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
                    const userProfile = users[userId];
                    if (!userProfile || userProfile.role?.toLowerCase() !== 'student') continue;

                    for (const semesterId in regsData[userId]) {
                        const reg = regsData[userId][semesterId];
                        const semesterInfo = semsData[semesterId];
                        if (!semesterInfo) continue;

                        const invoice = invsData[userId]?.[reg.invoiceId];
                        if (invoice) {
                            let tuition = Number(invoice.totalTuition || 0);
                            if (tuition === 0 && semesterInfo.billingPolicy === 'semester') {
                                tuition = Number(semesterInfo.tuitionFee || 0);
                            }
                            
                            let mandatory = Number(invoice.totalMandatoryFees || 0);
                            if (mandatory === 0 && semesterInfo.mandatoryFees) {
                                mandatory = Object.values(semesterInfo.mandatoryFees as Record<string, any>).reduce((acc, f) => acc + (f.amount || 0), 0);
                            }

                            const scholarPerc = Number(invoice.scholarshipPercentage || 100);
                            const totalPayable = invoice.applyScholarship 
                                ? (tuition * (1 - (scholarPerc / 100))) + mandatory + Number(invoice.totalOptionalFees || 0) + (invoice.lateFee || 0)
                                : (tuition + mandatory + Number(invoice.totalOptionalFees || 0) + (invoice.lateFee || 0));

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
                                userId, studentId: userProfile.id, studentName: userProfile.name,
                                totalDue: totalPayable, totalPaid, balance,
                                programmeId: reg.programmeId, intakeId: semesterInfo.intakeId || null, semesterId,
                                invoiceId: reg.invoiceId, enrolledCourses: reg.courses || [],
                                thresholdMet, penaltiesActive, isScholarship: !!invoice.applyScholarship,
                                paidPercentage, targetThreshold: threshold, gracePeriod: grace,
                                status: balance <= 0.01 ? 'Paid' : 'Pending'
                            };
                        }
                    }
                }
                setPaymentInfos(Object.values(studentPaymentMap));
                setLoading(false);
                isFirstLoad.current = false;
            };
            refreshDerived();
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, [userData?.uid, serverTimeOffset, allIntakes, allStudents, semesters]);

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
                
                if (field === 'userId') {
                    const studentInfo = allStudents.find(s => s.uid === value);
                    if (studentInfo) {
                        const studentIntakeId = studentInfo.intakeId;
                        const validSemesters = semesters.filter(s => s.intakeId === studentIntakeId);
                        const years = Array.from(new Set(validSemesters.map(s => String(s.year)))).sort();
                        nextRow.availableYears = years;
                        nextRow.year = undefined;
                        nextRow.semesterId = undefined;
                        nextRow.availableSemesters = [];
                        nextRow.totalDue = 0;
                        nextRow.totalPaid = 0;
                    }
                } else if (field === 'year') {
                    const studentInfo = allStudents.find(s => s.uid === row.userId);
                    const validSems = semesters.filter(s => s.intakeId === studentInfo?.intakeId && String(s.year) === value);
                    nextRow.availableSemesters = validSems;
                    nextRow.semesterId = undefined;
                    nextRow.totalDue = 0;
                    nextRow.totalPaid = 0;
                } else if (field === 'semesterId') {
                    const studentUid = row.userId;
                    const info = paymentInfos.find(p => p.userId === studentUid && p.semesterId === value);
                    nextRow.totalDue = info?.totalDue || 0;
                    nextRow.totalPaid = info?.totalPaid || 0;
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
        const paymentsToRecord = bulkPaymentRows.filter(p => parseFloat(p.amount) > 0 && p.userId && p.semesterId);
        if(paymentsToRecord.length === 0) { toast({ variant: 'destructive', title: 'No valid payments entered.' }); return; }
        
        setFormLoading(true);
        const updates: Record<string, any> = {};
        const now = new Date().toISOString();

        try {
            for (const record of paymentsToRecord) {
                const amountFloat = parseFloat(record.amount);
                const studentUid = record.userId!;
                const semId = record.semesterId!;
                const semesterInfo = semesters.find(s => s.id === semId)!;
                const studentStanding = paymentInfos.find(p => p.userId === studentUid && p.semesterId === semId);

                let invoiceId = studentStanding?.invoiceId;
                if (!invoiceId) {
                    const newInvoiceRef = push(ref(db, `invoices/${studentUid}`));
                    invoiceId = newInvoiceRef.key!;
                    updates[`invoices/${studentUid}/${invoiceId}`] = {
                        invoiceId, 
                        totalTuition: record.setTotalDue ? parseFloat(record.setTotalDue) : (record.totalDue || 0), 
                        totalMandatoryFees: 0, 
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
                    userId: studentUid, invoiceId, amount: amountFloat, currency: 'ZMW', status: 'successful',
                    paymentDate: now, method: 'Manual', comment: record.comment || ''
                };
                
                createNotification(studentUid, `Payment of ZMW ${amountFloat.toFixed(2)} recorded for ${semesterInfo.name}.`, '/student/payments').catch(() => {});
            }
            
            await update(ref(db), updates);
            toast({ title: "Transactions Recorded", description: `Processed ${paymentsToRecord.length} records.` });
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
        } catch (e: any) { toast({ variant: 'destructive', title: 'Save Failed', description: e.message }); }
        finally { setFormLoading(false); }
    };

    const handleRecordSinglePayment = async () => {
        if(!selectedStudent || !paymentAmount || !singleSemId) { toast({ variant: 'destructive', title: 'Missing fields' }); return; }
        setFormLoading(true);
        try {
            const amount = parseFloat(paymentAmount);
            const sem = semesters.find(s => s.id === singleSemId)!;
            const standing = paymentInfos.find(p => p.userId === selectedStudent.userId && p.semesterId === singleSemId);
            
            const updates: Record<string, any> = {};
            let invId = standing?.invoiceId;
            const now = new Date().toISOString();

            if (!invId) {
                const newInvRef = push(ref(db, `invoices/${selectedStudent.userId}`));
                invId = newInvRef.key!;
                updates[`invoices/${selectedStudent.userId}/${invId}`] = {
                    invoiceId: invId, 
                    totalTuition: manualTotalDue ? parseFloat(manualTotalDue) : 0, 
                    totalMandatoryFees: 0, 
                    totalOptionalFees: 0,
                    dateCreated: now, 
                    semester: sem.name, 
                    semesterId: sem.id
                };
                updates[`registrations/${selectedStudent.userId}/${sem.id}/invoiceId`] = invId;
            }

            const txRef = push(ref(db, 'transactions'));
            const txId = transactionId.trim() || `MANUAL-${Date.now()}-${txRef.key?.slice(-4)}`;
            
            updates[`transactions/${txRef.key}`] = {
                transactionId: txId, userId: selectedStudent.userId, invoiceId: invId, amount,
                currency: 'ZMW', status: 'successful', paymentDate: now, method: paymentMethod,
                recordedBy: userData?.name || 'Accountant',
            };

            await update(ref(db), updates);
            toast({ title: "Transaction Recorded", description: `ZMW ${amount.toFixed(2)} credited.` });
            setIsRecordPaymentOpen(false);
            resetDialog();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Recording Failed' }); }
        finally { setFormLoading(false); }
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

    const resetDialog = () => {
        setSelectedStudent(null);
        setPaymentAmount('');
        setPaymentMethod('Cash');
        setTransactionId('');
        setManualTotalDue('');
        setSingleYear('');
        setSingleSemId('');
    };

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
                            <CardContent><div className="text-2xl font-black text-primary">ZMW {summaryStats.periodCollected.toFixed(2)}</div></CardContent>
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
                            <Button variant="outline" size="sm" onClick={handleSaveAsDefault} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save Default Filters</Button>
                            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                            <Button size="sm" onClick={() => { setBulkPaymentRows([{ key: Date.now(), amount: '', comment: '' }]); setIsBulkRecordOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Record Transaction(s)</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 rounded-xl border bg-muted/10 items-end">
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
                            <Label className="text-[10px] font-black uppercase">Time Range</Label>
                            <Select value={timeFilter} onValueChange={(val:any) => setTimeFilter(val)}>
                                <SelectTrigger className="h-9 bg-background border-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Time</SelectItem>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="week">This Week</SelectItem>
                                    <SelectItem value="month">This Month</SelectItem>
                                    <SelectItem value="period">Custom Period</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 lg:col-span-2">
                            <Label className="text-[10px] font-black uppercase">Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8 h-9 bg-background shadow-sm h-10 border-primary/20" placeholder="ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border bg-muted/5 items-end">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60">Amount Paid ≥</Label>
                            <Input type="number" placeholder="Min. Amount" value={minPaidFilter} onChange={e => setMinPaidFilter(e.target.value)} className="h-9 bg-background" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60">Amount Paid ≤</Label>
                            <Input type="number" placeholder="Max. Amount" value={maxPaidFilter} onChange={e => setMaxPaidFilter(e.target.value)} className="h-9 bg-background" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase opacity-60">Amount Paid =</Label>
                            <Input type="number" placeholder="Exact Amount" value={equalPaidFilter} onChange={e => setEqualPaidFilter(e.target.value)} className="h-9 bg-background" />
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
                                            <TableCell className="font-mono text-[10px] font-black opacity-60">{info.studentId}</TableCell>
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
                                                    <span className="text-[10px] text-muted-foreground uppercase">{semesters.find(s=>s.id===info.semesterId)?.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">{programmes.find(p=>p.id===info.programmeId)?.name || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-black text-sm">ZMW {info.balance.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-green-600 font-bold text-xs">ZMW {info.totalPaid.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">
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
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setHistoryStudent(info); setIsHistoryOpen(true); }}><HistoryIcon className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSelectedStudent(info); setIsRecordPaymentOpen(true); }}><PlusCircle className="h-4 w-4" /></Button>
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

            <Dialog open={isRecordPaymentOpen} onOpenChange={(o) => { if(!o) setSelectedStudent(null); setIsRecordPaymentOpen(o); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Record Payment: {selectedStudent?.studentName}</DialogTitle><DialogDescription>Direct account credit for {selectedStudent?.studentId}.</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/10 rounded-xl">
                            <UserCheck className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-muted-foreground leading-none">Current Standing</span>
                                <span className="text-sm font-bold text-primary">{selectedStudent ? calculateStandingForUser(selectedStudent.userId) : 'Select student...'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Year</Label><Select value={singleYear} onValueChange={(val) => { setSingleYear(val); setSingleSemId(''); }}><SelectTrigger><SelectValue placeholder="Select Year..."/></SelectTrigger><SelectContent>{Array.from(new Set(semesters.filter(s => s.intakeId === selectedStudent?.intakeId).map(s => String(s.year)))).sort().map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1"><Label>Semester</Label><Select value={singleSemId} onValueChange={setSingleSemId} disabled={!singleYear}><SelectTrigger><SelectValue placeholder="Select Sem..."/></SelectTrigger><SelectContent>{semesters.filter(s => s.intakeId === selectedStudent?.intakeId && String(s.year) === singleYear).map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' ').slice(-2).join(' ')}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        {singleSemId && (
                            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-60">Semester Audit</Label>
                                {(() => {
                                    const info = paymentInfos.find(p => p.userId === selectedStudent?.userId && p.semesterId === singleSemId);
                                    if (!info) return (
                                        <div className="space-y-2">
                                            <p className="text-[10px] italic text-primary font-bold">No active invoice found. Setting payment will initialize registration.</p>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase">Set Expected Total Due (Optional)</Label>
                                                <Input type="number" value={manualTotalDue} onChange={e => setManualTotalDue(e.target.value)} placeholder="0.00" className="h-8 text-xs"/>
                                            </div>
                                        </div>
                                    );
                                    return (
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="flex flex-col"><span className="text-[8px] uppercase font-bold opacity-60">Due</span><span className="font-bold text-xs">K{info.totalDue.toFixed(0)}</span></div>
                                            <div className="flex flex-col border-x"><span className="text-[8px] uppercase font-bold opacity-60">Paid</span><span className="font-bold text-xs text-green-600">K{info.totalPaid.toFixed(0)}</span></div>
                                            <div className="flex flex-col"><span className="text-[8px] uppercase font-bold opacity-60">Balance</span><span className="font-black text-xs text-destructive">K{info.balance.toFixed(0)}</span></div>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}
                        <div className="space-y-1"><Label>Amount being paid (ZMW)</Label><Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" className="h-12 text-lg font-bold" /></div>
                        
                        <Alert className="bg-muted/50 border-0">
                            <Clock className="h-4 w-4" />
                            <AlertTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Audit Notice</AlertTitle>
                            <AlertDescription className="text-[10px] italic leading-tight">
                                Manual entries are timestamped and logged against your staff profile for financial audit.
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Deposit">Bank Deposit</SelectItem><SelectItem value="Direct Transfer">Transfer</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1"><Label>Reference #</Label><Input value={transactionId} onChange={e => setTransactionId(e.target.value.toUpperCase())} placeholder="REF#" /></div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordSinglePayment} disabled={formLoading || !paymentAmount}>Record Transaction</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBulkRecordOpen} onOpenChange={setIsBulkRecordOpen}>
                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Record Transaction(s)</DialogTitle><DialogDescription>Batch process multiple manual student payments.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 space-y-4 py-4">
                        {bulkPaymentRows.map((row, idx) => (
                            <Card key={row.key} className="border-l-4 border-l-primary shadow-sm bg-muted/5 relative group">
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleRemovePaymentRow(row.key)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{idx + 1}</div><Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Student & Academic Period</Label></div>
                                        <SearchableSelect options={studentOptions} value={row.userId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'userId', v)} placeholder="Search student name or ID..." />
                                        {row.userId && (
                                            <div className="text-[10px] font-bold text-primary animate-in fade-in flex items-center gap-1.5 px-1">
                                                <UserCheck className="h-3 w-3" />
                                                Current standing: {calculateStandingForUser(row.userId)}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Select value={row.year} onValueChange={v => handleBulkPaymentRowChange(row.key, 'year', v)} disabled={!row.userId}><SelectTrigger className="h-9"><SelectValue placeholder="Year..."/></SelectTrigger><SelectContent>{(row.availableYears || []).map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select>
                                            <Select value={row.semesterId} onValueChange={v => handleBulkPaymentRowChange(row.key, 'semesterId', v)} disabled={!row.year}><SelectTrigger className="h-9"><SelectValue placeholder="Semester..."/></SelectTrigger><SelectContent>{(row.availableSemesters || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name.split(' ').slice(-2).join(' ')}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                        {row.semesterId && !paymentInfos.find(p => p.userId === row.userId && p.semesterId === row.semesterId) && (
                                            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                                <Label className="text-[9px] uppercase font-bold text-primary">Initialize Semester Total Due</Label>
                                                <Input type="number" placeholder="Set Expected Total" value={row.setTotalDue} onChange={e => handleBulkPaymentRowChange(row.key, 'setTotalDue', e.target.value)} className="h-8 text-xs" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-3 border-l pl-6 bg-background/50 rounded-r-lg">
                                        <div className="flex justify-between items-center"><Label className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Transaction Details</Label>{row.semesterId && <Badge variant="outline" className="text-[9px] font-bold bg-white">Semester Audit</Badge>}</div>
                                        {row.semesterId ? (
                                            <div className="grid grid-cols-3 gap-2 bg-white border p-2 rounded-md shadow-inner text-center">
                                                <div className="flex flex-col"><span className="text-[8px] uppercase font-bold opacity-50">Total Due</span><span className="font-black text-xs">K{(row.totalDue || (parseFloat(row.setTotalDue || '0'))).toFixed(0)}</span></div>
                                                <div className="flex flex-col border-x"><span className="text-[8px] uppercase font-bold opacity-50">Paid</span><span className="font-black text-xs text-green-600">K{(row.totalPaid || 0).toFixed(0)}</span></div>
                                                <div className="flex flex-col"><span className="text-[8px] uppercase font-bold opacity-50">Balance</span><span className="font-black text-xs text-destructive">K{( (row.totalDue || parseFloat(row.setTotalDue || '0')) - (row.totalPaid || 0) - (parseFloat(row.amount) || 0) ).toFixed(0)}</span></div>
                                            </div>
                                        ) : <div className="h-10 border border-dashed rounded flex items-center justify-center text-[10px] text-muted-foreground italic">Select student & semester to audit</div>}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1"><Label className="text-[9px]">Amount being paid</Label><Input type="number" placeholder="0.00" value={row.amount} onChange={e => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} className="h-9 font-black text-primary" /></div>
                                            <div className="space-y-1"><Label className="text-[9px]">Note / Ref</Label><Input placeholder="Notes..." value={row.comment} onChange={e => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-9 text-xs" /></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        <Button variant="outline" className="w-full border-dashed" onClick={() => setBulkPaymentRows(p => [...p, { key: Date.now(), amount: '', comment: '' }])}><PlusCircle className="mr-2 h-4 w-4"/>Add Transaction Row</Button>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsBulkRecordOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveAllBulk} disabled={formLoading || bulkPaymentRows.length === 0}>
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : null}
                            Confirm & Save Transactions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={(o) => { if(!o) setHistoryStudent(null); setIsHistoryOpen(o); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <DialogTitle>Transaction History: {historyStudent?.studentName}</DialogTitle>
                                <DialogDescription>Viewing full institutional ledger for {historyStudent?.studentId}</DialogDescription>
                            </div>
                            <div className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                                <UserCheck className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold text-primary uppercase">Standing: {historyStudent ? calculateStandingForUser(historyStudent.userId) : ''}</span>
                            </div>
                        </div>
                    </DialogHeader>
                    {historyStudent && (
                        <Tabs defaultValue={historyStudent.semesterId || ''} className="flex-1 overflow-hidden flex flex-col mt-4">
                            <TabsList className="justify-start h-10 w-full overflow-x-auto bg-muted/50 p-1 shrink-0">
                                {paymentInfos
                                    .filter(p => p.userId === historyStudent.userId)
                                    .sort((a,b) => {
                                        const semA = semesters.find(s => s.id === a.semesterId);
                                        const semB = semesters.find(s => s.id === b.semesterId);
                                        if (!semA || !semB) return 0;
                                        return (semB.year * 10 + semB.semesterInYear) - (semA.year * 10 + semA.semesterInYear);
                                    })
                                    .map(p => {
                                        const sem = semesters.find(s => s.id === p.semesterId);
                                        const intake = allIntakes.find(i => i.id === sem?.intakeId);
                                        const standing = sem ? `Year ${sem.year}, Sem ${sem.semesterInYear}` : 'N/A';
                                        return (
                                            <TabsTrigger key={p.semesterId} value={p.semesterId || ''} className="text-[10px] font-black uppercase px-4 tracking-widest">
                                                {intake?.name} - {standing}
                                            </TabsTrigger>
                                        )
                                    })
                                }
                            </TabsList>
                            {paymentInfos
                                .filter(p => p.userId === historyStudent.userId)
                                .map(p => (
                                    <TabsContent key={p.semesterId} value={p.semesterId || ''} className="flex-1 flex flex-col min-h-0 pt-4 data-[state=active]:flex">
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="p-3 rounded-lg border bg-muted/20">
                                                <p className="text-[9px] font-black uppercase opacity-60 tracking-widest">Total Due</p>
                                                <p className="text-lg font-black">ZMW {p.totalDue.toFixed(2)}</p>
                                            </div>
                                            <div className="p-3 rounded-lg border bg-green-50/50">
                                                <p className="text-[9px] font-black uppercase text-green-700 tracking-widest">Paid</p>
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
                                                        <TableHead>Comment / Ref</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {rawTransactions
                                                        .filter(t => t.userId === p.userId && t.invoiceId === p.invoiceId)
                                                        .map(tx => (
                                                            <TableRow key={tx.key} className="group hover:bg-muted/30">
                                                                <TableCell className="text-xs font-medium">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                                <TableCell><Badge variant="outline" className="text-[9px] uppercase font-black tracking-tighter">{tx.method}</Badge></TableCell>
                                                                <TableCell className="text-xs text-muted-foreground italic truncate max-w-[200px]">{tx.comment || '-'}</TableCell>
                                                                <TableCell className="text-right font-black text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    }
                                                    {rawTransactions.filter(t => t.userId === p.userId && t.invoiceId === p.invoiceId).length === 0 && (
                                                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No transactions found for this semester.</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                ))
                            }
                        </Tabs>
                    )}
                    <DialogFooter className="border-t pt-4">
                        <DialogClose asChild><Button variant="outline">Close Statement</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
