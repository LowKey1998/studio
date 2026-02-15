
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download, DollarSign, PlusCircle, Users, PiggyBank, Scale, Trash2, ChevronsUpDown, Link as LinkIcon, Info, X, History, Mail, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, update, push, set, remove, onValue } from 'firebase/database';
import { format, parseISO } from 'date-fns';
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
    academicStanding?: string;
};

type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
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
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    const [serverTimeOffset, setServerTimeOffset] = React.useState(0);
    
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');

    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);

    const [isLinkingOpen, setIsLinkingOpen] = React.useState(false);
    const [linkingPayment, setLinkingPayment] = React.useState<UnlinkedPayment | null>(null);
    const [selectedLinkStudent, setSelectedLinkStudent] = React.useState('');

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
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, unlinkedSnap, intakesSnap, calendarSnap, invoicesSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'unlinkedPayments')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'invoices'))
            ]);
            
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id]})));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (calendarSnap.exists()) setCalendarSettings(calendarSnap.val());

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
            
            const studentPaymentMap: Record<string, StudentPaymentInfo> = {};

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

                        studentPaymentMap[key] = {
                            userId,
                            studentId: users[userId].id,
                            studentName: users[userId].name,
                            totalDue: totalPayable,
                            totalPaid: 0,
                            balance: totalPayable,
                            programmeId: reg.programmeId,
                            intakeId: semesterInfo.intakeId || null,
                            semesterId,
                            invoiceId: reg.invoiceId,
                            status: 'Pending'
                        };
                    }
                 }
            }

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
                    semesterName: semesterInfo?.name,
                    academicStanding: semesterInfo ? `Y${semesterInfo.year}S${semesterInfo.semesterInYear}` : undefined
                });

                if (semesterId) {
                    const key = `${userId}-${semesterId}`;
                    if (studentPaymentMap[key]) {
                        studentPaymentMap[key].totalPaid += Number(tx.amount) || 0;
                        studentPaymentMap[key].balance = Math.max(0, studentPaymentMap[key].totalDue - studentPaymentMap[key].totalPaid);
                        if (studentPaymentMap[key].balance <= 0.01) {
                            studentPaymentMap[key].status = 'Paid';
                        }
                    }
                }
            }
            setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));
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

    const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: any) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key !== key) return row;
            const newRow = { ...row, [field]: value };

            if (field === 'userId' || field === 'semesterId') {
                if (field === 'userId') {
                    newRow.semesterId = undefined;
                    newRow.totalDue = undefined;
                    newRow.invoiceId = undefined;
                    newRow.totalPaid = undefined;

                    if (value === '__UNLINKED__') {
                        newRow.isUnlinked = true;
                        newRow.userId = undefined;
                    } else {
                        newRow.isUnlinked = false;
                        const student = allStudents.find(s => s.uid === value);
                        if (student?.intakeId && calendarSettings) {
                            const intake = allIntakes.find(i => i.id === student.intakeId);
                            const intakeStartStr = intake ? parseIntakeDate(intake.name) : null;
                            if (intakeStartStr) {
                                const state = calculateAcademicState(
                                    intakeStartStr,
                                    getCurrentServerDate(),
                                    calendarSettings.standardCycles,
                                    Object.values(calendarSettings.anomalies || {})
                                );
                                const matchedSemester = semesters.find(s => s.intakeId === student.intakeId && s.year === state.year && s.semesterInYear === state.semester);
                                if (matchedSemester) {
                                    newRow.semesterId = matchedSemester.id;
                                }
                            }
                        }
                    }
                }

                if (!newRow.isUnlinked && newRow.userId && newRow.semesterId) {
                    const info = paymentInfos.find(p => p.userId === newRow.userId && p.semesterId === newRow.semesterId);
                    if (info) {
                        newRow.totalDue = info.totalDue.toFixed(2);
                        newRow.totalPaid = info.totalPaid;
                        newRow.invoiceId = info.invoiceId;
                    }
                } 
            }
            return newRow;
        }));
    };
    
    const handleSaveBulkPayments = async () => {
        const paymentsToRecord = bulkPaymentRows.filter(p => parseFloat(p.amount) > 0 && p.semesterId && ((p.isUnlinked && p.reference) || (!p.isUnlinked && p.userId)));
        
        if(paymentsToRecord.length === 0) {
            toast({ variant: 'destructive', title: 'No valid payments entered.', description: 'Each row requires a student/ref, a semester, and an amount.'});
            return;
        }
        
        setFormLoading(true);
        const updates: Record<string, any> = {};
        const notifications: { userId: string, message: string }[] = [];

        try {
            for (const paymentRecord of paymentsToRecord) {
                const now = new Date().toISOString();
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

                    notifications.push({
                        userId,
                        message: `A manual payment of ZMW ${amountFloat.toFixed(2)} was recorded for your ${semesterInfo.name} account.`
                    });
                }
            }
            
            await update(ref(db), updates);
            
            toast({ variant: 'success', title: "Payments Recorded", description: `Successfully processed ${paymentsToRecord.length} records.` });
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
            
            // Handle notifications in background
            notifications.forEach(n => {
                createNotification(n.userId, n.message, '/student/payments').catch(() => {});
            });

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
                    dateCreated: new Date().toISOString(),
                    semesterId: linkingPayment.semesterId
                };
                updates[`registrations/${selectedLinkStudent}/${linkingPayment.semesterId}/invoiceId`] = invoiceId;
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
                comment: `Linked to account. Original Reference: ${linkingPayment.reference}`
            };

            updates[`unlinkedPayments/${linkingPayment.id}`] = null;

            await update(ref(db), updates);
            
            toast({ variant: 'success', title: 'Payment Linked' });
            
            createNotification(selectedLinkStudent, `A previous deposit of ZMW ${linkingPayment.amount.toFixed(2)} was successfully linked to your account.`, '/student/payments').catch(() => {});
            
            await fetchPaymentData();
            setIsLinkingOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Linking Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };
    
    const filteredData = React.useMemo(() => {
        return paymentInfos.filter(p => {
            const searchMatch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                p.studentId.toLowerCase().includes(searchTerm.toLowerCase());
            const programmeMatch = programmeFilter === 'all' || p.programmeId === programmeFilter;
            const semesterMatch = semesterFilter === 'all' || p.semesterId === semesterFilter;
            return searchMatch && programmeMatch && semesterMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter]);

    const summaryStats = React.useMemo(() => {
        return filteredData.reduce((acc, p) => {
            acc.totalDue += Number(p.totalDue) || 0;
            acc.totalPaid += Number(p.totalPaid) || 0;
            acc.totalBalance += Number(p.balance) || 0;
            return acc;
        }, { totalDue: 0, totalPaid: 0, totalBalance: 0 });
    }, [filteredData]);
    
    const handleExport = () => {
        const doc = new jsPDF();
        const head = [["ID", "Name", "Semester", "Due", "Paid", "Balance", "Status"]];
        const body = filteredData.map(p => [
            p.studentId,
            p.studentName,
            semesters.find(s => s.id === p.semesterId)?.name || 'N/A',
            p.totalDue.toFixed(2),
            p.totalPaid.toFixed(2),
            p.balance.toFixed(2),
            p.status
        ]);
        doc.text("Payments Report", 14, 22);
        autoTable(doc, { head, body, startY: 30 });
        doc.save(`payments_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const handleRemovePaymentRow = (key: number) => {
        setBulkPaymentRows(prev => prev.filter(r => r.key !== key));
    };

    const studentOptions = [
        { groupName: 'System Actions', items: [{ value: '__UNLINKED__', label: 'Student Not Found / Unlinked Payment' }] },
        { groupName: 'Students', items: allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` })) }
    ];

    const statusVariant: { [key in StudentPaymentInfo['status']]: 'destructive' | 'secondary' | 'default' } = {
        Paid: 'default',
        Pending: 'secondary',
        Overdue: 'destructive',
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div>
                        <CardTitle className="font-headline text-2xl">Financial Overview</CardTitle>
                        <CardDescription>Monitor student payments, balances, and record transactions.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                         <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Total Due</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">ZMW {summaryStats.totalDue.toFixed(2)}</div></CardContent></Card>
                         <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Total Paid</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">ZMW {summaryStats.totalPaid.toFixed(2)}</div></CardContent></Card>
                         <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Total Balance</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">ZMW {summaryStats.totalBalance.toFixed(2)}</div></CardContent></Card>
                         <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Students</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{filteredData.length}</div></CardContent></Card>
                    </div>

                    <div className="flex flex-wrap gap-4 mb-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <Label>Search</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="w-48"><Label>Programme</Label><Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="w-48"><Label>Semester</Label><Select value={semesterFilter} onValueChange={setSemesterFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export</Button>
                            <Dialog open={isBulkRecordOpen} onOpenChange={(open) => { if(!open) setBulkPaymentRows([]); setIsBulkRecordOpen(open); }}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Record Payments</Button></DialogTrigger>
                                <DialogContent className="max-w-[95vw] md:max-w-6xl h-[90vh] flex flex-col">
                                    <DialogHeader><DialogTitle>Record Manual Payments</DialogTitle><DialogDescription>Select students or record unlinked deposits.</DialogDescription></DialogHeader>
                                    <div className="flex-1 overflow-auto border rounded-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead className="w-[300px]">Student / Ref</TableHead>
                                                    <TableHead className="w-[200px]">Semester</TableHead>
                                                    <TableHead className="w-[150px]">Total Due</TableHead>
                                                    <TableHead className="w-[150px]">Amount Paid</TableHead>
                                                    <TableHead className="w-[150px]">Balance After</TableHead>
                                                    <TableHead>Comment</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {bulkPaymentRows.map((row) => {
                                                    const amountPaid = parseFloat(row.amount || '0');
                                                    const totalDueVal = parseFloat(row.totalDue || '0');
                                                    const newBalance = totalDueVal - (row.totalPaid || 0) - amountPaid;
                                                    const semesterOptions: OptionGroup[] = [{ 
                                                        groupName: 'Available', 
                                                        items: semesters.filter(s => !row.userId || allStudents.find(st => st.uid === row.userId)?.intakeId === s.intakeId).map(s => ({ value: s.id, label: s.name })) 
                                                    }];
                                                    return (
                                                    <TableRow key={row.key}>
                                                        <TableCell>
                                                            <SearchableSelect 
                                                                value={row.userId || (row.isUnlinked ? '__UNLINKED__' : undefined)} 
                                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'userId', val)} 
                                                                options={studentOptions} 
                                                                placeholder="Select student..." 
                                                            />
                                                            {row.isUnlinked && <Input placeholder="Reference (e.g. Bank slip #)" value={row.reference || ''} onChange={(e) => handleBulkPaymentRowChange(row.key, 'reference', e.target.value)} className="mt-2 text-xs h-8" />}
                                                        </TableCell>
                                                        <TableCell>
                                                            <SearchableSelect 
                                                                value={row.semesterId} 
                                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'semesterId', val)} 
                                                                options={semesterOptions} 
                                                                placeholder="Select semester..." 
                                                                disabled={!row.userId && !row.isUnlinked} 
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <Input type="number" value={row.totalDue ?? ''} onChange={(e) => handleBulkPaymentRowChange(row.key, 'totalDue', e.target.value)} disabled={formLoading || (row.totalPaid !== undefined && row.totalPaid > 0)} className="h-8 text-xs" />
                                                                {row.totalPaid !== undefined && row.totalPaid > 0 && <p className="text-[10px] text-muted-foreground italic">Already Paid: {row.totalPaid.toFixed(2)}</p>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell><Input type="number" value={row.amount} onChange={(e) => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} disabled={!row.semesterId} className="h-8 text-xs font-bold" /></TableCell>
                                                        <TableCell className={cn("font-bold text-xs", newBalance <= 0.01 ? "text-green-600" : "text-destructive")}>{newBalance.toFixed(2)}</TableCell>
                                                        <TableCell><Input value={row.comment} onChange={(e) => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} className="h-8 text-xs" /></TableCell>
                                                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemovePaymentRow(row.key)} className="h-8 w-8"><Trash2 className="h-4 w-4"/></Button></TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="py-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => setBulkPaymentRows(p => [...p, { key: Date.now(), amount: '', comment: '' }])}><PlusCircle className="mr-2 h-4 w-4"/>Add Payment Row</Button></div>
                                    <DialogFooter className="border-t pt-4">
                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                        <Button onClick={handleSaveBulkPayments} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Record {bulkPaymentRows.length} Payments</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                     </div>
                     <Tabs defaultValue="studentPayments">
                        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="studentPayments">Students</TabsTrigger><TabsTrigger value="unlinkedPayments">Unlinked ({unlinkedPayments.length})</TabsTrigger><TabsTrigger value="transactionHistory">Recent History</TabsTrigger></TabsList>
                        <TabsContent value="studentPayments">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Active Standing</TableHead>
                                        <TableHead className="text-right">Total Due</TableHead>
                                        <TableHead className="text-right">Total Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((p, i) => (
                                        <TableRow key={`${p.userId}-${i}`} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setHistoryStudent(p); setIsHistoryOpen(true); }}>
                                            <TableCell className="font-mono text-xs">{p.studentId}</TableCell>
                                            <TableCell className="font-medium">{p.studentName}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-[10px] bg-background">{semesters.find(s=>s.id===p.semesterId)?.name}</Badge></TableCell>
                                            <TableCell className="text-right text-xs">ZMW {p.totalDue.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-green-600 text-xs font-bold">ZMW {p.totalPaid.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-black text-xs">ZMW {p.balance.toFixed(2)}</TableCell>
                                            <TableCell><Badge variant={statusVariant[p.status]} className="h-5 text-[10px]">{p.status}</Badge></TableCell>
                                            <TableCell onClick={e=>e.stopPropagation()}><Button variant="ghost" size="icon" onClick={() => { setHistoryStudent(p); setIsHistoryOpen(true); }} className="h-8 w-8"><History className="h-4 w-4 text-muted-foreground"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TabsContent>
                         <TabsContent value="unlinkedPayments">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unlinkedPayments.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="text-xs">{format(parseISO(p.date), 'PPP')}</TableCell>
                                            <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                                            <TableCell className="text-right font-bold text-xs">ZMW {p.amount.toFixed(2)}</TableCell>
                                            <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setLinkingPayment(p); setIsLinkingOpen(true); }}>Link to Student</Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                         </TabsContent>
                         <TabsContent value="transactionHistory">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Standing</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rawTransactions.map(tx => (
                                        <TableRow key={tx.key}>
                                            <TableCell className="text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="sm font-medium">{allStudents.find(s=>s.uid===tx.userId)?.name}</TableCell>
                                            <TableCell><Badge variant="secondary" className="text-[9px]">{tx.academicStanding}</Badge></TableCell>
                                            <TableCell className="font-bold text-green-600 text-xs">ZMW {tx.amount.toFixed(2)}</TableCell>
                                            <TableCell className="text-[10px] font-bold uppercase text-muted-foreground">{tx.method}</TableCell>
                                            <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => {if(confirm("Permanently delete this transaction record?")) remove(ref(db, `transactions/${tx.key}`));}} className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isLinkingOpen} onOpenChange={setIsLinkingOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Link Unlinked Payment</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg border space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase">Reference</p>
                            <p className="font-mono">{linkingPayment?.reference}</p>
                            <Separator className="my-2"/>
                            <p className="text-xs font-bold text-muted-foreground uppercase">Amount</p>
                            <p className="text-xl font-black text-green-600">ZMW {linkingPayment?.amount.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                            <Label>Target Student</Label>
                            <SearchableSelect 
                                value={selectedLinkStudent} 
                                onValueChange={setSelectedLinkStudent} 
                                options={[{ groupName: 'Students', items: allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` })) }]} 
                                placeholder="Search and select student..." 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleLinkPayment} disabled={formLoading || !selectedLinkStudent}>Confirm & Link</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
                    <DialogHeader><DialogTitle>Financial Ledger: {historyStudent?.studentName}</DialogTitle><DialogDescription>Detailed transaction history for all semesters.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-auto py-4 border rounded-md my-4">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Academic Standing</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rawTransactions.filter(t => t.userId === historyStudent?.userId).map(tx => (
                                    <TableRow key={tx.key} className="hover:bg-transparent">
                                        <TableCell className="text-xs">{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold">{tx.semesterName}</span>
                                                <span className="text-[10px] text-muted-foreground">{tx.academicStanding}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] font-bold uppercase">{tx.method}</TableCell>
                                        <TableCell className="text-right font-black text-green-600 text-sm">ZMW {tx.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row justify-between w-full gap-2">
                        <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Close Ledger</Button>
                        <Button onClick={() => { if(historyStudent) { setBulkPaymentRows([{ key: Date.now(), userId: historyStudent.userId, semesterId: historyStudent.semesterId || undefined, invoiceId: historyStudent.invoiceId, totalDue: historyStudent.totalDue.toFixed(2), totalPaid: historyStudent.totalPaid, amount: '', comment: '' }]); setIsHistoryOpen(false); setIsBulkRecordOpen(true); } }} className="shadow-lg">
                            <PlusCircle className="mr-2 h-4 w-4" /> Record New Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
