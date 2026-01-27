
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Download, DollarSign, PlusCircle, Users, PiggyBank, Scale, Trash2, ChevronsUpDown, Link as LinkIcon, Link2Off } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, get, update, push, set, remove, onValue } from 'firebase/database';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createQbPayment } from '@/ai/flows/sync-to-quickbooks';
import { syncInvoiceToSage } from '@/ai/flows/sync-to-sage';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


type StudentPaymentInfo = {
    userId: string;
    studentId: string;
    studentName: string;
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'Paid' | 'Pending' | 'Overdue';
    programmeId: string | null;
    semester: string | null; // semester ID
    invoiceId: string;
};

type PaymentRecord = {
    key: number;
    isUnlinked?: boolean;
    reference?: string;
    userId?: string;
    semesterId?: string;
    invoiceId?: string;
    totalDue?: number;
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
};


type Programme = { id: string; name: string; };
type Semester = { id: string; name: string; };

// --- Reusable Searchable Select Component ---
function SearchableSelect({ options, value, onValueChange, placeholder, disabled = false }: {
    options: { value: string, label: string }[];
    value: string | undefined;
    onValueChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const filteredOptions = React.useMemo(() => 
        options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase())),
        [options, search]
    );

    const selectedLabel = value ? options.find(o => o.value === value)?.label : placeholder;

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
                    {filteredOptions.length > 0 ? filteredOptions.map(option => (
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
                    )) : <p className="p-2 text-center text-sm text-muted-foreground">No results found.</p>}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    )
}

