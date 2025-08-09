
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const mockAppeals = [
    {id: 1, studentId: 'STU-001', studentName: 'Jane Doe', course: 'Calculus II', date: '2023-05-20', status: 'Pending'},
    {id: 2, studentId: 'STU-002', studentName: 'John Smith', course: 'Physics I', date: '2023-05-21', status: 'Reviewed'},
]

export default function StudentAppealsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Appeals Tracking</CardTitle>
                <CardDescription>Manage and track academic appeals submitted by students regarding their grades.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockAppeals.map(appeal => (
                            <TableRow key={appeal.id}>
                                <TableCell><div>{appeal.studentName}</div><div className="text-xs text-muted-foreground">{appeal.studentId}</div></TableCell>
                                <TableCell>{appeal.course}</TableCell>
                                <TableCell>{appeal.date}</TableCell>
                                <TableCell><Badge variant={appeal.status === 'Pending' ? 'destructive' : 'default'}>{appeal.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Review Appeal</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
    );
}

