
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Users, Calendar, ClipboardList } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function AdvisoryReportsPage() {
    const [loading, setLoading] = React.useState(false);
    const [reportType, setReportType] = React.useState('summary');
    const { toast } = useToast();

    const generateReport = async () => {
        setLoading(true);
        try {
            const [logsSnap, usersSnap] = await Promise.all([
                get(ref(db, 'mentorshipLogs')),
                get(ref(db, 'users'))
            ]);

            const logsData = logsSnap.val() || {};
            const usersData = usersSnap.val() || {};
            
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text("Advisory & Mentorship Report", 14, 22);
            doc.setFontSize(10);
            doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 30);

            const tableRows: any[] = [];
            
            Object.entries(logsData).forEach(([studentUid, logs]: [string, any]) => {
                const student = usersData[studentUid] || { name: 'Unknown' };
                Object.values(logs).forEach((log: any) => {
                    const advisor = usersData[log.advisorId] || { name: 'Unknown' };
                    tableRows.push([
                        format(new Date(log.date), 'MMM dd, yyyy'),
                        student.name,
                        advisor.name,
                        log.notes.substring(0, 50) + (log.notes.length > 50 ? '...' : '')
                    ]);
                });
            });

            (doc as any).autoTable({
                startY: 40,
                head: [['Date', 'Student', 'Advisor', 'Summary']],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });

            doc.save(`Mentorship_Report_${Date.now()}.pdf`);
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
                <CardTitle>Advisory Data Center</CardTitle>
                <CardDescription>Analyze mentorship engagement and generate activity reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4"/> Students Assigned</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">Comprehensive</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4"/> Sessions Logged</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">Historical</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><ClipboardList className="h-4 w-4"/> Progress Tracking</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">Qualitative</div></CardContent>
                    </Card>
                </div>

                <div className="p-6 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold mb-4">Report Generator</h3>
                    <div className="grid md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>Report Scope</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="summary">Full Session Summary</SelectItem>
                                    <SelectItem value="stats">Engagement Stats</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button className="w-full" onClick={generateReport} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            Export PDF Report
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
