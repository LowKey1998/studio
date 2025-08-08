
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const mockProjects = [{ id: 1, name: 'AI Chatbot', student: 'Jane Doe' }];
const mockInvestors = [{ id: 'A', name: 'Venture Capital Inc.' }, { id: 'B', name: 'Angel Investors Group' }];

export default function InvestorMatchingPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Investor Matching Tools</CardTitle>
                <CardDescription>Connect promising student projects with potential investors.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project / Startup</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Potential Investor</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockProjects.map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.name}</TableCell>
                                <TableCell>{p.student}</TableCell>
                                <TableCell>
                                    <Select>
                                        <SelectTrigger><SelectValue placeholder="Match an investor..."/></SelectTrigger>
                                        <SelectContent>
                                            {mockInvestors.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right"><Button><Handshake className="mr-2 h-4 w-4"/>Initiate Introduction</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
