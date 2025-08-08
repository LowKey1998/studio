
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const mockDeferrals = [
    { id: 1, student: 'Alice Johnson', date: '2023-11-12', status: 'Pending Review' },
    { id: 2, student: 'Bob Williams', date: '2023-09-30', status: 'Approved' },
];

export default function MedicalDeferralsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Medical Deferrals</CardTitle>
                <CardDescription>Track and manage student requests for medical deferrals.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Date Requested</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockDeferrals.map(d => (
                             <TableRow key={d.id}>
                                <TableCell>{d.student}</TableCell>
                                <TableCell>{d.date}</TableCell>
                                <TableCell><Badge variant={d.status === 'Approved' ? 'default' : 'secondary'}>{d.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Review</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
