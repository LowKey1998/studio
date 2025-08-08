'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, BookOpen, Library } from 'lucide-react';

type ChartData = {
    name: string;
    count: number;
};

const chartConfig = {
  count: {
    label: "Borrows",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function LibraryStatisticsPage() {
    const [mostBorrowed, setMostBorrowed] = React.useState<ChartData[]>([]);
    const [totalBooks, setTotalBooks] = React.useState(0);
    const [totalLoans, setTotalLoans] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        const booksRef = ref(db, 'libraryBooks');
        const requestsRef = ref(db, 'bookRequests');

        const unsubBooks = onValue(booksRef, (snapshot) => {
             setTotalBooks(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
        });

        const unsubRequests = onValue(requestsRef, (snapshot) => {
            const borrowCounts: Record<string, {name: string, count: number}> = {};
            let loans = 0;
            if (snapshot.exists()) {
                const requests = snapshot.val();
                Object.values(requests).forEach((req: any) => {
                    if (req.status === 'Checked Out' || req.status === 'Returned') {
                        loans++;
                        if (!borrowCounts[req.bookId]) {
                            borrowCounts[req.bookId] = { name: req.bookTitle.substring(0, 20) + (req.bookTitle.length > 20 ? '...' : ''), count: 0 };
                        }
                        borrowCounts[req.bookId].count++;
                    }
                });
            }
            setTotalLoans(loans);
            setMostBorrowed(
                Object.values(borrowCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
            );
            setLoading(false);
        });
        
        return () => {
            unsubBooks();
            unsubRequests();
        }

    }, []);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Books in Catalog</CardTitle>
                        <Library className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : totalBooks}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Loans to Date</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : totalLoans}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Most Borrowed Books</CardTitle>
                    <CardDescription>Top 10 most frequently borrowed books.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-[300px] w-full" /> : mostBorrowed.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                             <BarChart data={mostBorrowed} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                                <XAxis type="number" dataKey="count" hide/>
                                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                         <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Data</AlertTitle>
                            <AlertDescription>No books have been borrowed yet.</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