export default function PaymentsManagementPage() {
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [unlinkedPayments, setUnlinkedPayments] = React.useState<UnlinkedPayment[]>([]);
    const [allStudents, setAllStudents] = React.useState<{ uid: string, id: string, name: string }[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [isQuickBooksEnabled, setIsQuickBooksEnabled] = React.useState(false);
    const [isSageEnabled, setIsSageEnabled] = React.useState(false);

    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');

    // Bulk Record Dialog state
    const [isBulkRecordOpen, setIsBulkRecordOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    const [bulkPaymentRows, setBulkPaymentRows] = React.useState<PaymentRecord[]>([]);

    // Linking Dialog state
    const [isLinkingOpen, setIsLinkingOpen] = React.useState(false);
    const [linkingPayment, setLinkingPayment] = React.useState<UnlinkedPayment | null>(null);
    const [selectedLinkStudent, setSelectedLinkStudent] = React.useState('');


    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, settingsSnap, unlinkedSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'settings/integrations')),
                get(ref(db, 'unlinkedPayments'))
            ]);
            
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id]})));
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

            const users = usersSnap.val();
            const studentList: { uid: string, id: string, name: string }[] = [];
            if (usersSnap.exists()) {
                for (const uid in users) {
                    if (users[uid].role === 'Student') {
                        studentList.push({ uid: uid, id: users[uid].id, name: users[uid].name });
                    }
                }
            }
            setAllStudents(studentList.sort((a,b) => a.name.localeCompare(b.name)));

            if (!usersSnap.exists()) {
                setPaymentInfos([]); setLoading(false); return;
            }
            
            const registrations = regsSnap.exists() ? regsSnap.val() : {};
            const transactions = transactionsSnap.exists() ? transactionsSnap.val() : {};
            
            const invoicesSnap = await get(ref(db, 'invoices'));
            const allInvoices = invoicesSnap.exists() ? invoicesSnap.val() : {};

            const studentPaymentMap: Record<string, Omit<StudentPaymentInfo, 'status'>> = {};
            
            for (const userId in registrations) {
                 if (!users[userId] || users[userId].role !== 'Student') continue;

                 for (const semesterId in registrations[userId]) {
                    const reg = registrations[userId][semesterId];
                    const key = `${userId}-${semesterId}`;

                    if (!studentPaymentMap[key]) {
                        studentPaymentMap[key] = {
                            userId: userId,
                            studentId: users[userId].id,
                            studentName: users[userId].name,
                            totalDue: 0,
                            totalPaid: 0,
                            balance: 0,
                            programmeId: reg.programmeId,
                            semester: semesterId,
                            invoiceId: reg.invoiceId,
                        };
                    }
                    
                    if (reg.invoiceId && allInvoices[userId] && allInvoices[userId][reg.invoiceId]) {
                        const invoice = allInvoices[userId][reg.invoiceId];
                         const totalPayable = invoice.applyScholarship 
                            ? (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0)
                            : (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0);
                        studentPaymentMap[key].totalDue += totalPayable;
                    }
                 }
            }

            for (const txId in transactions) {
                const tx = transactions[txId];
                if(tx.status !== 'successful') continue;
                
                const invoice = Object.values(allInvoices[tx.userId] || {}).find((inv: any) => inv.invoiceId === tx.invoiceId) as any;
                if (invoice) {
                    const key = `${tx.userId}-${invoice.semesterId}`;
                     if (studentPaymentMap[key]) {
                        studentPaymentMap[key].totalPaid += tx.amount;
                    }
                }
            }
            
            const paymentInfoList = Object.values(studentPaymentMap)
                .map(p => {
                    const balance = p.totalDue - p.totalPaid;
                    let status: StudentPaymentInfo['status'] = 'Pending';
                    if (balance <= 0.01) {
                        status = 'Paid';
                    }
                    return { ...p, balance, status };
                });

            setPaymentInfos(paymentInfoList);

        } catch (error: any) {
            console.error("Error fetching payment data:", error);
            toast({ variant: 'destructive', title: 'Failed to load payment data.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    React.useEffect(() => {
        fetchPaymentData();
    }, [fetchPaymentData]);
    
    const handleAddPaymentRow = () => {
        setBulkPaymentRows(prev => [...prev, { key: Date.now(), amount: '', comment: '' }]);
    };
    
    const handleRemovePaymentRow = (key: number) => {
        setBulkPaymentRows(prev => prev.filter(row => row.key !== key));
    };

    const handleBulkPaymentRowChange = (key: number, field: keyof PaymentRecord, value: string | number) => {
        setBulkPaymentRows(prev => prev.map(row => {
            if (row.key !== key) return row;
    
            let updatedRow = { ...row, [field]: value };
    
            if (field === 'userId') {
                if (value === '__UNLINKED__') {
                    // Keep semesterId, but reset student-specific fields
                    return { 
                        ...row, 
                        isUnlinked: true, 
                        userId: undefined, 
                        invoiceId: undefined, 
                        totalDue: 0 // Reset total due for unlinked
                    };
                }
                // Convert back to or set as student row
                updatedRow.isUnlinked = false;
                updatedRow.reference = undefined;
            }
    
            // Auto-populate invoice and balance if student and semester are selected
            const studentId = updatedRow.userId;
            const semId = updatedRow.semesterId;
            
            if (!updatedRow.isUnlinked && (field === 'userId' || field === 'semesterId')) {
                 if (studentId && semId) {
                    const info = paymentInfos.find(p => p.userId === studentId && p.semester === semId);
                    updatedRow.invoiceId = info?.invoiceId;
                    updatedRow.totalDue = info?.balance ?? 0;
                } else {
                    updatedRow.totalDue = undefined;
                    updatedRow.invoiceId = undefined;
                }
            }
            
            return updatedRow;
        }));
    };
    
    const handleSaveBulkPayments = async () => {
        setFormLoading(true);
        const paymentsToRecord = bulkPaymentRows.filter(p => 
            parseFloat(p.amount) > 0 && 
            p.semesterId && // Semester is now always required
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
                    const { reference, semesterId, amount, comment } = paymentRecord;
                    const newUnlinkedRef = push(ref(db, 'unlinkedPayments'));
                    await set(newUnlinkedRef, {
                        reference,
                        semesterId,
                        amount: parseFloat(amount),
                        comment,
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
                            totalTuition: totalDue || 0, // Use manually entered amount
                            totalMandatoryFees: 0,
                            totalOptionalFees: 0,
                            dateCreated: new Date().toISOString(),
                            semester: semesterInfo.name,
                            semesterId: semesterInfo.id,
                            courses: [],
                            optionalFees: [],
                        });
                        await set(ref(db, `registrations/${userId}/${semesterId}`), {
                            courses: [], invoiceId, status: 'Completed', paymentPlan: 'Manual', programmeId: '', registrationDate: new Date().toISOString(), semesterName: semesterInfo.name,
                        });
                    }
                    
                    const newTxId = `MANUAL-${Date.now()}`;
                    await push(ref(db, 'transactions'), {
                        transactionId: newTxId, userId, invoiceId, amount: parseFloat(amount), currency: 'ZMW', status: 'successful', paymentDate: new Date().toISOString(), method: 'Manual', comment,
                    });
                    
                    await createNotification(userId, `A manual payment of ZMW ${parseFloat(amount).toFixed(2)} was recorded for your account. Comment: ${comment || 'N/A'}`, '/student/payments');
                }
            }
            
            toast({ title: "Payments Recorded", description: `${paymentsToRecord.length} payment(s) have been successfully recorded.` });
            await fetchPaymentData();
            setIsBulkRecordOpen(false);
            setBulkPaymentRows([]);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to record payments', description: e.message });
        } finally {
            setFormLoading(false);
        }
    }
    
    const handleLinkPayment = async () => {
        if (!linkingPayment || !selectedLinkStudent || !linkingPayment.semesterId) {
            toast({ variant: 'destructive', title: 'Please select a student.'});
            return;
        }
        const selectedLinkSemester = linkingPayment.semesterId;

        setFormLoading(true);
        try {
            let invoiceId = paymentInfos.find(p => p.userId === selectedLinkStudent && p.semester === selectedLinkSemester)?.invoiceId;
            const studentInfo = allStudents.find(s => s.uid === selectedLinkStudent);
            
            if (!invoiceId && studentInfo) {
                // Simplified invoice creation for linking
                const newInvoiceRef = push(ref(db, `invoices/${selectedLinkStudent}`));
                invoiceId = newInvoiceRef.key!;
                 await set(newInvoiceRef, { invoiceId, totalTuition: linkingPayment.amount, dateCreated: new Date().toISOString(), semesterId: selectedLinkSemester });
                 await update(ref(db, `registrations/${selectedLinkStudent}/${selectedLinkSemester}`), { invoiceId });
            }
            if(!invoiceId || !studentInfo) throw new Error("Could not find or create an invoice for this selection.");

            const newTxId = `LINKED-${linkingPayment.id}`;
            await push(ref(db, 'transactions'), {
                transactionId: newTxId, userId: selectedLinkStudent, invoiceId: invoiceId, amount: linkingPayment.amount, currency: 'ZMW', status: 'successful', paymentDate: linkingPayment.date, method: 'Manual (Linked)', comment: `Linked from unverified payment. Original Ref: ${linkingPayment.reference}`,
            });

            await remove(ref(db, `unlinkedPayments/${linkingPayment.id}`));
            await createNotification(selectedLinkStudent, `A payment of ZMW ${linkingPayment.amount.toFixed(2)} was linked to your account.`, '/student/payments');
            
            toast({ title: 'Payment Linked!', description: 'The payment has been successfully linked to the student.'});
            await fetchPaymentData();
            setIsLinkingOpen(false);
        } catch (e:any) {
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
            const semesterMatch = semesterFilter === 'all' || p.semester === semesterFilter;
            return searchMatch && programmeMatch && semesterMatch;
        });
    }, [paymentInfos, searchTerm, programmeFilter, semesterFilter]);

    const summaryStats = React.useMemo(() => {
        return filteredData.reduce((acc, p) => {
            acc.totalDue += p.totalDue;
            acc.totalPaid += p.totalPaid;
            acc.totalBalance += p.balance;
            return acc;
        }, { totalDue: 0, totalPaid: 0, totalBalance: 0 });
    }, [filteredData]);
    
    const handleExport = async () => {
        const doc = new jsPDF();
        const tableColumn = ["ID", "Name", "Programme", "Semester", "Due", "Paid", "Balance", "Status"];
        const tableRows: (string | number)[][] = [];
        
        filteredData.forEach(p => {
            const programmeName = programmes.find(prog => prog.id === p.programmeId)?.name || 'N/A';
            const semesterName = semesters.find(sem => sem.id === p.semester)?.name || 'N/A';
            const row = [ p.studentId, p.studentName, programmeName, semesterName, p.totalDue.toFixed(2), p.totalPaid.toFixed(2), p.balance.toFixed(2), p.status ];
            tableRows.push(row);
        });

        doc.setFontSize(18);
        doc.text("Payments Report", 14, 22);
        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30
        });
        doc.save(`payments_report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const statusVariant: { [key in StudentPaymentInfo['status']]: 'destructive' | 'secondary' | 'default' } = {
        Paid: 'default', Pending: 'secondary', Overdue: 'destructive'
    };

    const studentOptions = React.useMemo(() => [
        { value: '__UNLINKED__', label: '--- Student Not Found / Unlinked Payment ---' },
        ...allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` }))
    ], [allStudents]);

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
                                                    <TableHead className="w-[250px]">Semester</TableHead>
                                                    <TableHead>Total Due</TableHead>
                                                    <TableHead className="w-[150px]">Amount Paid</TableHead>
                                                    <TableHead>New Balance</TableHead>
                                                    <TableHead className="w-[200px]">Comment</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {bulkPaymentRows.map((row) => {
                                                    const amountPaid = parseFloat(row.amount || '0');
                                                    const totalDueForCalc = row.totalDue ?? 0;
                                                    const newBalance = totalDueForCalc - amountPaid;

                                                    return (
                                                    <TableRow key={row.key}>
                                                        <TableCell>
                                                            <SearchableSelect
                                                                value={row.userId || (row.isUnlinked ? '__UNLINKED__' : undefined)}
                                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'userId', val)}
                                                                options={studentOptions}
                                                                placeholder="Select student..."
                                                            />
                                                            {row.isUnlinked && (
                                                                <Input
                                                                    placeholder="Enter Reference for unlinked payment"
                                                                    value={row.reference || ''}
                                                                    onChange={(e) => handleBulkPaymentRowChange(row.key, 'reference', e.target.value)}
                                                                    className="mt-2"
                                                                />
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <SearchableSelect
                                                                value={row.semesterId}
                                                                onValueChange={(val) => handleBulkPaymentRowChange(row.key, 'semesterId', val)}
                                                                options={semesters.map(s => ({ value: s.id, label: s.name }))}
                                                                placeholder="Select semester..."
                                                                disabled={!row.userId && !row.isUnlinked}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input 
                                                                type="number" 
                                                                placeholder="0.00" 
                                                                value={row.totalDue ?? ''} 
                                                                onChange={(e) => handleBulkPaymentRowChange(row.key, 'totalDue', e.target.value)} 
                                                                disabled={!row.semesterId}
                                                            />
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
                                    <div className="pt-4 flex gap-2">
                                        <Button variant="outline" onClick={handleAddPaymentRow}><PlusCircle className="mr-2 h-4 w-4"/>Add Payment Row</Button>
                                    </div>
                                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveBulkPayments} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Payments</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                     </div>
                     <Tabs defaultValue="studentPayments">
                        <TabsList>
                            <TabsTrigger value="studentPayments">Student Payments</TabsTrigger>
                            <TabsTrigger value="unlinkedPayments">Unlinked Payments ({unlinkedPayments.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="studentPayments">
                            <Table>
                                <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Student Name</TableHead><TableHead className="text-right">Total Due</TableHead><TableHead className="text-right">Total Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {loading ? ( Array.from({length: 5}).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>))
                                    ) : filteredData.length > 0 ? (
                                        filteredData.map((p, index) => (
                                            <TableRow key={`${p.userId}-${index}`}>
                                                <TableCell className="font-medium">{p.studentId}</TableCell>
                                                <TableCell>{p.studentName}</TableCell>
                                                <TableCell className="text-right">{p.totalDue.toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-green-600">{p.totalPaid.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold">{p.balance.toFixed(2)}</TableCell>
                                                <TableCell className="text-center"><Badge variant={statusVariant[p.status]}>{p.status}</Badge></TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">No payment data found for the selected filters.</TableCell></TableRow>
                                    )}
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
                                    )) : <TableRow><TableCell colSpan={5} className="h-24 text-center">No unlinked payments.</TableCell></TableRow>}
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
                            <p><strong>Comment:</strong> {linkingPayment?.comment}</p>
                        </div>
                        <div className="space-y-1">
                            <Label>Student</Label>
                             <SearchableSelect
                                value={selectedLinkStudent}
                                onValueChange={setSelectedLinkStudent}
                                options={allStudents.map(s => ({ value: s.uid, label: `${s.name} (${s.id})` }))}
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
        </div>
    );
}

    