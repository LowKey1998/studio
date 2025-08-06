
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { format, parseISO, startOfMonth } from 'date-fns';
import { AlertCircle, TrendingUp, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Invoice = {
  invoiceId: string;
  totalTuition: number;
  totalMandatoryFees: number;
  totalOptionalFees: number;
  paymentPlan: string;
  semester: string;
  applyScholarship?: boolean;
};

type CalendarEvent = {
  title: string;
  date: string;
};

type PaymentPlan = {
    id: string;
    name: string;
    installments: number;
    installmentPercentages: number[];
}

const getOrdinalSuffix = (i: number) => {
    if (i === 1) return '1st';
    if (i === 2) return '2nd';
    if (i === 3) return '3rd';
    return `${i}th`;
}

const chartConfig = {
  projected: {
    label: "Projected",
    color: "hsl(var(--chart-1))",
  },
  actual: {
    label: "Actual",
    color: "hsl(var(--chart-2))",
  }
} satisfies ChartConfig;

export default function CashFlowPage() {
    const [chartData, setChartData] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [totalProjected, setTotalProjected] = React.useState(0);
    const [allPaymentPlans, setAllPaymentPlans] = React.useState<PaymentPlan[]>([]);

    React.useEffect(() => {
        const paymentPlansRef = ref(db, 'settings/paymentPlans');
        const unsub = onValue(paymentPlansRef, (snapshot) => {
            const plans: PaymentPlan[] = [];
            if(snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach(id => plans.push({ id, ...data[id] }));
            }
            setAllPaymentPlans(plans);
        });
        return () => unsub();
    }, []);

    React.useEffect(() => {
        if (allPaymentPlans.length === 0) {
            // Wait for plans to be loaded. If plans are empty after load, the effect will run again and find no data.
            if (!loading) setLoading(false);
            return;
        }

        const fetchAndProcessData = async () => {
            setLoading(true);
            try {
                const [registrationsSnap, invoicesSnap, calendarSnap, transactionsSnap] = await Promise.all([
                    get(ref(db, 'registrations')),
                    get(ref(db, 'invoices')),
                    get(ref(db, 'calendarEvents')),
                    get(ref(db, 'transactions'))
                ]);

                if (!registrationsSnap.exists() || !invoicesSnap.exists() || !calendarSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const registrations = registrationsSnap.val();
                const invoices = invoicesSnap.val();
                const calendarEvents: CalendarEvent[] = Object.values(calendarSnap.val());
                const transactions = transactionsSnap.val() || {};
                
                const monthlyProjections: Record<string, number> = {};
                const monthlyActuals: Record<string, number> = {};

                let totalRevenue = 0;

                for (const userId in registrations) {
                    for (const semester in registrations[userId]) {
                        const reg = registrations[userId][semester];
                        if (reg.status !== 'Pending Payment' && reg.status !== 'Completed') continue;
                        
                        const invoice: Invoice | undefined = invoices[userId]?.[reg.invoiceId];
                        if (!invoice) continue;

                        const totalPayable = invoice.applyScholarship
                            ? invoice.totalMandatoryFees + invoice.totalOptionalFees
                            : invoice.totalTuition + invoice.totalMandatoryFees + invoice.totalOptionalFees;
                        
                        const plan = allPaymentPlans.find(p => p.name === invoice.paymentPlan) || { name: 'Full Payment', installments: 1, installmentPercentages: [100] };

                        for (let i = 0; i < plan.installments; i++) {
                            const deadlineTitle = `${plan.name} (${getOrdinalSuffix(i + 1)} Installment) Deadline - ${semester}`;
                            const deadlineEvent = calendarEvents.find(e => e.title.trim() === deadlineTitle.trim());
                            
                            const percentage = plan.installmentPercentages?.[i] || (100 / plan.installments);
                            const installmentAmount = totalPayable * (percentage / 100);

                            if (deadlineEvent) {
                                const monthKey = format(startOfMonth(parseISO(deadlineEvent.date)), 'MMM yyyy');
                                if (!monthlyProjections[monthKey]) monthlyProjections[monthKey] = 0;
                                monthlyProjections[monthKey] += installmentAmount;
                            }
                        }
                         totalRevenue += totalPayable;
                    }
                }

                // Process actual transactions
                Object.values(transactions).forEach((tx: any) => {
                    if (tx.status === 'successful') {
                        const monthKey = format(startOfMonth(parseISO(tx.paymentDate)), 'MMM yyyy');
                        if (!monthlyActuals[monthKey]) monthlyActuals[monthKey] = 0;
                        monthlyActuals[monthKey] += tx.amount;
                    }
                });

                const allMonthKeys = new Set([...Object.keys(monthlyProjections), ...Object.keys(monthlyActuals)]);
                const sortedKeys = Array.from(allMonthKeys).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

                const data = sortedKeys.map(month => ({
                    month,
                    projected: monthlyProjections[month] || 0,
                    actual: monthlyActuals[month] || 0,
                }));
                
                setChartData(data);
                setTotalProjected(totalRevenue);

            } catch (error) {
                console.error("Error processing cash flow data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndProcessData();
    }, [allPaymentPlans, loading]);

    return (
        <div className="space-y-6">
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Cash Flow Management</CardTitle>
                    <CardDescription>Visualize projected vs. actual revenue based on student registrations, payment plans, and transactions.</CardDescription>
                </CardHeader>
            </Card>
            
            <Card>
                 <CardHeader>
                    <CardTitle>Monthly Revenue Overview</CardTitle>
                    <CardDescription>
                       Total Projected Revenue from Pending Invoices: <strong>ZMW {totalProjected.toFixed(2)}</strong>
                    </CardDescription>
                 </CardHeader>
                 <CardContent>
                    {loading ? (
                         <Skeleton className="h-[400px] w-full" />
                    ) : chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[400px] w-full">
                            <BarChart data={chartData} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `ZMW ${value / 1000}k`} />
                                <Tooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                                <Legend />
                                <Bar dataKey="projected" fill="var(--color-projected)" radius={4} />
                                <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                         <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Data Available</AlertTitle>
                            <AlertDescription>
                                There is no registration or payment data available to generate a cash flow projection.
                            </AlertDescription>
                        </Alert>
                    )}
                 </CardContent>
            </Card>
        </div>
    );
}
