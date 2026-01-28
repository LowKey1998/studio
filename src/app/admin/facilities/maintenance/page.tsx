'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const mockRequests = [
    { id: 1, location: 'Library, 2nd Floor', issue: 'Leaking ceiling tile', status: 'Pending', reportedBy: 'N. Hurley' },
    { id: 2, location: 'Lab 3', issue: 'Projector bulb burnt out', status: 'In Progress', reportedBy: 'D. Cooper' },
    { id: 3, location: 'Hostel A, Room 101', issue: 'Broken window latch', status: 'Completed', reportedBy: 'L. Palmer' },
];

export default function MaintenancePage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Maintenance Requests</CardTitle>
                    <CardDescription>Track and manage all facility maintenance requests.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Request</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Location</TableHead>
                            <TableHead>Issue</TableHead>
                            <TableHead>Reported By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockRequests.map(req => (
                             <TableRow key={req.id}>
                                <TableCell>{req.location}</TableCell>
                                <TableCell>{req.issue}</TableCell>
                                <TableCell>{req.reportedBy}</TableCell>
                                <TableCell><Badge variant={req.status === 'Completed' ? 'default' : 'secondary'}>{req.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">View Details</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
