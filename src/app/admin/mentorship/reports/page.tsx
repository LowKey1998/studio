
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function AdvisoryReportsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Advisory Reports</CardTitle>
                <CardDescription>Generate reports on mentorship activities and student engagement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2 p-4 border rounded-lg">
                    <h3 className="font-semibold">Generate Report</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Report Type</Label>
                            <Select>
                                <SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="summary">Advisor-Student Interaction Summary</SelectItem>
                                    <SelectItem value="unassigned">Students without Advisors</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1">
                             <Label>Date Range</Label>
                            <Select>
                                <SelectTrigger><SelectValue placeholder="Select range..."/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">This Month</SelectItem>
                                    <SelectItem value="quarterly">This Quarter</SelectItem>
                                    <SelectItem value="yearly">This Year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <Button className="mt-4"><Download className="mr-2 h-4"/>Generate Report</Button>
                </div>
            </CardContent>
        </Card>
    );
}
