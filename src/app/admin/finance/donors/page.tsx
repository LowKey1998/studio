
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle } from "lucide-react";

export default function DonorFundTrackingPage() {
    const donors = [
        { id: 'D01', name: 'Global Education Fund', amount: 250000, date: '2023-01-15' },
        { id: 'D02', name: 'Alumni Association', amount: 75000, date: '2023-03-01' },
    ];

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>Donor Fund Tracking</CardTitle>
                    <CardDescription>Manage and report on funds received from donors.</CardDescription>
                </div>
                 <Button><PlusCircle className="mr-2 h-4"/>Add Donation</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Donor</TableHead>
                            <TableHead>Date Received</TableHead>
                            <TableHead className="text-right">Amount (ZMW)</TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {donors.map(donor => (
                            <TableRow key={donor.id}>
                                <TableCell>{donor.name}</TableCell>
                                <TableCell>{donor.date}</TableCell>
                                <TableCell className="text-right">{donor.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
