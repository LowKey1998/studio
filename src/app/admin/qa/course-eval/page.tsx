
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';

const mockEvals = [
    { id: 1, course: 'Calculus II', code: 'MATH-201', avgRating: 4.5, responses: 28 },
    { id: 2, course: 'Introduction to Physics', code: 'PHY-101', avgRating: 4.2, responses: 35 },
];

export default function CourseEvaluationPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Course Evaluation Results</CardTitle>
                <CardDescription>View aggregated results from student course evaluations.</CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search course by name or code..." className="pl-8" />
                </div>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Avg. Rating (out of 5)</TableHead>
                            <TableHead>Responses</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockEvals.map(ev => (
                             <TableRow key={ev.id}>
                                <TableCell>{ev.course} ({ev.code})</TableCell>
                                <TableCell>{ev.avgRating.toFixed(1)}</TableCell>
                                <TableCell>{ev.responses}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm"><BarChart2 className="mr-2 h-4 w-4" />View Detailed Report</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
