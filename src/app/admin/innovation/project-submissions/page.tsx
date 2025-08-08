
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const mockProjects = [
    { id: 'PROJ-001', title: 'AI-Powered Student Support Chatbot', student: 'Jane Doe', status: 'Pending Review' },
    { id: 'PROJ-002', title: 'Sustainable Campus Irrigation System', student: 'John Smith', status: 'Approved' },
];

export default function ProjectSubmissionsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Innovation Project Submissions</CardTitle>
                    <CardDescription>Review and manage student submissions for innovation projects.</CardDescription>
                </div>
                <Button disabled><PlusCircle className="mr-2 h-4 w-4"/> New Project Call</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project Title</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockProjects.map(project => (
                            <TableRow key={project.id}>
                                <TableCell>{project.title}</TableCell>
                                <TableCell>{project.student}</TableCell>
                                <TableCell><Badge variant={project.status === 'Approved' ? 'default' : 'secondary'}>{project.status}</Badge></TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm">View Submission</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
