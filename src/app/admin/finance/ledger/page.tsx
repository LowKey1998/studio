
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
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
    
    // This is a simplified ledger. In a real system, you'd fetch and aggregate from multiple sources.
    React.useEffect(() => {
        const txRef = ref(db, 'transactions');
        const unsub = onValue(txRef, (snapshot) => {
            const ledgerEntries: Transaction[] = [];
            if(snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(id => {
                    const tx = data[id];
                    if (tx.status === 'successful') {
                        ledgerEntries.push({
                            id: tx.transactionId,
                            date: tx.paymentDate,
                            description: `Payment from User ${tx.userId} for Invoice ${tx.invoiceId}`,
                            debit: 0,
                            credit: tx.amount,
                        });
                    }
                });
            }
             setTransactions(ledgerEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
             setLoading(false);
        });
        return () => unsub();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>General Ledger</CardTitle>
                <CardDescription>A complete record of all financial transactions.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         transactions.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell>{format(new Date(tx.date), 'PPP p')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right">{tx.debit > 0 ? tx.debit.toFixed(2) : '-'}</TableCell>
                                <TableCell className="text-right">{tx.credit > 0 ? tx.credit.toFixed(2) : '-'}</TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
