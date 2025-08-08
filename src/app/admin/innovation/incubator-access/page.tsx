
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, KeyRound } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const mockAccess = [
    { id: 1, student: 'Jane Doe', project: 'AI Chatbot', status: 'Active' },
    { id: 2, student: 'Richard Roe', project: 'Campus App', status: 'Graduated' },
];

export default function IncubatorAccessPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Innovation Incubator Access</CardTitle>
                    <CardDescription>Manage student and project access to the incubator program.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Grant Access</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockAccess.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.student}</TableCell>
                                <TableCell>{item.project}</TableCell>
                                <TableCell><Badge variant={item.status === 'Active' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Manage Access</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
