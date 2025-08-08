
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { format, parseISO, isBefore } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type Defaulter = {
    userId: string;
    studentId: string;
    studentName: string;
    programmeName: string;
    balance: number;
    lastPaymentDate: string | null;
    dueDate: string | null;
    status: 'Due' | 'Overdue';
};

export default function DefaultersDashboardPage() {
    const [defaulters, setDefaulters] = React.useState<Defaulter[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        const fetchDefaulters = async () => {
            setLoading(true);
            try {
                const [usersSnap, regsSnap, transactionsSnap, programmesSnap, invoicesSnap, calendarSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'transactions')),
                    get(ref(db, 'programmes')),
                    get(ref(db, 'invoices')),
                    get(ref(db, 'calendarEvents')),
                ]);

                if (!usersSnap.exists() || !regsSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const users = usersSnap.val();
                const registrations = regsSnap.val();
                const transactions = transactionsSnap.val() || {};
                const programmes = programmesSnap.val() || {};
                const allInvoices = invoicesSnap.val() || {};
                const calendarEvents = calendarSnap.val() || {};
                const eventMap = new Map(Object.values(calendarEvents).map((e: any) => [e.title.trim(), e.date]));

                const defaulterList: Defaulter[] = [];

                for (const userId in registrations) {
                    for (const semesterId in registrations[userId]) {
                        const reg = registrations[userId][semesterId];
                        const invoice = allInvoices[userId]?.[reg.invoiceId];

                        if (!invoice || users[userId]?.role !== 'Student') continue;

                        const totalDue = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) - (invoice.applyScholarship ? invoice.totalTuition : 0);
                        const userTransactions = Object.values(transactions).filter((tx: any) => tx.userId === userId && tx.invoiceId === reg.invoiceId);
                        const totalPaid = userTransactions.reduce((acc: number, tx: any) => acc + tx.amount, 0);
                        const balance = totalDue - totalPaid;

                        if (balance > 0.01) {
                            const lastPaymentDate = userTransactions.length > 0
                                ? format(parseISO(userTransactions.sort((a:any,b:any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0].paymentDate), 'PPP')
                                : null;

                            const deadlineTitle = `Full Payment Deadline - ${invoice.semester}`;
                            const dueDate = eventMap.get(deadlineTitle) || null;
                            const isOverdue = dueDate ? isBefore(parseISO(dueDate), new Date()) : false;

                            defaulterList.push({
                                userId,
                                studentId: users[userId].id,
                                studentName: users[userId].name,
                                programmeName: programmes[reg.programmeId]?.name || 'N/A',
                                balance,
                                lastPaymentDate,
                                dueDate: dueDate ? format(parseISO(dueDate), 'PPP') : 'N/A',
                                status: isOverdue ? 'Overdue' : 'Due',
                            });
                        }
                    }
                }
                setDefaulters(defaulterList.sort((a,b) => b.balance - a.balance));
            } catch (error) {
                console.error("Error fetching defaulter data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDefaulters();
    }, []);
    
    const filteredDefaulters = defaulters.filter(d => 
        d.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.programmeName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payment Defaulter Analysis</CardTitle>
                <CardDescription>A list of all students with outstanding balances.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by student name, ID, or programme..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Programme</TableHead>
                            <TableHead>Last Payment</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Balance (ZMW)</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        )) : filteredDefaulters.map(defaulter => (
                            <TableRow key={defaulter.userId}>
                                <TableCell>{defaulter.studentId}</TableCell>
                                <TableCell className="font-medium">{defaulter.studentName}</TableCell>
                                <TableCell>{defaulter.programmeName}</TableCell>
                                <TableCell>{defaulter.lastPaymentDate || 'N/A'}</TableCell>
                                <TableCell>{defaulter.dueDate}</TableCell>
                                <TableCell className="text-right font-semibold">{defaulter.balance.toFixed(2)}</TableCell>
                                <TableCell><Badge variant={defaulter.status === 'Overdue' ? 'destructive' : 'secondary'}>{defaulter.status}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
