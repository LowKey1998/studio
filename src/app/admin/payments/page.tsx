'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    Search, 
    DollarSign, 
    PlusCircle, 
    History, 
    X, 
    ChevronDown, 
    Calendar as CalendarIcon, 
    Save, 
    Info, 
    AlertTriangle,
    CheckCircle2,
    ShieldAlert,
    User,
    ArrowRight,
    TrendingUp,
    Clock,
    ChevronsUpDown,
    PencilLine,
    Check,
    RotateCcw,
    Trash2,
    UserPlus,
    Settings2,
    Send,
    AlertCircle,
    CalendarDays,
    Wallet,
    Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, set, push, onValue, serverTimestamp, remove } from 'firebase/database';
import { format, parseISO, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, addDays, isAfter } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

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
type Programme = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; startDate?: string; endDate?: string; paymentThreshold?: number; gracePeriodDays?: number; };
type StudentInfo = { uid: string; id: string; name: string; intakeId?: string; programmeId?: string; };
type PaymentPlan = { id: string; name: string; installments: number; installmentPercentages: number[]; archived?: boolean; };

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
};

export default function PaymentsManagementPage() {
    const { user, userProfile: userData } = useAuth();
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [allStudents, setAllStudents] = React.useState<StudentInfo[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [financialSettings, setFinancialSettings] = React.useState<any>(null);
    const [institutionSettings, setInstitutionSettings] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = React.useState('');
    const [intakeFilter, setIntakeFilter] = React.useState('all');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [minAmountFilter, setMinAmountFilter] = React.useState('');

    // Record Payment Form State
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
    const [paymentSelectedUserId, setPaymentSelectedUserId] = React.useState('');
    const [paymentSelectedYear, setPaymentSelectedYear] = React.useState('');
    const [paymentSelectedSemInYear, setPaymentSelectedSemInYear] = React.useState('');
    const [paymentAmount, setPaymentAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState('Cash');
    const [paymentComment, setPaymentComment] = React.useState('');
    const [dateReceived, setDateReceived] = React.useState<Date | undefined>(new Date());
    const [dialogSearchTerm, setDialogSearchTerm] = React.useState('');
    const [formLoading, setFormLoading] = React.useState(false);

    // Bulk Manual State
    const [isBulkManualOpen, setIsBulkManualOpen] = React.useState(false);
    const [bulkEntries, setBulkEntries] = React.useState<any[]>([{ id: `row-${Date.now()}`, studentId: '', amount: '', method: 'Cash', date: new Date(), studentUid: null, studentName: '', year: '', semesterInYear: '', comment: '', intakeId: null }]);
    const [bulkGlobalMethod, setBulkGlobalMethod] = React.useState('Cash');
    const [bulkGlobalDate, setBulkGlobalDate] = React.useState<Date | undefined>(new Date());
    const [bulkGlobalYear, setBulkGlobalYear] = React.useState('');
    const [bulkGlobalSem, setBulkGlobalSem] = React.useState('');

    // Request Account State
    const [isRequestAccountOpen, setIsRequestAccountOpen] = React.useState(false);
    const [requestMessage, setRequestMessage] = React.useState('');
    const [requestSubject, setRequestSubject] = React.useState('New Student Account Request');
    const [isTemplateSettingsOpen, setIsTemplateSettingsOpen] = React.useState(false);
    const [accountRequestTemplate, setAccountRequestTemplate] = React.useState({
        subject: 'New Student Account Request',
        body: 'Please create a new student account for the following individual who has made a manual payment:\n\nName: \nIntake: \nProgramme: \nAmount Paid: '
    });

    // Edit Request State
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [editRequestType, setEditRequestType] = React.useState<'transaction' | 'invoice'>('invoice');
    const [editTargetId, setEditTargetId] = React.useState('');
    const [oldValue, setOldValue] = React.useState(0);
    const [newValue, setNewValue] = React.useState('');
    const [editReason, setEditReason] = React.useState('');
    const [editStudentInfo, setEditStudentInfo] = React.useState<StudentPaymentInfo | null>(null);

    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, semestersSnap, intakesSnap, programmesSnap, invoicesSnap, calSnap, finSnap, plansSnap, eventsSnap, instSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'semesters')),
                get(ref(db, 'intakes')),
                get(ref(db, 'programmes')),
                get(ref(db, 'invoices')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'settings/financialSettings')),
                get(ref(db, 'settings/paymentPlans')),
                get(ref(db, 'calendarEvents')),
                get(ref(db, 'settings/institution'))
            ]);
            
            const users = usersSnap.val() || {};
            const registrations = regsSnap.val() || {};
            const transactionsData = transactionsSnap.val() || {};
            const allSemestersData = semestersSnap.val() || {};
            const allInvoicesData = invoicesSnap.val() || {};
            const calendarEvents = Object.values(eventsSnap.val() || {}) as any[];
            
            setCalendarSettings(calSnap.val() || {});
            setFinancialSettings(finSnap.val() || { paymentThreshold: 75 });
            setInstitutionSettings(instSnap.val() || { name: 'Edutrack360' });
            setSemesters(Object.keys(allSemestersData).map(id => ({ id, ...allSemestersData[id]})));
            setAllIntakes(Object.keys(intakesSnap.val() || {}).map(id => ({ id, ...intakesSnap.val()[id] })));
            setAllProgrammes(Object.keys(programmesSnap.val() || {}).map(id => ({ id, ...programmesSnap.val()[id] })));
            setAllPaymentPlans(Object.keys(plansSnap.val() || {}).map(id => ({ id, ...plansSnap.val()[id] })));

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
                transactionsList.push({ key: txId, ...tx });
            }
            setRawTransactions(transactionsList);

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
                        const plan = Object.values(plansSnap.val() || {}).find((p: any) => p.name === invoice.paymentPlan) as any;
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
                        const effectiveDeadline = nextDeadlineDate ? addDays(nextDeadlineDate, semesterInfo.gracePeriodDays || 0) : null;

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

    const handleRecordPaymentDialog = async () => {
        const student = allStudents.find(s => s.uid === paymentSelectedUserId);
        if(!student || !paymentSelectedYear || !paymentSelectedSemInYear || !paymentAmount || !dateReceived) { 
            toast({ variant: 'destructive', title: 'Missing required fields' }); 
            return; 
        }

        const targetSemester = semesters.find(s => 
            s.intakeId === student.intakeId && 
            s.year === Number(paymentSelectedYear) && 
            s.semesterInYear === Number(paymentSelectedSemInYear)
        );

        if (!targetSemester) {
            toast({ variant: 'destructive', title: 'No Semester Record', description: 'The selected Year/Semester does not have an active record for this intake.' });
            return;
        }

        setFormLoading(true);
        try {
            const info = paymentInfos.find(p => p.userId === student.uid && p.semesterId === targetSemester.id);
            const updates: Record<string, any> = {};
            let targetInvoiceId = info?.invoiceId;

            if (!info) {
                const invRef = push(ref(db, `invoices/${student.uid}`));
                targetInvoiceId = invRef.key!;
                updates[`invoices/${student.uid}/${targetInvoiceId}`] = {
                    invoiceId: targetInvoiceId,
                    semester: targetSemester.name,
                    semesterId: targetSemester.id,
                    dateCreated: new Date().toISOString(),
                    totalTuition: 0, totalMandatoryFees: 0, totalOptionalFees: 0
                };
                updates[`registrations/${student.uid}/${targetSemester.id}`] = {
                    status: 'Completed',
                    semesterName: targetSemester.name,
                    registrationDate: new Date().toISOString(),
                    programmeId: student.programmeId || '',
                    intakeId: student.intakeId,
                    invoiceId: targetInvoiceId,
                    courses: []
                };
            }

            const txRef = push(ref(db, 'transactions'));
            const txId = `CASH-${Date.now()}-${txRef.key?.slice(-4)}`;
            updates[`transactions/${txRef.key}`] = {
                transactionId: txId,
                userId: student.uid,
                invoiceId: targetInvoiceId,
                amount: parseFloat(paymentAmount),
                currency: 'ZMW',
                status: 'successful',
                paymentDate: format(dateReceived, 'yyyy-MM-dd'),
                recordedAt: serverTimestamp(),
                method: paymentMethod,
                comment: paymentComment,
                recordedBy: userData?.name || 'Accountant',
            };

            await update(ref(db), updates);
            toast({ variant: 'success', title: "Payment Recorded" });
            setIsRecordPaymentOpen(false);
            resetDialog();
            fetchPaymentData();
        } catch(e: any) { 
            toast({ variant:'destructive', title:'Error', description: e.message }); 
        } finally { 
            setFormLoading(false); 
        }
    };

    const handleRequestAccount = async () => {
        setFormLoading(true);
        try {
            const registrarIds = await getRegistrarIds();
            const newRequestRef = push(ref(db, 'studentCreationRequests'));
            await set(newRequestRef, {
                message: requestMessage,
                subject: requestSubject,
                requestedBy: userData?.name || 'Accountant',
                requestedByUid: user?.uid,
                timestamp: serverTimestamp(),
                status: 'pending'
            });

            if (registrarIds.length > 0) {
                await createNotification(
                    registrarIds, 
                    `New student account request from ${userData?.name || 'Finance'}`,
                    '/admin/admissions/add-student'
                );
            }
            toast({ title: "Request Sent", description: "Admissions has been notified." });
            setIsRequestAccountOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleSendEditRequest = async () => {
        if (!editReason || !newValue || !editStudentInfo) return;
        setFormLoading(true);
        try {
            const newReqRef = push(ref(db, 'paymentEditRequests'));
            await set(newReqRef, {
                type: editRequestType,
                targetId: editTargetId,
                userId: editStudentInfo.userId,
                studentName: editStudentInfo.studentName,
                studentId: editStudentInfo.studentId,
                oldValue,
                newValue: parseFloat(newValue),
                reason: editReason,
                requestedBy: userData?.name || 'Accountant',
                requestedByUid: user?.uid,
                timestamp: serverTimestamp(),
                status: 'pending'
            });
            toast({ title: 'Edit Request Sent', description: 'Administrator has been notified.' });
            setIsEditOpen(false);
            setEditReason(''); setNewValue('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const resetDialog = () => {
        setPaymentSelectedUserId(''); setPaymentSelectedYear(''); setPaymentSelectedSemInYear('');
        setPaymentAmount(''); setPaymentMethod('Cash'); setPaymentComment(''); setDialogSearchTerm(''); setDateReceived(new Date());
    };

    const handleAddBulkRow = () => {
        setBulkEntries(prev => [...prev, { id: `row-${Date.now()}`, studentId: '', amount: '', method: bulkGlobalMethod, date: bulkGlobalDate, studentUid: null, studentName: '', year: bulkGlobalYear, semesterInYear: bulkGlobalSem, comment: '', intakeId: null }]);
    };

    const handleRemoveBulkRow = (index: number) => {
        if (bulkEntries.length <= 1) return;
        setBulkEntries(prev => prev.filter((_, i) => i !== index));
    };

    const handleBulkRowUpdate = (rowId: string, field: string, value: any) => {
        setBulkEntries(prev => prev.map(row => {
            if (row.id === rowId) {
                const updated = { ...row, [field]: value };
                if (field === 'studentId') {
                    const student = allStudents.find(s => s.id === value.trim().toUpperCase());
                    updated.studentUid = student?.uid || null;
                    updated.studentName = student?.name || '';
                    updated.intakeId = student?.intakeId || null;
                }
                return updated;
            }
            return row;
        }));
    };

    const handleApplyGlobalToBulk = () => {
        setBulkEntries(prev => prev.map(row => ({ 
            ...row, 
            method: bulkGlobalMethod, 
            date: bulkGlobalDate,
            year: bulkGlobalYear,
            semesterInYear: bulkGlobalSem
        })));
        toast({ title: "Globals Applied" });
    };

    const handleConfirmBulkManual = async () => {
        const validRows = bulkEntries.filter(row => row.studentUid && row.amount > 0 && row.date && row.year && row.semesterInYear);
        if (validRows.length === 0) {
            toast({ variant: 'destructive', title: 'Missing required fields', description: 'Ensure Student ID (verified), Amount, Date, Year and Sem are set for at least one row.' });
            return;
        }
        setFormLoading(true);
        try {
            const updates: Record<string, any> = {};
            for (const row of validRows) {
                const student = allStudents.find(s => s.uid === row.studentUid)!;
                const targetSemester = semesters.find(s => 
                    s.intakeId === student.intakeId && 
                    s.year === Number(row.year) && 
                    s.semesterInYear === Number(row.semesterInYear)
                );

                if (!targetSemester) continue;

                const info = paymentInfos.find(p => p.userId === student.uid && p.semesterId === targetSemester.id);
                let targetInvoiceId = info?.invoiceId;

                if (!info) {
                    const invRef = push(ref(db, `invoices/${student.uid}`));
                    targetInvoiceId = invRef.key!;
                    updates[`invoices/${student.uid}/${targetInvoiceId}`] = {
                        invoiceId: targetInvoiceId,
                        semester: targetSemester.name,
                        semesterId: targetSemester.id,
                        dateCreated: new Date().toISOString(),
                        totalTuition: 0, totalMandatoryFees: 0, totalOptionalFees: 0
                    };
                    updates[`registrations/${student.uid}/${targetSemester.id}`] = {
                        status: 'Completed',
                        semesterName: targetSemester.name,
                        registrationDate: new Date().toISOString(),
                        programmeId: student.programmeId || '',
                        intakeId: student.intakeId,
                        invoiceId: targetInvoiceId,
                        courses: []
                    };
                }

                const txRef = push(ref(db, 'transactions'));
                updates[`transactions/${txRef.key}`] = {
                    transactionId: `BULK-${Date.now()}-${txRef.key?.slice(-4)}`,
                    userId: row.studentUid,
                    invoiceId: targetInvoiceId,
                    amount: parseFloat(row.amount),
                    status: 'successful',
                    paymentDate: format(row.date, 'yyyy-MM-dd'),
                    recordedAt: serverTimestamp(),
                    method: row.method,
                    comment: row.comment,
                    recordedBy: userData?.name || 'Accountant',
                };
            }
            await update(ref(db), updates);
            toast({ variant: 'success', title: 'Batch Saved', description: `Recorded ${validRows.length} payments.` });
            setIsBulkManualOpen(false);
            setBulkEntries([{ id: `row-${Date.now()}`, studentId: '', amount: '', method: 'Cash', date: new Date(), studentUid: null, studentName: '', year: '', semesterInYear: '', comment: '', intakeId: null }]);
            fetchPaymentData();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Batch failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const filteredData = React.useMemo(() => {
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const intakeMatch = intakeFilter === 'all' || p.intakeId === intakeFilter;
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const amountMatch = !minAmountFilter || p.totalPaid >= parseFloat(minAmountFilter);
            return searchMatch && intakeMatch && programmeMatch && amountMatch;
        });
    }, [paymentInfos, searchTerm, intakeFilter, programmeFilter, minAmountFilter]);

    const revenueStats = React.useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const startOfW = startOfWeek(now);
        const endOfW = endOfWeek(now);
        
        let daily = 0, weekly = 0, semester = 0, allTime = 0;
        
        rawTransactions.forEach(tx => {
            const amt = Number(tx.amount) || 0;
            const pDate = parseISO(tx.paymentDate);
            
            allTime += amt;
            if(isToday(pDate)) daily += amt;
            if(isWithinInterval(pDate, { start: startOfW, end: endOfW })) weekly += amt;
            
            const paymentInfo = paymentInfos.find(p => p.invoiceId === tx.invoiceId);
            if (paymentInfo) {
                const semesterData = semesters.find(s => s.id === paymentInfo.semesterId);
                if (semesterData && semesterData.status !== 'Archived') {
                    // Check if the semester's start date is in the current calendar year
                    const semStartDate = semesterData.startDate ? parseISO(semesterData.startDate) : null;
                    if (semStartDate && semStartDate.getFullYear() === currentYear) {
                        semester += amt;
                    }
                }
            }
        });
        
        return { daily, weekly, semester, allTime };
    }, [rawTransactions, paymentInfos, semesters]);

    const uniqueStudentsForDialog = React.useMemo(() => {
        const lower = dialogSearchTerm.toLowerCase();
        return allStudents.filter(s => s.name.toLowerCase().includes(lower) || s.id.toLowerCase().includes(lower));
    }, [allStudents, dialogSearchTerm]);

    const selectedStudentContext = React.useMemo(() => {
        if (!paymentSelectedUserId || !calendarSettings || !allIntakes.length) return null;
        const student = allStudents.find(s => s.uid === paymentSelectedUserId);
        if (!student || !student.intakeId) return null;

        const intake = allIntakes.find(i => i.id === student.intakeId);
        if (!intake) return null;

        const intakeStartStr = parseIntakeDate(intake.name);
        if (!intakeStartStr) return { intakeName: intake.name, standing: 'Invalid Date' };

        const state = calculateAcademicState(
            intakeStartStr,
            new Date(),
            calendarSettings.standardCycles,
            Object.values(calendarSettings.anomalies || {})
        );
        return { 
            intakeName: intake.name, 
            standing: `Year ${state.year}, Sem ${state.semester}`,
            intakeId: student.intakeId
        };
    }, [paymentSelectedUserId, allStudents, allIntakes, calendarSettings]);

    const selectedPeriodAudit = React.useMemo(() => {
        if (!paymentSelectedUserId || !paymentSelectedYear || !paymentSelectedSemInYear || !selectedStudentContext) return null;
        
        const targetSem = semesters.find(s => 
            s.intakeId === selectedStudentContext.intakeId && 
            s.year === Number(paymentSelectedYear) && 
            s.semesterInYear === Number(paymentSelectedSemInYear)
        );

        if (!targetSem) return { noRecord: true };

        const info = paymentInfos.find(p => p.userId === paymentSelectedUserId && p.semesterId === targetSem.id);
        return {
            semesterName: targetSem.name,
            due: info?.totalDue || 0,
            paid: info?.totalPaid || 0,
            balance: info?.balance || 0,
            exists: !!info
        };
    }, [paymentSelectedUserId, paymentSelectedYear, paymentSelectedSemInYear, selectedStudentContext, semesters, paymentInfos]);

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md"><DollarSign className="h-6 w-6 text-white"/></div>
                        <div><CardTitle className="font-headline text-2xl">Financial Audit Center</CardTitle><CardDescription>Global institutional revenue tracking and compliance monitoring.</CardDescription></div>
                    </div>
                    <Button variant="outline" onClick={() => { setRequestMessage(accountRequestTemplate.body); setRequestSubject(accountRequestTemplate.subject); setIsRequestAccountOpen(true); }} className="h-10 border-primary/20 text-primary hover:bg-primary/10">
                        <UserPlus className="mr-2 h-4 w-4"/> Request New Student Account
                    </Button>
                </CardHeader>
            </Card>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="shadow-sm border-0 bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-wider opacity-60 flex items-center gap-2"><TrendingUp className="h-3 w-3"/> Daily Collection</CardTitle></CardHeader>
                    <CardContent><div className="text-xl font-black text-green-600">ZMW {revenueStats.daily.toFixed(2)}</div></CardContent>
                </Card>
                <Card className="shadow-sm border-0 bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-wider opacity-60 flex items-center gap-2"><Clock className="h-3 w-3"/> Weekly Collection</CardTitle></CardHeader>
                    <CardContent><div className="text-xl font-black">ZMW {revenueStats.weekly.toFixed(2)}</div></CardContent>
                </Card>
                <Card className="shadow-sm border-0 bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-wider opacity-60 flex items-center gap-2"><CalendarDays className="h-3 w-3"/> Semester Total</CardTitle></CardHeader>
                    <CardContent><div className="text-xl font-black text-primary">ZMW {revenueStats.semester.toFixed(2)}</div></CardContent>
                    <CardFooter className="pt-0"><p className="text-[8px] text-muted-foreground uppercase font-bold">Sum of all {new Date().getFullYear()} sessions</p></CardFooter>
                </Card>
                <Card className="shadow-sm border-0 bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-wider opacity-60 flex items-center gap-2"><Wallet className="h-3 w-3"/> All-Time Received</CardTitle></CardHeader>
                    <CardContent><div className="text-xl font-black">ZMW {revenueStats.allTime.toFixed(2)}</div></CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap gap-4">
                <Button onClick={() => setIsRecordPaymentOpen(true)} size="lg" className="shadow-lg h-12 font-bold"><PlusCircle className="mr-2 h-5 w-5"/> Record Single Payment</Button>
                <Button variant="outline" onClick={() => setIsBulkManualOpen(true)} size="lg" className="shadow-lg h-12 font-bold"><PlusCircle className="mr-2 h-5 w-5"/> Batch Manual Entry</Button>
            </div>

            <Card className="shadow-md">
                <CardHeader className="border-b">
                    <div className="flex flex-col gap-4">
                        <div><CardTitle>Financial Audit List</CardTitle><CardDescription>Real-time threshold monitoring and payment compliance.</CardDescription></div>
                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60">Programme</Label>
                                <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                                    <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="All Programmes"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Programmes</SelectItem>
                                        {allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60">Cohort (Intake)</Label>
                                <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                                    <SelectTrigger className="h-10 bg-background"><SelectValue placeholder="All Intakes"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Intakes</SelectItem>
                                        {allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase opacity-60">Paid Amount &ge;</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground opacity-50"/>
                                    <Input 
                                        type="number" 
                                        placeholder="Min ZMW Paid..." 
                                        className="pl-8 h-10 bg-background" 
                                        value={minAmountFilter} 
                                        onChange={e => setMinAmountFilter(e.target.value)} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-1 lg:col-span-2">
                                <Label className="text-[10px] font-black uppercase opacity-60">Search Identity</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input className="pl-8 h-10 bg-background" placeholder="Student ID or Name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {loading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
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
                                                <Badge variant={info.thresholdMet ? "secondary" : "destructive"} className="uppercase text-[9px] gap-1">
                                                    {info.thresholdMet ? <CheckCircle2 className="h-2 w-2"/> : <AlertTriangle className="h-2 w-2"/>}
                                                    {info.thresholdMet ? "Met" : "Below"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => { setEditStudentInfo(info); setEditTargetId(info.invoiceId); setOldValue(info.totalDue); setEditRequestType('invoice'); setIsEditOpen(true); }}><PencilLine className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">No records match the current filter criteria.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Batch Manual Dialog */}
            <Dialog open={isBulkManualOpen} onOpenChange={setIsBulkManualOpen}>
                <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Batch Manual Payment Recording</DialogTitle>
                        <DialogDescription>Record multiple payments against specific year/semester sessions.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4 flex-1 overflow-hidden">
                        <div className="flex flex-wrap items-end gap-4 p-4 border rounded-xl bg-muted/20">
                            <div className="w-40 space-y-1"><Label className="text-[10px] font-black uppercase">Batch Year</Label>
                                <Select value={bulkGlobalYear} onValueChange={setBulkGlobalYear}><SelectTrigger className="h-9"><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="w-40 space-y-1"><Label className="text-[10px] font-black uppercase">Batch Semester</Label>
                                <Select value={bulkGlobalSem} onValueChange={setBulkGlobalSem}><SelectTrigger className="h-9"><SelectValue placeholder="Sem"/></SelectTrigger><SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="w-40 space-y-1"><Label className="text-[10px] font-black uppercase">Batch Method</Label>
                                <Select value={bulkGlobalMethod} onValueChange={setBulkGlobalMethod}><SelectTrigger className="h-9"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Deposit">Bank Deposit</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                            </div>
                            <div className="w-40 space-y-1"><Label className="text-[10px] font-black uppercase">Batch Date</Label>
                                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start h-9 text-xs"><CalendarIcon className="mr-2 h-4 w-4"/>{bulkGlobalDate ? format(bulkGlobalDate, 'dd MMM') : 'Pick Date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={bulkGlobalDate} onSelect={setBulkGlobalDate} initialFocus/></PopoverContent></Popover>
                            </div>
                            <Button variant="secondary" size="sm" className="h-9 font-bold" onClick={handleApplyGlobalToBulk}><Save className="mr-2 h-4 w-4"/> Apply Globals</Button>
                            <Separator orientation="vertical" className="h-9" />
                            <Button variant="outline" size="sm" className="h-9 font-bold" onClick={handleAddBulkRow}><PlusCircle className="mr-2 h-4 w-4"/> Add Entry</Button>
                        </div>
                        <ScrollArea className="flex-1 border rounded-lg shadow-inner bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10"><TableRow><TableHead className="w-32">Student ID</TableHead><TableHead className="w-48">Student</TableHead><TableHead className="w-24">Year</TableHead><TableHead className="w-24">Sem</TableHead><TableHead className="w-32">Amount</TableHead><TableHead className="w-32">Method</TableHead><TableHead className="w-32">Date</TableHead><TableHead>Comment</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {bulkEntries.map((row, index) => (
                                        <TableRow key={row.id} className={cn(!row.studentUid && row.studentId && "bg-red-50")}>
                                            <TableCell><Input value={row.studentId} onChange={e => handleBulkRowUpdate(row.id, 'studentId', e.target.value.toUpperCase())} placeholder="STU-XXX" className="h-8 font-mono text-[10px] uppercase"/></TableCell>
                                            <TableCell>{row.studentUid ? <span className="text-[10px] font-bold truncate block max-w-[150px]">{row.studentName}</span> : <span className="text-[10px] text-muted-foreground italic">Required</span>}</TableCell>
                                            <TableCell>
                                                <Select value={row.year} onValueChange={v => handleBulkRowUpdate(row.id, 'year', v)} disabled={!row.studentUid}>
                                                    <SelectTrigger className="h-8 text-[10px]"><SelectValue/></SelectTrigger>
                                                    <SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select value={row.semesterInYear} onValueChange={v => handleBulkRowUpdate(row.id, 'semesterInYear', v)} disabled={!row.year}>
                                                    <SelectTrigger className="h-8 text-[10px]"><SelectValue/></SelectTrigger>
                                                    <SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell><Input type="number" value={row.amount} onChange={e => handleBulkRowUpdate(row.id, 'amount', e.target.value)} className="h-8 text-[10px]"/></TableCell>
                                            <TableCell>
                                                <Select value={row.method} onValueChange={v => handleBulkRowUpdate(row.id, 'method', v)}><SelectTrigger className="h-8 text-[10px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Deposit">Bank Deposit</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                                            </TableCell>
                                            <TableCell>
                                                <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full h-8 text-[9px] px-2 justify-start font-normal"><CalendarIcon className="mr-1 h-3 w-3"/>{row.date ? format(row.date, 'dd MMM') : 'Set'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={row.date} onSelect={d => handleBulkRowUpdate(row.id, 'date', d)} initialFocus/></PopoverContent></Popover>
                                            </TableCell>
                                            <TableCell><Input value={row.comment} onChange={e => handleBulkRowUpdate(row.id, 'comment', e.target.value)} placeholder="..." className="h-8 text-[10px]"/></TableCell>
                                            <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveBulkRow(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsBulkManualOpen(false)}>Discard</Button>
                        <Button onClick={handleConfirmBulkManual} disabled={formLoading || bulkEntries.length === 0}>
                            {formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                            Post Batch ({bulkEntries.filter(r => r.studentUid && r.amount > 0).length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Request New Account Dialog */}
            <Dialog open={isRequestAccountOpen} onOpenChange={setIsRequestAccountOpen}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle>Request Student Account</DialogTitle>
                                <DialogDescription>Draft a message to Admissions to request a new student account.</DialogDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsTemplateSettingsOpen(!isTemplateSettingsOpen)}><Settings2 className="h-4 w-4"/></Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4 space-y-4">
                        {isTemplateSettingsOpen ? (
                            <div className="p-4 border rounded-lg bg-primary/5 space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 text-primary"><Settings2 className="h-4 w-4"/><span className="text-xs font-bold uppercase">Template Configuration</span></div>
                                <div className="space-y-1"><Label className="text-xs">Default Subject</Label><Input value={accountRequestTemplate.subject} onChange={e => setAccountRequestTemplate(p=>({...p, subject: e.target.value}))}/></div>
                                <div className="space-y-1"><Label className="text-xs">Default Body</Label><Textarea rows={6} value={accountRequestTemplate.body} onChange={e => setAccountRequestTemplate(p=>({...p, body: e.target.value}))}/></div>
                                <Button size="sm" onClick={() => {
                                    set(ref(db, 'settings/templates/studentAccountRequest'), accountRequestTemplate);
                                    toast({ title: 'Template Saved' });
                                    setIsTemplateSettingsOpen(false);
                                }}>Save System Template</Button>
                            </div>
                        ) : null}
                        <div className="space-y-4">
                            <div className="space-y-1"><Label>Subject</Label><Input value={requestSubject} onChange={e => setRequestSubject(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Message Body</Label><Textarea value={requestMessage} onChange={e => setRequestMessage(e.target.value)} rows={12} className="font-mono text-sm" /></div>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsRequestAccountOpen(false)}>Cancel</Button>
                        <Button onClick={handleRequestAccount} disabled={formLoading}><Send className="mr-2 h-4 w-4"/>Send to Admissions</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Request Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Request Financial Adjustment</DialogTitle><DialogDescription>Propose a change to this record. All edits require administrator approval.</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Adjusting {editRequestType}</p>
                            <p className="font-bold text-sm">{editStudentInfo?.studentName} ({editStudentInfo?.studentId})</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-xs">Original Value</Label><div className="h-10 flex items-center px-3 border rounded-md bg-muted text-sm font-bold opacity-60">ZMW {oldValue.toFixed(2)}</div></div>
                            <div className="space-y-1"><Label className="text-xs">Proposed Value</Label><Input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="0.00" /></div>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">Reason for Adjustment</Label><Textarea value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="e.g., Incorrect discount applied, manual error..." /></div>
                    </div>
                    <DialogFooter><Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button onClick={handleSendEditRequest} disabled={formLoading || !editReason || !newValue}>{formLoading ? <Loader2 className="animate-spin h-4 w-4"/> : "Submit for Approval"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Single Record Dialog */}
            <Dialog open={isRecordPaymentOpen} onOpenChange={(o) => { if(!o) { resetDialog(); setIsRecordPaymentOpen(o); } }}>
                <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Record Single Payment</DialogTitle></DialogHeader>
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
                            
                            {paymentSelectedUserId && selectedStudentContext && (
                                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-primary opacity-70">
                                        <span>Student Standing</span>
                                        <User className="h-3 w-3" />
                                    </div>
                                    <p className="text-sm font-black pt-1">{selectedStudentContext.intakeName}</p>
                                    <p className="text-xs font-medium text-muted-foreground">{selectedStudentContext.standing}</p>
                                </div>
                            )}

                            {paymentSelectedUserId && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">2. Target Period</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Select value={paymentSelectedYear} onValueChange={setPaymentSelectedYear}><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent></Select>
                                        <Select value={paymentSelectedSemInYear} onValueChange={setPaymentSelectedSemInYear} disabled={!paymentSelectedYear}><SelectTrigger><SelectValue placeholder="Sem"/></SelectTrigger><SelectContent>{[1,2,3].map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                            )}

                            {/* Semester Audit Context */}
                            {paymentSelectedUserId && paymentSelectedYear && paymentSelectedSemInYear && (
                                <div className="p-4 rounded-xl border bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Semester Audit</Label>
                                        <Badge variant="outline" className="text-[8px] h-4 uppercase">{selectedPeriodAudit?.semesterName || 'Target period'}</Badge>
                                    </div>
                                    
                                    {selectedPeriodAudit?.noRecord ? (
                                        <div className="text-xs text-muted-foreground italic py-2 flex items-center gap-2">
                                            <Info className="h-3 w-3"/>
                                            No existing invoice found. A new one will be created on save.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none">Total Due</p>
                                                <p className="text-sm font-black text-foreground">ZMW {selectedPeriodAudit?.due.toFixed(2)}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-green-600 uppercase leading-none">Paid To Date</p>
                                                <p className="text-sm font-black text-green-600">ZMW {selectedPeriodAudit?.paid.toFixed(2)}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-destructive uppercase leading-none">Remaining</p>
                                                <p className="text-sm font-black text-destructive">ZMW {selectedPeriodAudit?.balance.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    )}
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
                            
                            <Alert className="bg-muted/50 border-0">
                                <Clock className="h-4 w-4" />
                                <AlertTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Audit Notice</AlertTitle>
                                <AlertDescription className="text-[10px] italic leading-tight">
                                    The "Date Recorded" timestamp is automatically set by the institutional server clock to maintain a secure and tamper-proof audit trail.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setIsRecordPaymentOpen(false)}>Cancel</Button>
                        <Button onClick={handleRecordPaymentDialog} disabled={!paymentAmount || !paymentSelectedYear || !paymentSelectedSemInYear || formLoading}>
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <Save className="mr-2 h-4 w-4 mr-2"/>} Record Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
