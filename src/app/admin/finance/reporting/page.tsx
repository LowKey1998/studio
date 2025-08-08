
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function FinanceReportingPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Finance Reporting</CardTitle>
                <CardDescription>Generate various financial statements and custom reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2 p-4 border rounded-lg">
                    <h3 className="font-semibold">Standard Reports</h3>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4"/><span>Income Statement</span></div>
                        <Button variant="outline" size="sm"><Download className="mr-2 h-4"/>Generate</Button>
                    </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4"/><span>Balance Sheet</span></div>
                        <Button variant="outline" size="sm"><Download className="mr-2 h-4"/>Generate</Button>
                    </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><FileText className="h-4 w-4"/><span>Cash Flow Statement</span></div>
                        <Button variant="outline" size="sm"><Download className="mr-2 h-4"/>Generate</Button>
                    </div>
                </div>
                 <div className="space-y-2 p-4 border rounded-lg">
                    <h3 className="font-semibold">Custom Report Generator</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Report Type</Label><Select><SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger><SelectContent><SelectItem value="revenue">Revenue by Programme</SelectItem><SelectItem value="expense">Expenses by Category</SelectItem></SelectContent></Select></div>
                         <div className="space-y-1"><Label>Date Range</Label><Select><SelectTrigger><SelectValue placeholder="Select range..."/></SelectTrigger><SelectContent><SelectItem value="monthly">This Month</SelectItem><SelectItem value="quarterly">This Quarter</SelectItem><SelectItem value="yearly">This Year</SelectItem></SelectContent></Select></div>
                    </div>
                     <Button className="mt-4"><Download className="mr-2 h-4"/>Generate Custom Report</Button>
                </div>
            </CardContent>
        </Card>
    );
}
