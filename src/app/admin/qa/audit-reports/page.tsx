'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';

const mockReports = [
    { id: 1, title: 'Q3 2023 Financial Audit', date: '2023-10-15', department: 'Finance' },
    { id: 2, title: 'Annual Academic Quality Review', date: '2023-09-01', department: 'Academics' },
];

export default function AuditReportsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Internal Audit Reports</CardTitle>
                    <CardDescription>Upload and manage internal and external audit reports.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Upload Report</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Report Title</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockReports.map(report => (
                             <TableRow key={report.id}>
                                <TableCell>{report.title}</TableCell>
                                <TableCell>{report.department}</TableCell>
                                <TableCell>{format(new Date(report.date), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Download</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
