'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const mockLogs = [
    { id: 1, area: 'Library', date: new Date(), cleanedBy: 'Grounds Team A', status: 'Completed' },
    { id: 2, area: 'Lecture Hall 2', date: new Date(), cleanedBy: 'Grounds Team B', status: 'Completed' },
    { id: 3, area: 'Student Cafeteria', date: new Date(), cleanedBy: 'Grounds Team A', status: 'Scheduled' },
];

export default function CleaningLogsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Cleaning Logs</CardTitle>
                    <CardDescription>Log and track cleaning schedules for different areas.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Cleaning Log</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Area/Location</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Cleaned By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockLogs.map(log => (
                             <TableRow key={log.id}>
                                <TableCell>{log.area}</TableCell>
                                <TableCell>{format(log.date, 'PPP')}</TableCell>
                                <TableCell>{log.cleanedBy}</TableCell>
                                <TableCell><Badge variant={log.status === 'Completed' ? 'default' : 'secondary'}>{log.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    {log.status !== 'Completed' && <Button variant="outline" size="sm"><Check className="mr-2 h-4 w-4" />Mark as Complete</Button>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
