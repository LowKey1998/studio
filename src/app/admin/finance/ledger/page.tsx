'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

type Transaction = {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
};

export default function GeneralLedgerPage() {
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        const fetchLedger = async () => {
            setLoading(true);
            try {
                const [txSnap, expSnap, usersSnap] = await Promise.all([
                    get(ref(db, 'transactions')),
                    get(ref(db, 'expenses')),
                    get(ref(db, 'users'))
                ]);

                const users = usersSnap.val() || {};
                const ledgerEntries: Transaction[] = [];

                if (txSnap.exists()) {
                    Object.entries(txSnap.val()).forEach(([id, tx]: [string, any]) => {
                        if (tx.status === 'successful') {
                            const studentName = users[tx.userId]?.name || tx.userId;
                            ledgerEntries.push({
                                id: `tx-${id}`,
                                date: tx.paymentDate,
                                description: `Payment: ${studentName} (Inv: ${tx.invoiceId || 'N/A'})`,
                                debit: tx.amount,
                                credit: 0,
                            });
                        }
                    });
                }

                if (expSnap.exists()) {
                    Object.entries(expSnap.val()).forEach(([id, exp]: [string, any]) => {
                        ledgerEntries.push({
                            id: `exp-${id}`,
                            date: exp.date,
                            description: `Expense: ${exp.description} (${exp.category})`,
                            debit: 0,
                            credit: exp.amount,
                        });
                    });
                }

                const sorted = ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                let runningBalance = 0;
                const withBalance = sorted.map(entry => {
                    runningBalance += (entry.debit - entry.credit);
                    return { ...entry, balance: runningBalance };
                });

                setTransactions(withBalance.reverse());
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchLedger();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>General Ledger</CardTitle>
                <CardDescription>Consolidated chronological record of all institutional revenue and expenses.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit (+)</TableHead>
                            <TableHead className="text-right">Credit (-)</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                        )) : transactions.length > 0 ? (
                         transactions.map((tx, idx) => (
                            <TableRow key={tx.id || idx}>
                                <TableCell className="whitespace-nowrap">{format(new Date(tx.date), 'MMM dd, yyyy')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">{tx.debit > 0 ? `ZMW ${tx.debit.toFixed(2)}` : '-'}</TableCell>
                                <TableCell className="text-right text-red-600 font-medium">{tx.credit > 0 ? `ZMW ${tx.credit.toFixed(2)}` : '-'}</TableCell>
                                <TableCell className="text-right font-bold">ZMW {(tx as any).balance.toFixed(2)}</TableCell>
                            </TableRow>
                         ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No ledger entries found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
