
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AdmissionConfirmationPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Admission Confirmation</CardTitle>
                        <CardDescription>Track which students have confirmed their admission and paid any required deposits.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Offer Status</TableHead>
                            <TableHead>Deposit Paid</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                No data available.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
