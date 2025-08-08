
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Book } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockLogs = [
    { id: 1, event: 'Fintech Hackathon 2023', student: 'Jane Doe', project: 'Budgeting App' },
    { id: 2, event: 'Health Tech Challenge', student: 'John Smith', project: 'Medication Reminder' },
];

export default function HackathonLogsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Hackathon Participation Logs</CardTitle>
                <CardDescription>Keep a record of student participation in internal and external hackathons.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Project</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockLogs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{log.event}</TableCell>
                                <TableCell>{log.student}</TableCell>
                                <TableCell>{log.project}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
