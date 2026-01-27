
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Download, DollarSign, PlusCircle, Users, PiggyBank, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, get, update, push, set } from 'firebase/database';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { createQbPayment } from '@/ai/flows/sync-to-quickbooks';
import { syncInvoiceToSage } from '@/ai/flows/sync-to-sage';

type StudentPaymentInfo = {
    userId: string;
    studentId: string;
    studentName: string;
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'Paid' | 'Pending' | 'Overdue';
    programmeId: string | null;
    semester: string | null;
    invoiceId: string;
};

type PaymentRecord = {
    amount: string;
    comment: string;
};

type Programme = {
    id: string;
    name: string;
};

type Semester = {
    id: string;
    name: string;
};

export default function PaymentsManagementPage() {
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
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
    const [bulkPayments, setBulkPayments] = React.useState<Record<string, PaymentRecord>>({});

    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, settingsSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'settings/integrations'))
            ]);
            
            if (programmesSnap.exists()) setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            if (semestersSnap.exists()) setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id]})));
            if (settingsSnap.exists()) {
                const integrations = settingsSnap.val();
                setIsQuickBooksEnabled(integrations.quickbooks?.enabled && integrations.quickbooks?.syncInvoices);
                setIsSageEnabled(integrations.sage?.enabled);
            }

            if (!usersSnap.exists() || !regsSnap.exists()) {
                setPaymentInfos([]); setLoading(false); return;
            }

            const users = usersSnap.val();
            const registrations = regsSnap.val();
            const transactions = transactionsSnap.exists() ? transactionsSnap.val() : {};
            
            const invoicesSnap = await get(ref(db, 'invoices'));
            const allInvoices = invoicesSnap.exists() ? invoicesSnap.val() : {};

            const studentPaymentMap: Record<string, Omit<StudentPaymentInfo, 'status'>> = {};
            
            for (const userId in registrations) {
                 if (!users[userId] || users[userId].role !== 'Student') continue;

                 for (const semester in registrations[userId]) {
                    const reg = registrations[userId][semester];
                    const key = `${userId}-${semester}`;

                    if (!studentPaymentMap[key]) {
                        studentPaymentMap[key] = {
                            userId: userId,
                            studentId: users[userId].id,
                            studentName: users[userId].name,
                            totalDue: 0,
                            totalPaid: 0,
                            balance: 0,
                            programmeId: reg.programmeId,
                            semester: semester,
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
                
                const invoice = allInvoices[tx.userId]?.[tx.invoiceId];
                if (invoice) {
                    const key = `${tx.userId}-${invoice.semester}`;
                     if (studentPaymentMap[key]) {
                        studentPaymentMap[key].totalPaid += tx.amount;
                    }
                }
            }
            
            const paymentInfoList = Object.values(studentPaymentMap)
                .filter(p => p.totalDue > 0)
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
    
    const handleBulkPaymentChange = (key: string, field: 'amount' | 'comment', value: string) => {
        setBulkPayments(prev => ({
            ...prev,
            [key]: {
                ...prev[key] || { amount: '', comment: '' },
                [field]: value
            }
        }));
    };
    
    const handleSaveBulkPayments = async () => {
        setFormLoading(true);
        const paymentsToRecord = Object.entries(bulkPayments).filter(([,p]) => parseFloat(p.amount) > 0);

        if(paymentsToRecord.length === 0) {
            toast({ variant: 'destructive', title: 'No payments entered.'});
            setFormLoading(false);
            return;
        }

        try {
            for (const [key, paymentRecord] of paymentsToRecord) {
                const [userId, invoiceId] = key.split('-');
                const studentInfo = paymentInfos.find(p => p.userId === userId && p.invoiceId === invoiceId);
                if (!studentInfo) continue;
                
                const amount = parseFloat(paymentRecord.amount);
                const newTxId = `MANUAL-${Date.now()}`;

                const txRef = push(ref(db, 'transactions'));
                await set(txRef, {
                    transactionId: newTxId,
                    userId: userId,
                    invoiceId: invoiceId,
                    amount: amount,
                    currency: 'ZMW',
                    status: 'successful',
                    paymentDate: new Date().toISOString(),
                    method: 'Manual',
                    comment: paymentRecord.comment,
                    recordedBy: 'Admin/Accountant',
                });
                
                // Sync to external services
                const syncData = { invoiceId, studentId: studentInfo.studentId, studentName: studentInfo.studentName, amount, date: new Date().toISOString().split('T')[0], description: `Manual Payment: ${paymentRecord.comment || 'N/A'}` };
                if (isQuickBooksEnabled) await createQbPayment(syncData);
                if (isSageEnabled) await syncInvoiceToSage(syncData); // Assuming similar payload
                
                await createNotification(userId, `A manual payment of ZMW ${amount.toFixed(2)} was recorded for your account. Comment: ${paymentRecord.comment || 'N/A'}`, '/student/payments');
            }
            
            toast({ title: "Payments Recorded", description: `${paymentsToRecord.length} payment(s) have been successfully recorded.` });
            await fetchPaymentData();
            setIsBulkRecordOpen(false);
            setBulkPayments({});
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to record payments', description: e.message });
        } finally {
            setFormLoading(false);
        }
    }

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
    
    const handleExport = () => {
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
        (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 30 });
        doc.save(`payments_report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const statusVariant: { [key in StudentPaymentInfo['status']]: 'destructive' | 'secondary' | 'default' } = {
        Paid: 'default', Pending: 'secondary', Overdue: 'destructive'
    };

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
                        <div className="flex-1 min-w-[200px]"><Label htmlFor="semester-filter">Filter by Semester</Label><Select value={semesterFilter} onValueChange={setSemesterFilter}><SelectTrigger id="semester-filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Semesters</SelectItem>{semesters.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                            <Dialog open={isBulkRecordOpen} onOpenChange={setIsBulkRecordOpen}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Record Payments</Button></DialogTrigger>
                                <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
                                    <DialogHeader><DialogTitle>Record Bulk Manual Payments</DialogTitle><DialogDescription>Enter payment amounts for multiple students below. Only entries with an amount will be saved.</DialogDescription></DialogHeader>
                                    <div className="flex-1 overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead>Total Due</TableHead>
                                                    <TableHead>Opening Balance</TableHead>
                                                    <TableHead className="w-[150px]">Amount Paid</TableHead>
                                                    <TableHead>New Balance</TableHead>
                                                    <TableHead className="w-[200px]">Comment</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paymentInfos.filter(p => p.balance > 0).map(student => {
                                                    const key = `${student.userId}-${student.invoiceId}`;
                                                    const amountPaid = parseFloat(bulkPayments[key]?.amount || '0');
                                                    const newBalance = student.balance - amountPaid;
                                                    return(
                                                    <TableRow key={key}>
                                                        <TableCell>{student.studentName}<br/><span className="text-xs text-muted-foreground">{student.studentId}</span></TableCell>
                                                        <TableCell>ZMW {student.totalDue.toFixed(2)}</TableCell>
                                                        <TableCell>ZMW {student.balance.toFixed(2)}</TableCell>
                                                        <TableCell><Input type="number" placeholder="0.00" value={bulkPayments[key]?.amount || ''} onChange={(e) => handleBulkPaymentChange(key, 'amount', e.target.value)} /></TableCell>
                                                        <TableCell className="font-semibold">ZMW {newBalance.toFixed(2)}</TableCell>
                                                        <TableCell><Input placeholder="e.g., Cash Deposit" value={bulkPayments[key]?.comment || ''} onChange={(e) => handleBulkPaymentChange(key, 'comment', e.target.value)} /></TableCell>
                                                    </TableRow>
                                                )})}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                        <Button onClick={handleSaveBulkPayments} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Payments</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                     </div>
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
                </CardContent>
            </Card>
        </div>
    );
}

    