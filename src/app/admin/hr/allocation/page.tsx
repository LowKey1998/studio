'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockAllocations = [
    { id: 1, employee: 'Bobby Briggs', role: 'Lecturer', department: 'Sociology' },
    { id: 2, employee: 'Nadine Hurley', role: 'Librarian', department: 'Library' },
    { id: 3, employee: 'Ben Horne', role: 'Accountant', department: 'Finance' },
];

export default function StaffAllocationPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Staff Allocation</CardTitle>
                <CardDescription>Manage staff assignments to different departments or projects.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockAllocations.map(a => (
                             <TableRow key={a.id}>
                                <TableCell>{a.employee}</TableCell>
                                <TableCell>{a.role}</TableCell>
                                <TableCell>{a.department}</TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">Re-allocate</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
