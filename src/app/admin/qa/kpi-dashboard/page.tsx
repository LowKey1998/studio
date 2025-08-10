'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const chartData = [
    { month: "January", passRate: 88, dropoutRate: 5 },
    { month: "February", passRate: 92, dropoutRate: 4 },
    { month: "March", passRate: 90, dropoutRate: 4.5 },
    { month: "April", passRate: 85, dropoutRate: 6 },
];

const chartConfig = {
  passRate: {
    label: "Student Pass Rate",
    color: "hsl(var(--chart-1))",
  },
  dropoutRate: {
    label: "Student Dropout Rate",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export default function KPIDashboardPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>KPI Dashboard</CardTitle>
                <CardDescription>Track Key Performance Indicators for quality assurance.</CardDescription>
            </CardHeader>
            <CardContent>
                 <ChartContainer config={chartConfig} className="h-[400px] w-full">
                    <BarChart data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                         <YAxis
                           tickFormatter={(value) => `${value}%`
                         />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="passRate" fill="var(--color-passRate)" radius={4} />
                        <Bar dataKey="dropoutRate" fill="var(--color-dropoutRate)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
