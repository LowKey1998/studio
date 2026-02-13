'use client';
import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download, DollarSign, PlusCircle, Users, PiggyBank, Scale, Trash2, ChevronsUpDown, Link as LinkIcon, Info, X, History, Mail, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth, createNotification, getRegistrarIds } from '@/lib/firebase';
import { ref, get, update, push, set, remove, onValue } from 'firebase/database';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase';
import { sendEmail } from '@/ai/flows/send-email-flow';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { cn } from '@/lib/utils';

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
    year: number | null;
    semesterInYear: number | null;
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

type Course = {
    id: string;
    name: string;
    code: string;
    cost: number;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; mandatoryFees?: Record<string, any>; optionalFees?: Record<string, any>; };
type StudentInfo = {
    uid: string;
    id: string;
    name: string;
    email: string;
    intakeId?: string;
};

type Invoice = {
    invoiceId: string;
    totalTuition: number;
    totalMandatoryFees: number;
    totalOptionalFees: number;
    lateFee?: number;
    paymentPlan: string;
    dateCreated: string;
    semester: string;
    semesterId: string;
    courses: string[];
    optionalFees: string[];
    applyScholarship?: boolean;
};

type GroupedOption = { value: string; label: string };
type OptionGroup = { groupName: string; items: GroupedOption[] };

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
        const result: OptionGroup[] = [];
        options.forEach(group => {
            if (group.groupName.toLowerCase().includes(lowerCaseSearch)) {
                result.push(group);
            } else {
                const filteredItems = group.items.filter(item => 
                    item.label.toLowerCase().includes(lowerCaseSearch)
                );
                if (filteredItems.length > 0) {
                    result.push({ ...group, items: filteredItems });
                }
            }
        });
        return result;
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
                            {group.groupName !== 'default' && group.groupName !== 'System Actions' && <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.groupName}</div>}
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
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [allCourses, setAllCourses] = React.useState<Record<string, Course>>({});
    const [institutionSettings, setInstitutionSettings] = React.useState({ name: 'Edutrack360', logoUrl: '' });
    const [calendarSettings, setCalendarSettings] = React.useState<any>(null);
    
    const [isQuickBooksEnabled, setIsQuickBooksEnabled] = React.useState(false);
    const [isSageEnabled, setIsSageEnabled] = React.useState(false);

    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');

    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [historyStudent, setHistoryStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [formLoading, setFormLoading] = React.useState(false);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);

    const [isLinkingOpen, setIsLinkingOpen] = React.useState(false);
    const [linkingPayment, setLinkingPayment] = React.useState<UnlinkedPayment | null>(null);
    const [selectedLinkStudent, setSelectedLinkStudent] = React.useState('');

    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<any>(null);

    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, settingsSnap, unlinkedSnap, intakesSnap, coursesSnap, institutionSnap, calendarSnap, invoicesSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'settings/integrations')),
                get(ref(db, 'unlinkedPayments')),
                get(ref(db, 'intakes')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/institution')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'invoices'))
            ]);
            
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id]})));
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] })));
            if (coursesSnap.exists()) setAllCourses(coursesSnap.val());
            if (institutionSnap.exists()) setInstitutionSettings(institutionSnap.val());
            if (calendarSnap.exists()) setCalendarSettings(calendarSnap.val());

            if (unlinkedSnap.exists()) {
                setUnlinkedPayments(Object.entries(unlinkedSnap.val()).map(([id, data]) => ({ id, ...(data as any) })));
            } else {
                setUnlinkedPayments([]);
            }
            if (settingsSnap.exists()) {
                const integrations = settingsSnap.val();
                setIsQuickBooksEnabled(integrations.quickbooks?.enabled && integrations.quickbooks?.syncInvoices);
                setIsSageEnabled(integrations.sage?.enabled);
            }

            const users = usersSnap.val() || {};
            const allInvoices = invoicesSnap.val() || {};
            const studentList: StudentInfo[] = [];
            for (const uid in users) {
                if (users[uid].role === 'Student') {
                    studentList.push({ uid: uid, id: users[uid].id, name: users[uid].name, email: users[uid].email, intakeId: users[uid].intakeId });
                }
            }
            setAllStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));

            const registrations = regsSnap.exists() ? regsSnap.val() : {};
            const transactionsData = transactionsSnap.exists() ? transactionsSnap.val() : {};
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
                            userId: userId,
                            studentId: users[userId].id,
                            studentName: users[userId].name,
                            totalDue: totalPayable,
                            totalPaid: 0,
                            balance: totalPayable,
                            programmeId: reg.programmeId,
                            intakeId: semesterInfo.intakeId || null,
                            year: semesterInfo.year || null,
                            semesterInYear: semesterInfo.semesterInYear || null,
                            semesterId: semesterId,
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
                        if (studentPaymentMap[key].balance <= 0.01) studentPaymentMap[key].status = 'Paid';
                    }
                }
            }
            setRawTransactions(transactionsList.sort((a,b) => parseISO(b.paymentDate).getTime() - parseISO(a.paymentDate).getTime()));
            setPaymentInfos(Object.values(studentPaymentMap));

        } catch (error: any) {
            console.error("Error fetching payment data:", error);
            toast({ variant: 'destructive', title: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, (snapshot) => {
                    if (snapshot.exists()) {
                        setUserData(snapshot.val());
                    }
                });
            }
        });
        fetchPaymentData();
        return () => unsubscribe();
    }, [fetchPaymentData]);

    const handleAddPaymentRow = () => {
        setBulkPaymentRows(prev => [...prev, { key: Date.now(), amount: '', comment: '' }]);
    };
    
    const handleRemovePaymentRow = (key: number) => {
        setBulkPaymentRows(prev => prev.filter(row => row.key !== key));
    };

     const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: any) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key !== key) return row;
    
            const newRow = { ...row, [field]: value };
            
            // Only re-calculate logic when triggers change to avoid resetting manual input in Total Due
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
                                const state = calculateAcademicState(intakeStartStr, new Date(), calendarSettings.standardCycles, Object.values(calendarSettings.anomalies || {}));
                                const matchedSemester = semesters.find(s => s.intakeId === student.intakeId && s.year === state.year && s.semesterInYear === state.semester);
                                if (matchedSemester) newRow.semesterId = matchedSemester.id;
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
                    } else {
                        newRow.totalDue = '';
                        newRow.totalPaid = 0;
                        newRow.invoiceId = undefined;
                    }
                } 
            }
    
            return newRow;
        }));
    };
    
    const handleSaveBulkPayments = async () => {
        setFormLoading(true);
        const paymentsToRecord = bulkPaymentRows.filter(p => 
            parseFloat(p.amount) > 0 && 
            p.semesterId &&
            ((p.isUnlinked && p.reference) || (!p.isUnlinked && p.userId))
        );

        if(paymentsToRecord.length === 0) {
            toast({ variant: 'destructive', title: 'No valid payments entered.'});
            setFormLoading(false);
            return;
        }

        try {
            for (const paymentRecord of paymentsToRecord) {
                if (paymentRecord.isUnlinked) {
                    const { reference, semesterId, amount, comment, totalDue } = paymentRecord;
                    const newUnlinkedRef = push(ref(db, 'unlinkedPayments'));
                    await set(newUnlinkedRef, {
                        reference,
                        semesterId,
                        amount: parseFloat(amount),
                        comment,
                        totalDue: parseFloat(String(totalDue)) || 0,
                        date: new Date().toISOString()
                    });
                } else {
                    let { userId, invoiceId, semesterId, amount, comment, totalDue } = paymentRecord;
                    if (!userId || !semesterId) continue;
                    
                    const studentInfo = allStudents.find(s => s.uid === userId);
                    const semesterInfo = semesters.find(s => s.id === semesterId);
                    if (!studentInfo || !semesterInfo) continue;
                    
                    if (!invoiceId) {
                        const newInvoiceRef = push(ref(db, `invoices/${userId}`));
                        invoiceId = newInvoiceRef.key!;
                        await set(newInvoiceRef, {
                            invoiceId,
                            totalTuition: parseFloat(String(totalDue)) || 0,
                            totalMandatoryFees: 0,
                            totalOptionalFees: 0,
                            dateCreated: new Date().toISOString(),
                            semester: semesterInfo.name,
                            semesterId: semesterInfo.id,
                            courses: [],
                            optionalFees: [],
                        });
                        await update(ref(db, `registrations/${userId}/${semesterId}`), { invoiceId });
                    }
                    
                    const txRef = push(ref(db, 'transactions'));
                    await set(txRef, {
                        transactionId: `MANUAL-${Date.now()}`, 
                        userId, 
                        invoiceId, 
                        amount: parseFloat(amount), 
                        currency: 'ZMW', 
                        status: 'successful', 
                        paymentDate: new Date().toISOString(), 
                        method: 'Manual', 
                        comment
                    });
                    
                    await createNotification(userId, `A manual payment of ZMW ${parseFloat(amount).toFixed(2)} was recorded.`, '/student/payments');
                }
            }
            
            toast({ title: "Payments Recorded", description: `${paymentsToRecord.length} payment(s) saved successfully.` });
            await fetchPaymentData();
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
        } catch (e: any) {
            toast({ 
                variant: 'destructive', 
                title: 'Error Recording Payment', 
                description: e.message || 'An unexpected error occurred while saving to the database.' 
            });
        } finally {
            setFormLoading(false);
        }
    }
    
    const handleLinkPayment = async () => {
        if (!linkingPayment || !selectedLinkStudent || !linkingPayment.semesterId) {
            toast({ variant: 'destructive', title: 'Selection required.'});
            return;
        }
        const selectedLinkSemester = linkingPayment.semesterId;

        setFormLoading(true);
        try {
            let invoiceId = paymentInfos.find(p => p.userId === selectedLinkStudent && p.semesterId === selectedLinkSemester)?.invoiceId;
            const studentInfo = allStudents.find(s => s.uid === selectedLinkStudent);
            
            if (!invoiceId && studentInfo) {
                const newInvoiceRef = push(ref(db, `invoices/${selectedLinkStudent}`));
                invoiceId = newInvoiceRef.key!;
                 await set(newInvoiceRef, { invoiceId, totalTuition: (linkingPayment as any).totalDue || linkingPayment.amount, dateCreated: new Date().toISOString(), semesterId: selectedLinkSemester });
                 await update(ref(db, `registrations/${selectedLinkStudent}/${selectedLinkSemester}`), { invoiceId });
            }
            if(!invoiceId || !studentInfo) throw new Error("Could not link to registration. Ensure student has an active path for this semester.");

            const txRef = push(ref(db, 'transactions'));
            await set(txRef, {
                transactionId: `LINKED-${linkingPayment.id}`, 
                userId: selectedLinkStudent, 
                invoiceId: invoiceId, 
                amount: linkingPayment.amount, 
                currency: 'ZMW', 
                status: 'successful', 
                paymentDate: linkingPayment.date, 
                method: 'Manual (Linked)', 
                comment: `Linked. Original Ref: ${linkingPayment.reference}`
            });

            await remove(ref(db, `unlinkedPayments/${linkingPayment.id}`));
            await createNotification(selectedLinkStudent, `A payment of ZMW ${linkingPayment.amount.toFixed(2)} was linked to your account.`, '/student/payments');
            
            toast({ title: 'Payment Linked!' });
            await fetchPaymentData();
            setIsLinkingOpen(false);
        } catch (e:any) {
            toast({ variant: 'destructive', title: 'Linking Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleDeleteTransaction = async (txKey: string) => {
        if(!window.confirm("Delete this payment? This cannot be undone.")) return;
        setActionLoading(txKey);
        try {
            await remove(ref(db, `transactions/${txKey}`));
            toast({ title: "Payment Deleted" });
            fetchPaymentData();
        } catch(e: any) {
            toast({ variant: 'destructive', title: "Delete Failed", description: e.message });
        } finally {
            setActionLoading(null);
        }
    }

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
        const tableColumn = ["ID", "Name", "Programme", "Semester", "Due", "Paid", "Balance", "Status"];
        const tableRows: (string | number)[][] = filteredData.map(p => {
            const programmeName = programmes.find(prog => prog.id === p.programmeId)?.name || 'N/A';
            const semesterName = semesters.find(sem => sem.id === p.semesterId)?.name || 'N/A';
            return [ p.studentId, p.studentName, programmeName, semesterName, p.totalDue.toFixed(2), p.totalPaid.toFixed(2), p.balance.toFixed(2), p.status ];
        });

        doc.setFontSize(18); doc.text("Payments Report", 14, 22);
        autoTable(doc, { head: [tableColumn], body: tableRows, startY: 30 });
        doc.save(`payments_report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleOpenHistory = (p: StudentPaymentInfo) => {
        setHistoryStudent(p);
        setIsHistoryOpen(true);
    };

    const statusVariant: { [key in StudentPaymentInfo['status']]: 'destructive' | 'secondary' | 'default' } = {
        Paid: 'default', Pending: 'secondary', Overdue: 'destructive'
    };

    const studentOptions = [
        { groupName: 'System Actions', items: [{ value: '__UNLINKED__', label: 'Student Not Found / Unlinked Payment' }] },
        { groupName: 'Students', items: allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` })) }
    ];

    if (loading) return <div className="p-6"><Skeleton className="h-screen w-full" /></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                 <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                     <div>
                        <CardTitle className="font-headline text-2xl">Financial Overview</CardTitle>
                        <CardDescription>Monitor student payments, balances, and record transactions.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                         <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Due</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">ZMW {summaryStats.totalDue.toFixed(2)}</div></CardContent></Card>
                         <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Paid</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">ZMW {summaryStats.totalPaid.toFixed(2)}</div></CardContent></Card>
                         <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Balance</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">ZMW {summaryStats.totalBalance.toFixed(2)}</div></CardContent></Card>
                         <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Students</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{filteredData.length}</div></CardContent></Card>
                    </div>

                    <div className="flex flex-wrap gap-4 mb-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <Label htmlFor="search">Search Student</Label>
                            <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="search" placeholder="Search by name or student ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        </div>
                        <div className="flex-1 min-w-[200px]"><Label htmlFor="programme-filter">Filter by Programme</Label><Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger id="programme-filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex-1 min-w-[200px]"><Label htmlFor="semester-filter">Filter by Semester</Label><Select value={semesterFilter} onValueChange={setSemesterFilter}><SelectTrigger id="semester-filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Semesters</SelectItem>{semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                            <Dialog open={isBulkRecordOpen} onOpenChange={(open) => { if(!open) setBulkPaymentRows([]); setIsBulkRecordOpen(open); }}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Record Payments</Button></DialogTrigger>
                                <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
                                    <DialogHeader><DialogTitle>Record Bulk Manual Payments</DialogTitle><DialogDescription>Add rows and select students to record payments.</DialogDescription></DialogHeader>
                                    <div className="flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[250px]">Student / Reference</TableHead>
                                                    <TableHead className="w-[250px]">Payment for Semester</TableHead>
                                                    <TableHead className="w-[180px]">Total Due</TableHead>
                                                    <TableHead className="w-[150px]">Amount Paid</TableHead>
                                                    <TableHead>New Balance</TableHead>
                                                    <TableHead className="w-[200px]">Comment</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {bulkPaymentRows.map((row) => {
                                                    const amountPaid = parseFloat(row.amount || '0');
                                                    const totalDueForCalc = parseFloat(row.totalDue || '0');
                                                    const totalPaidSoFar = row.totalPaid || 0;
                                                    const newBalance = totalDueForCalc - totalPaidSoFar - amountPaid;
                                                    const studentForThisRow = allStudents.find(s => s.uid === row.userId);
                                                    
                                                    const semesterOptions: OptionGroup[] = [];
                                                    if (row.isUnlinked) {
                                                        const groupedByIntake: Record<string, Semester[]> = semesters.reduce((acc, sem) => {
                                                            const intakeName = allIntakes.find(i => i.id === sem.intakeId)?.name || 'Uncategorized';
                                                            if (!acc[intakeName]) acc[intakeName] = [];
                                                            acc[intakeName].push(sem);
                                                            return acc;
                                                        }, {} as Record<string, Semester[]>);

                                                        Object.entries(groupedByIntake).forEach(([intakeName, sems]) => {
                                                            semesterOptions.push({
                                                                groupName: intakeName,
                                                                items: sems.map(s => ({ value: s.id, label: `Year ${s.year}, Semester ${s.semesterInYear}` }))
                                                            });
                                                        });
                                                    } else if (studentForThisRow?.intakeId) {
                                                        const intakeName = allIntakes.find(i => i.id === studentForThisRow.intakeId)?.name || 'Available Semesters';
                                                        semesterOptions.push({
                                                            groupName: intakeName,
                                                            items: semesters
                                                                .filter(s => s.intakeId === studentForThisRow.intakeId)
                                                                .map(s => ({ value: s.id, label: `Year ${s.year}, Semester ${s.semesterInYear}` }))
                                                        });
                                                    }

                                                    return (
                                                    <TableRow key={row.key}>
                                                        <TableCell>
                                                            <SearchableSelect
                                                                value={row.userId || (row.isUnlinked ? '__UNLINKED__' : undefined)}
                                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'userId', val)}
                                                                options={studentOptions}
                                                                placeholder="Select student..."
                                                            />
                                                            {row.isUnlinked && <Input placeholder="Enter Reference" value={row.reference || ''} onChange={(e) => handleBulkPaymentRowChange(row.key, 'reference', e.target.value)} className="mt-2" />}
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
                                                            <div className="flex items-center gap-2">
                                                                <Input type="number" placeholder="0.00" value={row.totalDue ?? ''} onChange={(e) => handleBulkPaymentRowChange(row.key, 'totalDue', e.target.value)} disabled={formLoading || (row.totalPaid !== undefined && row.totalPaid > 0)} />
                                                                {!row.isUnlinked && row.userId && row.semesterId && (
                                                                    <Popover>
                                                                        <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><History className="h-4 w-4" /></Button></PopoverTrigger>
                                                                        <PopoverContent className="w-80">
                                                                            <div className="space-y-2">
                                                                                <h4 className="font-medium leading-none text-sm">Payment History</h4>
                                                                                <p className="text-xs text-muted-foreground">Previous payments for this semester.</p>
                                                                                <Separator />
                                                                                <ScrollArea className="h-32">
                                                                                    {rawTransactions.filter(t => t.userId === row.userId && t.invoiceId === row.invoiceId).length > 0 ? (
                                                                                        <div className="space-y-2">
                                                                                            {rawTransactions
                                                                                                .filter(t => t.userId === row.userId && t.invoiceId === row.invoiceId)
                                                                                                .map(t => (
                                                                                                    <div key={t.key} className="flex justify-between text-xs">
                                                                                                        <span>{format(parseISO(t.paymentDate), 'dd MMM yyyy')}</span>
                                                                                                        <span className="font-mono">ZMW {t.amount.toFixed(2)}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                        </div>
                                                                                    ) : <p className="text-xs text-center py-4 text-muted-foreground">No payments yet.</p>}
                                                                                </ScrollArea>
                                                                                <Separator />
                                                                                <div className="flex justify-between text-xs font-bold pt-1"><span>Total Paid:</span><span>ZMW {(row.totalPaid || 0).toFixed(2)}</span></div>
                                                                            </div>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell><Input type="number" placeholder="0.00" value={row.amount} onChange={(e) => handleBulkPaymentRowChange(row.key, 'amount', e.target.value)} disabled={!row.semesterId} /></TableCell>
                                                        <TableCell className="font-semibold">ZMW {newBalance.toFixed(2)}</TableCell>
                                                        <TableCell><Input placeholder="e.g., Cash Deposit" value={row.comment} onChange={(e) => handleBulkPaymentRowChange(row.key, 'comment', e.target.value)} /></TableCell>
                                                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemovePaymentRow(row.key)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="pt-4 flex gap-2"><Button variant="outline" onClick={handleAddPaymentRow}><PlusCircle className="mr-2 h-4 w-4"/>Add Payment Row</Button></div>
                                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveBulkPayments} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Payments</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                     </div>
                     <Tabs defaultValue="studentPayments">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="studentPayments">Student Payments</TabsTrigger>
                            <TabsTrigger value="unlinkedPayments">Unlinked Payments ({unlinkedPayments.length})</TabsTrigger>
                            <TabsTrigger value="transactionHistory">Transaction History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="studentPayments">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student ID</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Programme</TableHead>
                                        <TableHead>Intake</TableHead>
                                        <TableHead className="text-center">Year/Sem</TableHead>
                                        <TableHead className="text-right">Total Due</TableHead>
                                        <TableHead className="text-right">Total Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.length > 0 ? (
                                        filteredData.map((p, index) => (
                                            <TableRow key={`${p.userId}-${index}`} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleOpenHistory(p)}>
                                                <TableCell className="font-medium">{p.studentId}</TableCell>
                                                <TableCell>{p.studentName}</TableCell>
                                                <TableCell className="text-xs">{programmes.find(pr => pr.id === p.programmeId)?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-xs uppercase font-bold">{allIntakes.find(i => i.id === p.intakeId)?.name || 'N/A'}</TableCell>
                                                <TableCell className="text-center"><Badge variant="outline" className="text-[10px] font-mono">Y{p.year}S{p.semesterInYear}</Badge></TableCell>
                                                <TableCell className="text-right">{p.totalDue.toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-green-600">{p.totalPaid.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold">{p.balance.toFixed(2)}</TableCell>
                                                <TableCell className="text-center"><Badge variant={statusVariant[p.status]}>{p.status}</Badge></TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenHistory(p)} title="View History"><History className="h-4 w-4 text-primary" /></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setActionLoading(`mail-${p.userId}`)} title="Email Invoice"><Mail className="h-4 w-4"/></Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setActionLoading(`dl-${p.userId}`)} title="Download PDF"><Download className="h-4 w-4"/></Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : <TableRow><TableCell colSpan={10} className="h-24 text-center">No payment data found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </TabsContent>
                         <TabsContent value="unlinkedPayments">
                             <Table>
                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Comment</TableHead><TableHead className="text-right">Amount (ZMW)</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {unlinkedPayments.length > 0 ? unlinkedPayments.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>{format(parseISO(p.date), 'PPP')}</TableCell>
                                            <TableCell>{p.reference}</TableCell>
                                            <TableCell>{p.comment}</TableCell>
                                            <TableCell className="text-right font-medium">{p.amount.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" onClick={() => { setLinkingPayment(p); setIsLinkingOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" />Link to Student</Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No unlinked payments.</TableCell></TableRow>}
                                </TableBody>
                             </Table>
                         </TabsContent>
                         <TabsContent value="transactionHistory">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Semester Applied To</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rawTransactions.map(tx => {
                                        const student = allStudents.find(s => s.uid === tx.userId);
                                        return (
                                            <TableRow key={tx.key}>
                                                <TableCell>{format(parseISO(tx.paymentDate), 'PPP')}</TableCell>
                                                <TableCell><div>{student?.name || 'N/A'}</div><div className='text-[10px] text-muted-foreground'>{student?.id}</div></TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold">{tx.semesterName || 'Unknown'}</span>
                                                        {tx.academicStanding && <Badge variant="outline" className="w-fit h-4 text-[8px] uppercase mt-0.5">{tx.academicStanding}</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-bold">ZMW {tx.amount.toFixed(2)}</TableCell>
                                                <TableCell>{tx.method}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(tx.key)} disabled={!!actionLoading}>
                                                        {actionLoading === tx.key ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                         </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Dialog open={isLinkingOpen} onOpenChange={setIsLinkingOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Link Unverified Payment</DialogTitle><DialogDescription>Match this payment to a student's invoice.</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-muted rounded-md text-sm">
                            <p><strong>Semester:</strong> {semesters.find(s => s.id === linkingPayment?.semesterId)?.name}</p>
                            <p><strong>Reference:</strong> {linkingPayment?.reference}</p>
                            <p><strong>Amount:</strong> ZMW {linkingPayment?.amount.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                            <Label>Student</Label>
                             <SearchableSelect
                                value={selectedLinkStudent}
                                onValueChange={setSelectedLinkStudent}
                                options={[{ groupName: 'Students', items: allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` })) }]}
                                placeholder="Select student to link to..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleLinkPayment} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Link Payment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Payment Record Ledger: {historyStudent?.studentName}</DialogTitle>
                        <DialogDescription>Full chronological history of payments applied to {historyStudent?.studentId}'s account.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-4">
                        {(() => {
                            const studentTxs = rawTransactions.filter(t => t.userId === historyStudent?.userId && t.status === 'successful');
                            return studentTxs.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Applied To</TableHead>
                                            <TableHead>Method</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentTxs.map(tx => (
                                            <TableRow key={tx.key}>
                                                <TableCell>{format(parseISO(tx.paymentDate), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold">{tx.semesterName}</span>
                                                        <Badge variant="secondary" className="w-fit h-4 text-[8px] mt-0.5">{tx.academicStanding}</Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{tx.method}</TableCell>
                                                <TableCell className="text-right font-bold text-green-600">ZMW {tx.amount.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground italic">
                                    <Info className="h-8 w-8 mb-2 opacity-20" />
                                    <p>No payment history found for this student.</p>
                                </div>
                            );
                        })()}
                    </div>
                    <DialogFooter className="border-t pt-4">
                        <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Close Ledger</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
