
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, BookOpen, Library } from 'lucide-react';

type ChartData = {
    name: string;
    count: number;
    fill?: string;
};

const chartConfig = {
  count: {
    label: "Borrows",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];


export default function LibraryStatisticsPage() {
    const [mostBorrowed, setMostBorrowed] = React.useState<ChartData[]>([]);
    const [loansByGenre, setLoansByGenre] = React.useState<ChartData[]>([]);
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
            const borrowCounts: Record<string, {name: string, count: number, genre: string}> = {};
            const genreCounts: Record<string, number> = {};
            let loans = 0;

            if (snapshot.exists()) {
                const booksSnapshotVal = books.length > 0 ? books : null; // Use state if available
                const requests = snapshot.val();
                Object.values(requests).forEach((req: any) => {
                    if (req.status === 'Checked Out' || req.status === 'Returned') {
                        loans++;
                        if (!borrowCounts[req.bookId]) {
                            const bookDetails = booksSnapshotVal?.find((b: any) => b.id === req.bookId);
                            borrowCounts[req.bookId] = { 
                                name: req.bookTitle.substring(0, 30) + (req.bookTitle.length > 30 ? '...' : ''), 
                                count: 0,
                                genre: bookDetails?.genre || 'Uncategorized'
                            };
                        }
                        borrowCounts[req.bookId].count++;
                        
                        const genre = borrowCounts[req.bookId].genre;
                        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                    }
                });
            }
            setTotalLoans(loans);
            setMostBorrowed(
                Object.values(borrowCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
            );
            setLoansByGenre(
                Object.entries(genreCounts).map(([name, count], index) => ({
                    name,
                    count,
                    fill: COLORS[index % COLORS.length]
                }))
            );
            setLoading(false);
        });
        
        // This is a simplified fetch as onValue should handle updates.
        const books: any[] = [];
        get(booksRef).then(snap => {
            if (snap.exists()) {
                const data = snap.val();
                Object.keys(data).forEach(id => books.push({id, ...data[id]}));
            }
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
            
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Most Borrowed Books</CardTitle>
                        <CardDescription>Top 10 most frequently borrowed books.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-[300px] w-full" /> : mostBorrowed.length > 0 ? (
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                 <BarChart data={mostBorrowed} margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} angle={-45} textAnchor="end" height={80}/>
                                    <YAxis />
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
                <Card>
                    <CardHeader>
                        <CardTitle>Loans by Genre</CardTitle>
                        <CardDescription>Distribution of borrowed books by genre.</CardDescription>
                    </CardHeader>
                    <CardContent>
                          {loading ? <Skeleton className="h-[300px] w-full" /> : loansByGenre.length > 0 ? (
                            <ChartContainer config={chartConfig} className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={loansByGenre} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                            {loansByGenre.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltipContent hideLabel />} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        ) : (
                             <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>No Data</AlertTitle>
                                <AlertDescription>No loan data available to show genre distribution.</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
