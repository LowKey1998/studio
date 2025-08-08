
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WelfareReportsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Welfare Reports</CardTitle>
                <CardDescription>Generate reports on various student welfare metrics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select Report Type..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="counseling">Counseling Session Summary</SelectItem>
                            <SelectItem value="complaints">Complaint Analysis</SelectItem>
                        </SelectContent>
                    </Select>
                     <Button><FileText className="mr-2 h-4 w-4"/>Generate Report</Button>
                </div>
                <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Generated Reports</h3>
                    <p className="text-sm text-muted-foreground">Select a report type to generate a new report.</p>
                </div>
            </CardContent>
        </Card>
    );
}
