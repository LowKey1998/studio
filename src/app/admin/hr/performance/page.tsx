
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';

const mockReviews = [
    { id: 1, employee: 'Leland Palmer', role: 'Chief Accountant', lastReview: '2023-06-15', nextReview: '2024-06-15' },
    { id: 2, employee: 'Shelly Johnson', role: 'Admissions Officer', lastReview: '2023-09-01', nextReview: '2024-09-01' },
];

export default function PerformancePage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Performance Appraisals</CardTitle>
                    <CardDescription>Schedule and manage staff performance reviews.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Schedule Review</Button>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Last Review</TableHead>
                            <TableHead>Next Review</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockReviews.map(review => (
                             <TableRow key={review.id}>
                                <TableCell>{review.employee}</TableCell>
                                <TableCell>{review.role}</TableCell>
                                <TableCell>{format(new Date(review.lastReview), 'PPP')}</TableCell>
                                <TableCell>{format(new Date(review.nextReview), 'PPP')}</TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">View History</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
