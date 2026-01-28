'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockReports = [
    { id: 1, type: 'ZESCO', month: 'October 2023', fileName: 'zesco_oct_2023.pdf' },
    { id: 2, type: 'LWSC', month: 'October 2023', fileName: 'lwsc_oct_2023.pdf' },
];

export default function UtilitiesPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>ZESCO & Water Reports</CardTitle>
                    <CardDescription>Upload and manage utility reports.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Upload Report</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Utility Provider</TableHead>
                            <TableHead>Month</TableHead>
                            <TableHead>File Name</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockReports.map(report => (
                             <TableRow key={report.id}>
                                <TableCell>{report.type}</TableCell>
                                <TableCell>{report.month}</TableCell>
                                <TableCell>{report.fileName}</TableCell>
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
