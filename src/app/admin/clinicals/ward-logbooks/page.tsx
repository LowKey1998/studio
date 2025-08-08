
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const mockLogbooks = [
    { id: 1, student: 'Alice Johnson', ward: 'Pediatrics', date: '2023-10-26', status: 'Pending Review' },
    { id: 2, student: 'Bob Williams', ward: 'Surgery', date: '2023-10-25', status: 'Approved' },
    { id: 3, student: 'Charlie Brown', ward: 'Maternity', date: '2023-10-24', status: 'Approved' },
];

export default function WardLogbooksPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ward Logbooks</CardTitle>
                <CardDescription>Review, comment on, and approve digital logbooks submitted by students for their activities in various wards.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Ward</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockLogbooks.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{log.student}</TableCell>
                                <TableCell>{log.ward}</TableCell>
                                <TableCell>{log.date}</TableCell>
                                <TableCell><Badge variant={log.status === 'Approved' ? 'default' : 'secondary'}>{log.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4"/>View Log</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
