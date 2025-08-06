
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download, DollarSign, PlusCircle, Users, PiggyBank, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, get, update, push, set } from 'firebase/database';
import { format, parseISO, isBefore } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type StudentPaymentInfo = {
    userId: string;
    studentId: string; // STU-XXX
    studentName: string;
    totalDue: number;
    totalPaid: number;
    balance: number;
    status: 'Paid' | 'Pending' | 'Overdue';
    programmeId: string | null;
    semester: string | null;
};

type Transaction = {
    transactionId: string;
    invoiceId: string;
    amount: number;
    paymentDate: string;
    status: 'successful' | 'failed';
}

type Programme = {
    id: string;
    name: string;
};

type Semester = {
    id: string;
    name: string;
};

type OptionalFee = {
    id: string;
    name: string;
    amount: number;
}


export default function PaymentsManagementPage() {
    const [paymentInfos, setPaymentInfos] = React.useState<StudentPaymentInfo[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [optionalFees, setOptionalFees] = React.useState<OptionalFee[]>([]);

    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');


    // Dialog state
    const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
    const [formLoading, setFormLoading] = React.useState(false);
    const [selectedStudent, setSelectedStudent] = React.useState<StudentPaymentInfo | null>(null);
    const [paymentAmount, setPaymentAmount] = React.useState('');
    const [paymentMethod, setPaymentMethod] = React.useState('Cash');
    const [transactionId, setTransactionId] = React.useState('');

    // Fee Report State
    const [selectedFee, setSelectedFee] = React.useState('');

    const { toast } = useToast();

    const fetchPaymentData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [usersSnap, regsSnap, transactionsSnap, programmesSnap, semestersSnap, optionalFeesSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'transactions')),
                get(ref(db, 'programmes')),
                get(ref(db, 'semesters')),
                get(ref(db, 'optionalFees')),
            ]);
            
            if (programmesSnap.exists()) {
                setProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id]})));
            }
             if (semestersSnap.exists()) {
                setSemesters(Object.keys(semestersSnap.val()).map(id => ({ id, ...semestersSnap.val()[id]})));
            }
            if (optionalFeesSnap.exists()) {
                setOptionalFees(Object.keys(optionalFeesSnap.val()).map(id => ({ id, ...optionalFeesSnap.val()[id]})));
            }


            if (!usersSnap.exists() || !regsSnap.exists()) {
                setPaymentInfos([]);
                setLoading(false);
                return;
            }

            const users = usersSnap.val();
            const registrations = regsSnap.val();
            const transactions = transactionsSnap.exists() ? transactionsSnap.val() : {};

            const studentPaymentMap: Record<string, Omit<StudentPaymentInfo, 'status'>> = {};
            
            const invoicesSnap = await get(ref(db, 'invoices'));
            const allInvoices = invoicesSnap.exists() ? invoicesSnap.val() : {};

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
                        };
                    }
                    
                    if (reg.invoiceId && allInvoices[userId] && allInvoices[userId][reg.invoiceId]) {
                        const invoice = allInvoices[userId][reg.invoiceId];
                         const totalPayable = invoice.applyScholarship 
                            ? invoice.totalMandatoryFees + invoice.totalOptionalFees
                            : invoice.totalTuition + invoice.totalMandatoryFees + invoice.totalOptionalFees;
                        studentPaymentMap[key].totalDue += totalPayable;
                    }
                 }
            }

            // Calculate total paid from transactions
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
                .filter(p => p.totalDue > 0) // Only show students with invoices
                .map(p => {
                    const balance = p.totalDue - p.totalPaid;
                    let status: StudentPaymentInfo['status'] = 'Pending';
                    if (balance <= 0.01) {
                        status = 'Paid';
                    } else {
                        // A simple overdue check for now. Can be enhanced with due dates.
                        status = 'Pending'; 
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
    
    const handleRecordPayment = async () => {
        if(!selectedStudent || !paymentAmount || !paymentMethod) {
            toast({ variant: 'destructive', title: 'Missing fields' });
            return;
        }
        setFormLoading(true);
        try {
            const amount = parseFloat(paymentAmount);
            if (isNaN(amount) || amount <= 0) {
                 toast({ variant: 'destructive', title: 'Invalid amount' }); return;
            }

            const newTxId = transactionId.trim() || `CASH-${Date.now()}`;
            const txRef = push(ref(db, 'transactions'));
            await set(txRef, {
                transactionId: newTxId,
                userId: selectedStudent.userId,
                amount: amount,
                currency: 'ZMW',
                status: 'successful',
                paymentDate: new Date().toISOString(),
                method: paymentMethod,
                recordedBy: 'Admin/Accountant',
            });

            await createNotification(
                selectedStudent.userId,
                `A payment of ZMW ${amount.toFixed(2)} was manually recorded for your account.`,
                '/student/payments'
            );
            
            toast({ title: "Payment Recorded", description: `Payment of ZMW ${amount.toFixed(2)} for ${selectedStudent.studentName} has been recorded.` });
            
            fetchPaymentData(); // Refresh data
            setIsRecordPaymentOpen(false);
            resetDialog();

        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Failed to record payment', description: e.message });
        } finally {
            setFormLoading(false);
        }
    }
    
    const resetDialog = () => {
        setSelectedStudent(null);
        setPaymentAmount('');
        setPaymentMethod('Cash');
        setTransactionId('');
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
            const row = [
                p.studentId,
                p.studentName,
                programmeName,
                p.semester,
                p.totalDue.toFixed(2),
                p.totalPaid.toFixed(2),
                p.balance.toFixed(2),
                p.status
            ];
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

    const handleDownloadFeeReport = async () => {
        if (!selectedFee) {
            toast({ variant: 'destructive', title: 'Please select a fee to generate a report.' });
            return;
        }

        const fee = optionalFees.find(f => f.id === selectedFee);
        if (!fee) return;

        setLoading(true);
        try {
            const registrationsSnap = await get(ref(db, 'registrations'));
            const usersSnap = await get(ref(db, 'users'));
            if (!registrationsSnap.exists() || !usersSnap.exists()) {
                toast({ variant: 'destructive', title: 'No data found' });
                return;
            }

            const registrations = registrationsSnap.val();
            const users = usersSnap.val();
            const studentList: { id: string, name: string }[] = [];

            for (const userId in registrations) {
                for (const semester in registrations[userId]) {
                    const reg = registrations[userId][semester];
                    if (reg.status === 'Completed' && reg.optionalFees?.includes(selectedFee)) {
                        if (users[userId]) {
                            studentList.push({ id: users[userId].id, name: users[userId].name });
                        }
                    }
                }
            }

            if (studentList.length === 0) {
                toast({ title: 'No students found for this fee.' });
                setLoading(false);
                return;
            }

            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.text(`Student Report for ${fee.name}`, 14, 22);
            doc.setFontSize(12);
            doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
            
            (doc as any).autoTable({
                head: [['Student ID', 'Student Name']],
                body: studentList.map(s => [s.id, s.name]),
                startY: 40
            });
            doc.save(`report_${fee.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Failed to generate report.' });
        } finally {
            setLoading(false);
        }
    };

    
    const statusVariant: { [key in StudentPaymentInfo['status']]: 'destructive' | 'secondary' | 'default' } = {
        Paid: 'default',
        Pending: 'secondary',
        Overdue: 'destructive',
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
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input id="search" placeholder="Search by name or student ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                         <div className="flex-1 min-w-[200px]">
                            <Label htmlFor="programme-filter">Filter by Programme</Label>
                            <Select value={programmeFilter} onValueChange={setProgrammeFilter}><SelectTrigger id="programme-filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                         <div className="flex-1 min-w-[200px]">
                             <Label htmlFor="semester-filter">Filter by Semester</Label>
                            <Select value={semesterFilter} onValueChange={setSemesterFilter}><SelectTrigger id="semester-filter"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All Semesters</SelectItem>{semesters.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export PDF</Button>
                            <Dialog open={isRecordPaymentOpen} onOpenChange={(open) => { if(!open) resetDialog(); setIsRecordPaymentOpen(open); }}>
                                <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Record Payment</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Record Manual Payment</DialogTitle><DialogDescription>Use for cash payments or to verify an unrecorded transaction.</DialogDescription></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-1"><Label htmlFor="student-select">Student</Label><Select onValueChange={(val) => setSelectedStudent(paymentInfos.find(p => p.userId === val) || null)}><SelectTrigger id="student-select"><SelectValue placeholder="Select a student..."/></SelectTrigger><SelectContent>{paymentInfos.filter(p => p.balance > 0).map(s => (<SelectItem key={s.userId} value={s.userId}>{s.studentName} ({s.studentId}) - Bal: {s.balance.toFixed(2)}</SelectItem>))}</SelectContent></Select></div>
                                        <div className="space-y-1"><Label htmlFor="payment-amount">Amount (ZMW)</Label><Input id="payment-amount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
                                        <div className="space-y-1"><Label htmlFor="payment-method">Payment Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger id="payment-method"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Flutterwave">Flutterwave (Verification)</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                                        <div className="space-y-1"><Label htmlFor="transaction-id">Transaction ID (Optional)</Label><Input id="transaction-id" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="e.g., from bank slip or Flutterwave"/></div>
                                    </div>
                                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleRecordPayment} disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Record</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                     </div>
                    <Table>
                         <TableHeader>
                            <TableRow>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Student Name</TableHead>
                                <TableHead className="text-right">Total Due</TableHead>
                                <TableHead className="text-right">Total Paid</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                                ))
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
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">No payment data found for the selected filters.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Fee Reports</CardTitle>
                    <CardDescription>Download lists of students who have paid for specific optional services.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Label htmlFor="fee-select">Select Optional Fee</Label>
                            <Select value={selectedFee} onValueChange={setSelectedFee}>
                                <SelectTrigger id="fee-select">
                                    <SelectValue placeholder="Select a fee..."/>
                                </SelectTrigger>
                                <SelectContent>
                                    {optionalFees.map(fee => (
                                        <SelectItem key={fee.id} value={fee.id}>{fee.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleDownloadFeeReport} disabled={!selectedFee || loading}>
                            <Download className="mr-2 h-4 w-4"/>
                            Download Report
                        </Button>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
