'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockAssets = [
    { id: 'ASSET-001', name: 'Projector', location: 'Lecture Hall 1', status: 'Operational' },
    { id: 'ASSET-002', name: 'Student Desks', location: 'Room 203', status: 'Operational', quantity: 30 },
    { id: 'ASSET-003', name: 'Microscope', location: 'Biology Lab', status: 'Under Maintenance', quantity: 15 },
];

export default function AssetsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Classroom & Lab Assets</CardTitle>
                    <CardDescription>Keep an inventory of all assets in classrooms and labs.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Add Asset</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Asset ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockAssets.map(asset => (
                             <TableRow key={asset.id}>
                                <TableCell>{asset.id}</TableCell>
                                <TableCell>{asset.name}</TableCell>
                                <TableCell>{asset.location}</TableCell>
                                <TableCell>{asset.quantity || 1}</TableCell>
                                <TableCell>{asset.status}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
