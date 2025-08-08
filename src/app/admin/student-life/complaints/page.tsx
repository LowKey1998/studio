
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const mockComplaints = [
    { id: 1, student: 'Grace Field', type: 'Academic', date: '2023-11-15', status: 'Pending Review' },
    { id: 2, student: 'Henry Ives', type: 'Facility', date: '2023-11-10', status: 'Resolved' },
];

export default function ComplaintsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Complaint Submissions</CardTitle>
                <CardDescription>View, manage, and resolve student-submitted complaints.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockComplaints.map(c => (
                             <TableRow key={c.id}>
                                <TableCell>{c.student}</TableCell>
                                <TableCell>{c.type}</TableCell>
                                <TableCell>{c.date}</TableCell>
                                <TableCell><Badge variant={c.status === 'Resolved' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">View</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
