'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

type IncomeItem = { category: string; amount: number };

export default function IncomeStatementPage() {
    const [revenue, setRevenue] = React.useState<IncomeItem[]>([]);
    const [expenses, setExpenses] = React.useState<IncomeItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [period, setMonth] = React.useState(format(new Date(), 'yyyy-MM'));

    React.useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [txSnap, expSnap] = await Promise.all([
                    get(ref(db, 'transactions')),
                    get(ref(db, 'expenses'))
                ]);

                const start = startOfMonth(new Date(period));
                const end = endOfMonth(new Date(period));

                const txs = Object.values(txSnap.val() || {}).filter((t: any) => 
                    t.status === 'successful' && isWithinInterval(new Date(t.paymentDate), { start, end })
                );
                const exps = Object.values(expSnap.val() || {}).filter((e: any) => 
                    isWithinInterval(new Date(e.date), { start, end })
                );

                setRevenue([{ category: 'Student Fees', amount: txs.reduce((sum, t: any) => sum + t.amount, 0) }]);
                
                const groupedExps: Record<string, number> = {};
                exps.forEach((e: any) => {
                    groupedExps[e.category] = (groupedExps[e.category] || 0) + e.amount;
                });
                setExpenses(Object.entries(groupedExps).map(([category, amount]) => ({ category, amount })));

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period]);

    const totalRevenue = revenue.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = expenses.reduce((sum, i) => sum + i.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Income Statement (P&L)</CardTitle>
                        <CardDescription>Summary of revenue and expenses for the selected period.</CardDescription>
                    </div>
                    <div className="w-48">
                        <Label>Select Month</Label>
                        <Input type="month" value={period} onChange={e => setMonth(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {loading ? <Skeleton className="h-64 w-full" /> : (
                        <div className="space-y-6">
                            <section>
                                <h3 className="font-bold text-lg border-b pb-2 mb-2 flex items-center gap-2"><TrendingUp className="text-green-600"/> Revenue</h3>
                                <Table>
                                    <TableBody>
                                        {revenue.map((item, i) => (
                                            <TableRow key={i}><TableCell>{item.category}</TableCell><TableCell className="text-right">ZMW {item.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                        <TableRow className="bg-muted font-bold"><TableCell>Total Revenue</TableCell><TableCell className="text-right">ZMW {totalRevenue.toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </section>

                            <section>
                                <h3 className="font-bold text-lg border-b pb-2 mb-2 flex items-center gap-2"><TrendingDown className="text-red-600"/> Operating Expenses</h3>
                                <Table>
                                    <TableBody>
                                        {expenses.map((item, i) => (
                                            <TableRow key={i}><TableCell>{item.category}</TableCell><TableCell className="text-right">ZMW {item.amount.toFixed(2)}</TableCell></TableRow>
                                        ))}
                                        <TableRow className="bg-muted font-bold"><TableCell>Total Expenses</TableCell><TableCell className="text-right">ZMW {totalExpenses.toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </section>

                            <Card className={cn("border-2", netIncome >= 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50")}>
                                <CardContent className="pt-6 flex justify-between items-center">
                                    <span className="text-xl font-bold">Net Surplus / (Deficit)</span>
                                    <span className="text-3xl font-black">ZMW {netIncome.toFixed(2)}</span>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
