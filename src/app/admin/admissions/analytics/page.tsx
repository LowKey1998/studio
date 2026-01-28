
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';

const chartConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

export default function AdmissionFunnelAnalyticsPage() {
    const [chartData, setChartData] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const leadsRef = ref(db, 'admissions/leads');
        const unsub = onValue(leadsRef, (snapshot) => {
            const leads = snapshot.val() || {};
            const leadsList = Object.values(leads);
            
            const funnel = [
                { stage: "Leads", count: leadsList.length },
                { stage: "Applied", count: leadsList.filter((l: any) => l.status === 'Applied' || l.status === 'Contacted').length },
                { stage: "Enrolled", count: 0 }, // Placeholder
            ];

            setChartData(funnel as any);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Admission Funnel Analytics</CardTitle>
                        <CardDescription>Visualize the entire admission process from lead to enrollment.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-[400px] w-full" /> :
                <ChartContainer config={chartConfig} className="h-[400px] w-full">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false}/>
                        <XAxis type="number" hide/>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                </ChartContainer>
                }
            </CardContent>
        </Card>
    );
}
