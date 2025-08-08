
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const mockIP = [
    { id: 1, project: 'AI Chatbot', type: 'Copyright', status: 'Filed' },
    { id: 2, project: 'Irrigation System', type: 'Patent', status: 'Pending' },
];

export default function IPTrackerPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Intellectual Property Tracker</CardTitle>
                <CardDescription>Track the status of IP registrations for student innovations.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>IP Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockIP.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.project}</TableCell>
                                <TableCell>{item.type}</TableCell>
                                <TableCell><Badge>{item.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Update Status</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
