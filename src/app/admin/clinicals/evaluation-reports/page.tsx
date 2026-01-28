
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EvaluationReportsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Evaluation Reports</CardTitle>
                <CardDescription>Generate and view summarized evaluation reports for students based on preceptor feedback and logbook entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex gap-4">
                    <Input placeholder="Search student name or ID..."/>
                    <Select>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select Rotation..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="peds">Pediatrics Q4 2023</SelectItem>
                            <SelectItem value="surgery">Surgery Q4 2023</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button><Search className="mr-2 h-4 w-4"/>Search</Button>
                </div>
                <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Generated Reports</h3>
                    <p className="text-sm text-muted-foreground">Search for a student to see available reports.</p>
                </div>
            </CardContent>
        </Card>
    );
}
