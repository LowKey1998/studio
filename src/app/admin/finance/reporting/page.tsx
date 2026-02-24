'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, TrendingUp, TrendingDown, DollarSign, GraduationCap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function FinanceReportingPage() {
    const [loading, setLoading] = React.useState(false);
    const [reportType, setReportType] = React.useState('income');
    const { toast } = useToast();

    const generateReport = async () => {
        setLoading(true);
        try {
            const [txSnap, expSnap, invSnap, usersSnap, scholSnap] = await Promise.all([
                get(ref(db, 'transactions')),
                get(ref(db, 'expenses')),
                get(ref(db, 'invoices')),
                get(ref(db, 'users')),
                get(ref(db, 'scholarships'))
            ]);

            const transactions = Object.values(txSnap.val() || {}).filter((t: any) => t.status === 'successful');
            const expenses = Object.values(expSnap.val() || {});
            const allUsers = usersSnap.val() || {};
            const allSchols = scholSnap.val() || {};
            
            const doc = new jsPDF();
            doc.setFontSize(20);
            const reportTitle = reportType === 'income' ? 'Income Statement' 
                : (reportType === 'cashflow' ? 'Cash Flow Report' 
                : (reportType === 'scholarships' ? 'Scholarship Recipients Report' : 'Revenue Summary'));
            
            doc.text(reportTitle, 14, 22);
            doc.setFontSize(10);
            doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

            if (reportType === 'income') {
                const totalIncome = transactions.reduce((sum, t: any) => sum + t.amount, 0);
                const totalExpenses = expenses.reduce((sum, e: any) => sum + e.amount, 0);
                
                (doc as any).autoTable({
                    startY: 40,
                    head: [['Category', 'Amount (ZMW)']],
                    body: [
                        ['Total Student Payments', totalIncome.toFixed(2)],
                        ['Total Operating Expenses', `(${totalExpenses.toFixed(2)})`],
                        ['Net Surplus / (Deficit)', (totalIncome - totalExpenses).toFixed(2)]
                    ],
                    theme: 'striped',
                    headStyles: { fillColor: [34, 34, 34] },
                    styles: { fontStyle: 'bold' }
                });
            } else if (reportType === 'revenue') {
                 (doc as any).autoTable({
                    startY: 40,
                    head: [['Date', 'Transaction ID', 'Amount (ZMW)', 'Method']],
                    body: transactions.map((t: any) => [format(new Date(t.paymentDate), 'MMM dd, yyyy'), t.transactionId, t.amount.toFixed(2), t.method || 'Online']),
                    theme: 'grid'
                });
            } else if (reportType === 'scholarships') {
                const recipients = Object.keys(allUsers)
                    .filter(uid => allUsers[uid].scholarshipId)
                    .map(uid => {
                        const u = allUsers[uid];
                        const s = allSchols[u.scholarshipId];
                        return [u.id, u.name, s?.name || 'Unknown', `${s?.percentage || 0}%`, s?.donor || '-'];
                    });

                (doc as any).autoTable({
                    startY: 40,
                    head: [['Student ID', 'Name', 'Scholarship Name', 'Waiver %', 'Donor/Sponsor']],
                    body: recipients,
                    theme: 'striped',
                    headStyles: { fillColor: [41, 128, 185] }
                });
            }

            doc.save(`${reportType}_report_${Date.now()}.pdf`);
            toast({ title: 'Report Generated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to generate report' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Financial Reporting Hub</CardTitle>
                <CardDescription>Generate and download comprehensive financial statements and data summaries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Income</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="text-green-600"/> Analysis Ready</div></CardContent>
                    </Card>
                    <Card className="bg-destructive/5 border-destructive/20">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold flex items-center gap-2"><TrendingDown className="text-red-600"/> Tracking Active</div></CardContent>
                    </Card>
                    <Card className="bg-blue-500/5 border-blue-500/20">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Scholarships</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="text-blue-600"/> Waiver Logs</div></CardContent>
                    </Card>
                </div>

                <div className="space-y-4 p-6 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold text-lg">Generate Official Document</h3>
                    <div className="grid md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>Select Statement Type</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="income">Income Statement (P&L)</SelectItem>
                                    <SelectItem value="revenue">Detailed Revenue Log</SelectItem>
                                    <SelectItem value="scholarships">Scholarship Recipients List</SelectItem>
                                    <SelectItem value="cashflow">Cash Flow Projection</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full" onClick={generateReport} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            Generate & Download PDF
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}