
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const mockAccreditations = [
    { id: 1, body: 'Health Professions Council of Zambia (HPCZ)', program: 'BSc. in Clinical Medicine', status: 'Accredited', expiry: '2025-12-31' },
    { id: 2, body: 'Higher Education Authority (HEA)', program: 'All Programmes', status: 'Under Review', expiry: 'N/A' },
];

export default function AccreditationPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Accreditation Tracker</CardTitle>
                    <CardDescription>Track the status of all institutional and programmatic accreditations.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Add Accreditation</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Accrediting Body</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expiry Date</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockAccreditations.map(acc => (
                             <TableRow key={acc.id}>
                                <TableCell>{acc.body}</TableCell>
                                <TableCell>{acc.program}</TableCell>
                                <TableCell><Badge variant={acc.status === 'Accredited' ? 'default' : 'secondary'}>{acc.status}</Badge></TableCell>
                                <TableCell>{acc.expiry !== 'N/A' ? format(new Date(acc.expiry), 'PPP') : 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" />View Documents</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
