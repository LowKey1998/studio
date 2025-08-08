
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const mockRequests = [
    { id: 1, student: 'Michael Phiri', date: '2023-11-20', status: 'Pending' },
    { id: 2, student: 'Sarah Banda', date: '2023-10-05', status: 'Approved' },
];

export default function LeaveOfAbsencePage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Leave of Absence</CardTitle>
                <CardDescription>Manage and track student requests for leave of absence.</CardDescription>
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
                        {mockRequests.map(r => (
                             <TableRow key={r.id}>
                                <TableCell>{r.student}</TableCell>
                                <TableCell>{r.date}</TableCell>
                                <TableCell><Badge variant={r.status === 'Approved' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Review</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
