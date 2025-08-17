
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from '@/components/ui/badge';

const chartData = [
    { stage: "Leads", count: 1200 },
    { stage: "Applied", count: 850 },
    { stage: "Interviewed", count: 400 },
    { stage: "Offered", count: 250 },
    { stage: "Enrolled", count: 180 },
];

const chartConfig = {
  count: { label: "Count", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

export default function AdmissionFunnelAnalyticsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Admission Funnel Analytics</CardTitle>
                        <CardDescription>Visualize the entire admission process from lead to enrollment.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[400px] w-full blur-sm pointer-events-none">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid horizontal={false} />
                        <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false}/>
                        <XAxis type="number" hide/>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
