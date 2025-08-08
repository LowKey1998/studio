
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockDecks = [
    { id: 1, title: 'AI Chatbot Pitch', student: 'Jane Doe', date: '2023-11-20' },
];

export default function PitchDeckRepositoryPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Pitch Deck Repository</CardTitle>
                <CardDescription>A central place to store and review student pitch decks.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Deck Title</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Date Uploaded</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockDecks.map(deck => (
                            <TableRow key={deck.id}>
                                <TableCell>{deck.title}</TableCell>
                                <TableCell>{deck.student}</TableCell>
                                <TableCell>{deck.date}</TableCell>
                                <TableCell className="text-right"><Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4"/>Download</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
