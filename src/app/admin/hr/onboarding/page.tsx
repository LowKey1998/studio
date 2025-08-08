
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, UserPlus, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const mockOnboarding = [
    { id: 1, employee: 'Laura Palmer', role: 'Accountant', status: 'In Progress', progress: 60 },
    { id: 2, employee: 'Dale Cooper', role: 'Lecturer', status: 'Completed', progress: 100 },
    { id: 3, employee: 'Audrey Horne', role: 'Registrar Assistant', status: 'Not Started', progress: 0 },
];

export default function OnboardingPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Digital Onboarding</CardTitle>
                    <CardDescription>Manage the onboarding process for new staff members.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Start Onboarding</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[200px]">Progress</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockOnboarding.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.employee}</TableCell>
                                <TableCell>{item.role}</TableCell>
                                <TableCell><Badge variant={item.status === 'Completed' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                                <TableCell><Progress value={item.progress} /></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">View Checklist</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
