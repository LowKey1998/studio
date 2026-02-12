'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type Account = { name: string; debit: number; credit: number };

export default function TrialBalancePage() {
    const [accounts, setAccounts] = React.useState<Account[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [txSnap, expSnap, payablesSnap, invoicesSnap] = await Promise.all([
                    get(ref(db, 'transactions')),
                    get(ref(db, 'expenses')),
                    get(ref(db, 'payables')),
                    get(ref(db, 'invoices'))
                ]);

                const txs = Object.values(txSnap.val() || {}).filter((t: any) => t.status === 'successful');
                const exps = Object.values(expSnap.val() || {});
                const payables = Object.values(payablesSnap.val() || {}).filter((p: any) => p.status === 'Unpaid');
                
                const totalPaid = txs.reduce((sum, t: any) => sum + t.amount, 0);
                const totalExpenses = exps.reduce((sum, e: any) => sum + e.amount, 0);
                const totalCash = totalPaid - totalExpenses;

                let totalReceivables = 0;
                const allInvoices = invoicesSnap.val() || {};
                for(const uid in allInvoices) {
                    for(const invId in allInvoices[uid]) {
                        const inv = allInvoices[uid][invId];
                        const due = (inv.totalTuition || 0) + (inv.totalMandatoryFees || 0) + (inv.totalOptionalFees || 0) - (inv.applyScholarship ? inv.totalTuition : 0);
                        const paid = txs.filter((t: any) => t.userId === uid && t.invoiceId === invId).reduce((sum, t: any) => sum + t.amount, 0);
                        totalReceivables += Math.max(0, due - paid);
                    }
                }

                const trialBalance: Account[] = [
                    { name: 'Cash Account', debit: Math.max(0, totalCash), credit: Math.max(0, -totalCash) },
                    { name: 'Accounts Receivable', debit: totalReceivables, credit: 0 },
                    { name: 'Accounts Payable', debit: 0, credit: payables.reduce((sum, p: any) => sum + p.amount, 0) },
                    { name: 'Tuition Revenue', debit: 0, credit: totalPaid + totalReceivables },
                    { name: 'Operating Expenses', debit: totalExpenses, credit: 0 },
                ];

                setAccounts(trialBalance);

            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const totalDebits = accounts.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = accounts.reduce((sum, a) => sum + a.credit, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Trial Balance</CardTitle>
                <CardDescription>Verification of debit and credit balances across all ledger accounts as of {format(new Date(), 'PPP')}</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-64 w-full" /> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account Name</TableHead>
                                <TableHead className="text-right">Debit (ZMW)</TableHead>
                                <TableHead className="text-right">Credit (ZMW)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map((acc, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{acc.name}</TableCell>
                                    <TableCell className="text-right">{acc.debit > 0 ? acc.debit.toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-right">{acc.credit > 0 ? acc.credit.toFixed(2) : '-'}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-muted font-bold">
                                <TableCell>Totals</TableCell>
                                <TableCell className="text-right">ZMW {totalDebits.toFixed(2)}</TableCell>
                                <TableCell className="text-right">ZMW {totalCredits.toFixed(2)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
