
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export default function WelfareReportsPage() {
    const [reportType, setReportType] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const { toast } = useToast();

    const generateReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'complaints') {
                const complaintsRef = ref(db, 'complaints');
                const snapshot = await get(complaintsRef);
                const data = snapshot.val() || {};
                const doc = new jsPDF();
                doc.text("Student Complaints Report", 14, 22);
                (doc as any).autoTable({
                    head: [['Date', 'Student', 'Type', 'Status']],
                    body: Object.values(data).map((c: any) => [format(new Date(c.date), 'PPP'), c.studentName, c.type, c.status])
                });
                doc.save('complaints_report.pdf');
            } else if (reportType === 'clubs') {
                 const clubsRef = ref(db, 'clubs');
                const snapshot = await get(clubsRef);
                const data = snapshot.val() || {};
                const doc = new jsPDF();
                doc.text("Clubs & Associations Report", 14, 22);
                (doc as any).autoTable({
                    head: [['Club Name', 'Members']],
                    body: Object.values(data).map((c: any) => [c.name, Object.keys(c.members || {}).length])
                });
                doc.save('clubs_report.pdf');
            } else {
                toast({ variant: 'destructive', title: "Select a report type first." });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: "Failed to generate report" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Welfare Reports</CardTitle>
                <CardDescription>Generate reports on various student welfare metrics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select Report Type..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="complaints">Complaints Summary</SelectItem>
                            <SelectItem value="clubs">Club Membership Summary</SelectItem>
                        </SelectContent>
                    </Select>
                     <Button onClick={generateReport} disabled={loading}><FileText className="mr-2 h-4 w-4"/>Generate Report</Button>
                </div>
            </CardContent>
        </Card>
    );
}
