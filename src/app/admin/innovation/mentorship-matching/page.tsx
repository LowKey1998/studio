
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const mockStudents = [{ id: 1, name: 'Jane Doe' }];
const mockMentors = [{ id: 'A', name: 'Dr. Alan Grant' }, { id: 'B', name: 'Dr. Ellie Sattler' }];

export default function MentorshipMatchingPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Mentorship Matching</CardTitle>
                <CardDescription>Assign industry or academic mentors to student innovators.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student Innovator</TableHead>
                            <TableHead>Assigned Mentor</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockStudents.map(student => (
                            <TableRow key={student.id}>
                                <TableCell>{student.name}</TableCell>
                                <TableCell>
                                    <Select>
                                        <SelectTrigger><SelectValue placeholder="Assign a mentor..."/></SelectTrigger>
                                        <SelectContent>
                                            {mockMentors.map(mentor => <SelectItem key={mentor.id} value={mentor.id}>{mentor.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right"><Button>Save</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
