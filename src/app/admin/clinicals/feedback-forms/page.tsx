
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const mockForms = [
    { id: 'F01', title: 'Mid-Rotation Student Evaluation', description: 'Standard form for preceptors to evaluate students mid-way through a rotation.' },
    { id: 'F02', title: 'Final Clinical Skills Assessment', description: 'Final assessment of practical skills at the end of a clinical placement.' },
];

export default function FeedbackFormsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Feedback Forms</CardTitle>
                    <CardDescription>Create and manage customizable feedback forms for evaluating student performance.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Create Form</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Form Title</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockForms.map(form => (
                            <TableRow key={form.id}>
                                <TableCell>{form.title}</TableCell>
                                <TableCell>{form.description}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
