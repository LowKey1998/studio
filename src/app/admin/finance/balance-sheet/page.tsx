'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function BalanceSheetPage() {
    const [assets, setAssets] = React.useState<{name: string, amount: number}[]>([]);
    const [liabilities, setLiabilities] = React.useState<{name: string, amount: number}[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [txSnap, expSnap, payablesSnap, invoicesSnap, regsSnap] = await Promise.all([
                    get(ref(db, 'transactions')),
                    get(ref(db, 'expenses')),
                    get(ref(db, 'payables')),
                    get(ref(db, 'invoices')),
                    get(ref(db, 'registrations'))
                ]);

                const txs = Object.values(txSnap.val() || {}).filter((t: any) => t.status === 'successful');
                const exps = Object.values(expSnap.val() || {});
                const payables = Object.values(payablesSnap.val() || {}).filter((p: any) => p.status === 'Unpaid');
                
                const totalCash = txs.reduce((sum, t: any) => sum + t.amount, 0) - exps.reduce((sum, e: any) => sum + e.amount, 0);
                
                // Calculate Receivables (unpaid invoices)
                let totalReceivables = 0;
                const allInvoices = invoicesSnap.val() || {};
                const regs = regsSnap.val() || {};
                
                for(const uid in allInvoices) {
                    for(const invId in allInvoices[uid]) {
                        const inv = allInvoices[uid][invId];
                        const due = (inv.totalTuition || 0) + (inv.totalMandatoryFees || 0) + (inv.totalOptionalFees || 0) - (inv.applyScholarship ? inv.totalTuition : 0);
                        const paid = txs.filter((t: any) => t.userId === uid && t.invoiceId === invId).reduce((sum, t: any) => sum + t.amount, 0);
                        totalReceivables += Math.max(0, due - paid);
                    }
                }

                setAssets([
                    { name: 'Cash and Cash Equivalents', amount: totalCash },
                    { name: 'Accounts Receivable', amount: totalReceivables }
                ]);

                setLiabilities([
                    { name: 'Accounts Payable', amount: payables.reduce((sum, p: any) => sum + p.amount, 0) }
                ]);

            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        };
        fetchData();
    }, []);

    const totalAssets = assets.reduce((sum, i) => sum + i.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, i) => sum + i.amount, 0);
    const equity = totalAssets - totalLiabilities;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Balance Sheet</CardTitle>
                    <CardDescription>Statement of Financial Position as of {format(new Date(), 'PPP')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {loading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="grid md:grid-cols-2 gap-8">
                            <section className="space-y-4">
                                <h3 className="font-bold text-lg border-b pb-2">Assets</h3>
                                <Table>
                                    <TableBody>
                                        {assets.map((item, i) => (
                                            <TableRow key={i}><TableCell>{item.name}</TableCell><TableCell className="text-right">ZMW {item.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                        <TableRow className="bg-muted font-bold"><TableCell>Total Assets</TableCell><TableCell className="text-right">ZMW {totalAssets.toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </section>

                            <section className="space-y-4">
                                <h3 className="font-bold text-lg border-b pb-2">Liabilities & Equity</h3>
                                <Table>
                                    <TableBody>
                                        {liabilities.map((item, i) => (
                                            <TableRow key={i}><TableCell>{item.name}</TableCell><TableCell className="text-right">ZMW {item.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                        <TableRow><TableCell>Retained Earnings (Equity)</TableCell><TableCell className="text-right">ZMW {equity.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="bg-muted font-bold"><TableCell>Total Liabilities & Equity</TableCell><TableCell className="text-right">ZMW {(totalLiabilities + equity).toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </section>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
