
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, User, Mail, Phone } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const mockPreceptors = [
    { id: 'PRE-001', name: 'Dr. Evelyn Reed', email: 'e.reed@clinic.com', phone: '123-456-7890' },
    { id: 'PRE-002', name: 'Dr. Marcus Thorne', email: 'm.thorne@hospital.org', phone: '098-765-4321' },
];

export default function PreceptorManagementPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Preceptor Management</CardTitle>
                    <CardDescription>Manage preceptor accounts, including creating logins and assigning them to students.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Add Preceptor</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockPreceptors.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.id}</TableCell>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.email}</TableCell>
                                <TableCell>{p.phone}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
