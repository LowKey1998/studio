
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const mockTrainings = [
    { id: 1, title: 'Advanced Excel for Accountants', date: '2023-10-20', attendees: 5, status: 'Completed' },
    { id: 2, title: 'Student Counseling Best Practices', date: '2023-11-25', attendees: 12, status: 'Scheduled' },
];

export default function TrainingLogsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Training Logs</CardTitle>
                    <CardDescription>Log and track staff training and development programs.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Training</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Training Title</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Attendees</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {mockTrainings.map(t => (
                            <TableRow key={t.id}>
                                <TableCell>{t.title}</TableCell>
                                <TableCell>{t.date}</TableCell>
                                <TableCell>{t.attendees}</TableCell>
                                <TableCell><Badge variant={t.status === 'Completed' ? 'default' : 'secondary'}>{t.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Manage</Button></TableCell>
                            </TableRow>
                       ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
