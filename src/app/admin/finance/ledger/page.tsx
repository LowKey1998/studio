
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
    
    React.useEffect(() => {
        const ledgerEntries: Transaction[] = [];

        const txRef = ref(db, 'transactions');
        const unsubTx = onValue(txRef, (snapshot) => {
            if(snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(id => {
                    const tx = data[id];
                    if (tx.status === 'successful') {
                        ledgerEntries.push({
                            id: `tx-${id}`,
                            date: tx.paymentDate,
                            description: `Payment from ${tx.userId} for Invoice ${tx.invoiceId}`,
                            debit: tx.amount,
                            credit: 0,
                        });
                    }
                });
            }
            updateLedger();
        });

        const expRef = ref(db, 'expenses');
        const unsubExp = onValue(expRef, (snapshot) => {
            if(snapshot.exists()){
                const data = snapshot.val();
                Object.keys(data).forEach(id => {
                    const exp = data[id];
                     ledgerEntries.push({
                        id: `exp-${id}`,
                        date: exp.date,
                        description: `Expense: ${exp.description} (${exp.category})`,
                        debit: 0,
                        credit: exp.amount,
                    });
                });
            }
            updateLedger();
        });

        const updateLedger = () => {
             setTransactions(ledgerEntries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
             setLoading(false);
        }

        return () => {
            unsubTx();
            unsubExp();
        };
    }, []);

    let balance = 0;
    const ledgerWithBalance = transactions.slice().reverse().map(tx => {
        balance += tx.debit - tx.credit;
        return {...tx, balance};
    }).reverse();


    return (
        <Card>
            <CardHeader>
                <CardTitle>General Ledger</CardTitle>
                <CardDescription>A complete, consolidated record of all financial transactions.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         ledgerWithBalance.map(tx => (
                            <TableRow key={tx.id}>
                                <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right text-green-600">{tx.debit > 0 ? tx.debit.toFixed(2) : '-'}</TableCell>
                                <TableCell className="text-right text-red-600">{tx.credit > 0 ? tx.credit.toFixed(2) : '-'}</TableCell>
                                <TableCell className="text-right font-semibold">{tx.balance.toFixed(2)}</TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
