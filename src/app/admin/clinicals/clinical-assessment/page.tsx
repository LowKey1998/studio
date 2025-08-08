
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


export default function ClinicalAssessmentReportsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Final Clinical Assessment Reports</CardTitle>
                <CardDescription>Compile all evaluation data into a final report for each student's academic record.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select Student..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="alice">Alice Johnson</SelectItem>
                            <SelectItem value="bob">Bob Williams</SelectItem>
                        </SelectContent>
                    </Select>
                     <Button><FileText className="mr-2 h-4 w-4"/>Generate Report</Button>
                </div>

                <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Generated Reports</h3>
                    <div className="flex justify-between items-center p-2 rounded-md hover:bg-muted">
                        <p>Alice_Johnson_Clinical_Assessment_2023.pdf</p>
                        <Button variant="outline" size="sm"><Download className="mr-2 h-4"/>Download</Button>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
