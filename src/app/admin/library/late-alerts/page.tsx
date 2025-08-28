
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { AlertTriangle, Bell, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type LateLoan = {
    requestId: string;
    bookTitle: string;
    userName: string;
    dueDate: string;
    daysOverdue: number;
    userPhone?: string;
};

export default function LateAlertsPage() {
    const [lateLoans, setLateLoans] = React.useState<LateLoan[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const requestsRef = ref(db, 'bookRequests');
        const usersRef = ref(db, 'users');

        const fetchData = async () => {
            const usersSnapshot = await get(usersRef);
            const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};

            onValue(requestsRef, (snapshot) => {
                const late: LateLoan[] = [];
                if (snapshot.exists()) {
                    const requests = snapshot.val();
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    for (const id in requests) {
                        const req = requests[id];
                        if (req.status === 'Checked Out' && req.dueDate) {
                            const dueDate = parseISO(req.dueDate);
                            if (isBefore(dueDate, today)) {
                                late.push({
                                    requestId: id,
                                    bookTitle: req.bookTitle,
                                    userName: req.userName,
                                    dueDate: req.dueDate,
                                    daysOverdue: differenceInDays(today, dueDate),
                                    userPhone: usersData[req.userId]?.phoneNumber,
                                });
                            }
                        }
                    }
                }
                setLateLoans(late.sort((a,b) => b.daysOverdue - a.daysOverdue));
                setLoading(false);
            });
        };

        fetchData();
    }, []);
    

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle/>Late Returns</CardTitle>
                <CardDescription>A list of all books that are currently overdue.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Book Title</TableHead>
                            <TableHead>Borrower</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-center">Days Overdue</TableHead>
                            <TableHead className="text-right">Contact</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10"/></TableCell></TableRow>
                            ))
                        ) : lateLoans.length > 0 ? (
                           lateLoans.map(loan => (
                            <TableRow key={loan.requestId}>
                                <TableCell>{loan.bookTitle}</TableCell>
                                <TableCell>{loan.userName}</TableCell>
                                <TableCell>{format(parseISO(loan.dueDate), 'PPP')}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="destructive">{loan.daysOverdue}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={`tel:${loan.userPhone}`}>
                                            <Phone className="mr-2 h-4 w-4"/> Call
                                        </a>
                                    </Button>
                                </TableCell>
                            </TableRow>
                           ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-48">
                                     <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <h3 className="mt-4 text-lg font-semibold">All Books Returned</h3>
                                    <p className="mt-2 text-sm text-muted-foreground">There are no overdue books at the moment.</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
