
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, UserCog } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockCommittee = [
    { id: 1, name: 'Prof. Albus Dumbledore', role: 'Head of Innovation' },
    { id: 2, name: 'Dr. Ian Malcolm', role: 'External Industry Expert' },
];

export default function EvaluationCommitteePage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Innovation Evaluation Committee</CardTitle>
                    <CardDescription>Manage members of the committee responsible for evaluating projects.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Add Member</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockCommittee.map(member => (
                            <TableRow key={member.id}>
                                <TableCell>{member.name}</TableCell>
                                <TableCell>{member.role}</TableCell>
                                <TableCell className="text-right"><Button variant="destructive" size="sm">Remove</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
