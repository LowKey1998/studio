
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle } from "lucide-react";

export default function PayablesPage() {
    const payables = [
        { id: 'P01', vendor: 'City Office Supplies', dueDate: '2023-11-30', amount: 1250.00, status: 'Due' },
        { id: 'P02', name: 'Campus Internet Services', dueDate: '2023-12-15', amount: 5500.00, status: 'Upcoming' },
    ];

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Accounts Payables</CardTitle>
                    <CardDescription>Track and manage all money owed by the institution to its suppliers.</CardDescription>
                </div>
                 <Button><PlusCircle className="mr-2 h-4"/>Add Payable</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount (ZMW)</TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {payables.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.vendor}</TableCell>
                                <TableCell>{item.dueDate}</TableCell>
                                <TableCell><Badge variant={item.status === 'Due' ? 'destructive' : 'secondary'}>{item.status}</Badge></TableCell>
                                <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
