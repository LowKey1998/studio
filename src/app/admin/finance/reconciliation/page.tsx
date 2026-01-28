
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Check, X, AlertCircle } from "lucide-react";
import Papa from 'papaparse';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type BankTransaction = {
    date: string;
    description: string;
    amount: number;
    reference: string;
};

type SystemTransaction = {
    id: string;
    amount: number;
    studentId: string;
    studentName: string;
    status: 'unmatched' | 'matched';
};

export default function ReconciliationPage() {
    const [bankTransactions, setBankTransactions] = React.useState<BankTransaction[]>([]);
    const [systemTransactions, setSystemTransactions] = React.useState<SystemTransaction[]>([]);
    const [file, setFile] = React.useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleProcessFile = async () => {
        if (!file) return;

        // 1. Parse CSV
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedData = results.data.map((row: any) => ({
                    date: row.Date,
                    description: row.Description,
                    amount: parseFloat(row.Amount),
                    reference: row['Student ID'] || row.Reference || '',
                }));
                setBankTransactions(parsedData);
            }
        });

        // 2. Fetch system transactions (unreconciled payments)
        const usersSnap = await get(ref(db, 'users'));
        const users = usersSnap.val() || {};
        
        // This is a simplified fetch. A real scenario would likely involve
        // fetching only transactions within the statement's date range
        // and those not yet marked as 'reconciled'.
        const transactionsSnap = await get(ref(db, 'transactions'));
        const sysTxs: SystemTransaction[] = [];
        if (transactionsSnap.exists()){
            const allTxs = transactionsSnap.val();
            Object.entries(allTxs).forEach(([id, tx]: [string, any]) => {
                if(tx.status === 'successful' && tx.method !== 'Flutterwave') {
                    sysTxs.push({
                        id,
                        amount: tx.amount,
                        studentId: users[tx.userId]?.id || 'N/A',
                        studentName: users[tx.userId]?.name || 'Unknown',
                        status: 'unmatched'
                    });
                }
            });
        }
        setSystemTransactions(sysTxs);
    };

    const matchedTransactions = React.useMemo(() => {
        const matched: any[] = [];
        const unmatchedBank = [...bankTransactions];
        const unmatchedSystem = [...systemTransactions];

        bankTransactions.forEach((bankTx, bankIndex) => {
            const sysTxIndex = unmatchedSystem.findIndex(sysTx => 
                sysTx.studentId === bankTx.reference && Math.abs(sysTx.amount - bankTx.amount) < 0.01
            );
            if (sysTxIndex !== -1) {
                matched.push({ bank: bankTx, system: unmatchedSystem[sysTxIndex], status: 'Matched' });
                unmatchedSystem.splice(sysTxIndex, 1);
            }
        });

        return [...matched, ...unmatchedBank.filter(btx => !matched.some(m => m.bank === btx)).map(b => ({bank: b, system: null, status: 'Unmatched Bank'})), ...unmatchedSystem.map(s => ({bank: null, system: s, status: 'Unmatched System'})) ];
    }, [bankTransactions, systemTransactions]);


    return (
        <Card>
            <CardHeader>
                <CardTitle>Bank Reconciliation</CardTitle>
                <CardDescription>Upload a bank statement to automatically match transactions against system records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4 p-4 border rounded-lg">
                    <div className="space-y-1 flex-grow">
                        <Label htmlFor="statement-upload">Upload Bank Statement (CSV)</Label>
                        <Input id="statement-upload" type="file" accept=".csv" onChange={handleFileChange} />
                         <p className="text-xs text-muted-foreground">CSV must have 'Date', 'Description', 'Amount', and 'Student ID' columns.</p>
                    </div>
                     <Button onClick={handleProcessFile} disabled={!file} className="self-end"><Upload className="mr-2 h-4 w-4"/>Process Statement</Button>
                </div>

                {matchedTransactions.length > 0 && (
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description / Student</TableHead>
                                <TableHead className="text-right">Amount (ZMW)</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {matchedTransactions.map((item, index) => (
                                <TableRow key={index} className={item.status !== 'Matched' ? 'bg-destructive/10' : ''}>
                                    <TableCell>{item.bank?.date || item.system?.paymentDate}</TableCell>
                                    <TableCell>{item.bank?.description || item.system?.studentName}</TableCell>
                                    <TableCell className="text-right font-medium">{(item.bank?.amount || item.system?.amount).toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'Matched' ? 'default' : 'destructive'}>
                                            {item.status === 'Matched' ? <Check className="mr-2 h-4"/> : <X className="mr-2 h-4"/>}
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
