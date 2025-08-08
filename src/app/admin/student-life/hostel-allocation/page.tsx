
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const mockRooms = [
    { id: 1, hostel: 'Nelson Mandela', room: '101A', student: 'John Doe', studentId: 'STU-001' },
    { id: 2, hostel: 'Nelson Mandela', room: '101B', student: 'Jane Smith', studentId: 'STU-002' },
    { id: 3, hostel: 'Esther Lungu', room: '204A', student: 'Peter Jones', studentId: 'STU-003' },
];

export default function HostelAllocationPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Hostel Allocation</CardTitle>
                    <CardDescription>Manage hostel buildings, rooms, and student assignments.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Allocation</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Hostel</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Student ID</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockRooms.map(r => (
                             <TableRow key={r.id}>
                                <TableCell>{r.hostel}</TableCell>
                                <TableCell>{r.room}</TableCell>
                                <TableCell>{r.student}</TableCell>
                                <TableCell>{r.studentId}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
