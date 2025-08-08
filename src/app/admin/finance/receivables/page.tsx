
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle } from "lucide-react";

export default function ReceivablesPage() {
    const receivables = [
        { id: 'R01', student: 'Jane Smith', dueDate: '2023-11-20', amount: 8500.00, status: 'Overdue' },
        { id: 'R02', student: 'John Doe', dueDate: '2023-12-01', amount: 8500.00, status: 'Due' },
    ];

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Accounts Receivables</CardTitle>
                    <CardDescription>A detailed view of all outstanding invoices and payments due.</CardDescription>
                </div>
                 <Button><PlusCircle className="mr-2 h-4"/>Add Receivable</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount (ZMW)</TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {receivables.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.student}</TableCell>
                                <TableCell>{item.dueDate}</TableCell>
                                <TableCell><Badge variant={item.status === 'Overdue' ? 'destructive' : 'secondary'}>{item.status}</Badge></TableCell>
                                <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
