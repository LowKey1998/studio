
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const mockPlacements = [
    { id: 1, student: 'David Smith', location: 'Chilenje Clinic', from: '2023-11-01', to: '2023-11-30' },
    { id: 2, student: 'Emily Jones', location: 'Matero Reference Health Centre', from: '2023-11-01', to: '2023-11-30' },
];

export default function CommunityPlacementPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Community Placement</CardTitle>
                    <CardDescription>Manage student placements in community health settings, including tracking locations and durations.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Placement</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>From</TableHead>
                            <TableHead>To</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockPlacements.map(p => (
                             <TableRow key={p.id}>
                                <TableCell>{p.student}</TableCell>
                                <TableCell>{p.location}</TableCell>
                                <TableCell>{p.from}</TableCell>
                                <TableCell>{p.to}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
