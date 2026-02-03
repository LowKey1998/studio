
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Search, Download, FileText, Loader2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

type Evaluation = { id: string; studentName: string; studentId: string; rotation: string; preceptor: string; score: number; date: string; };

export default function EvaluationReportsPage() {
    const [evaluations, setEvaluations] = React.useState<Evaluation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        const fetchEvals = async () => {
            const snap = await get(ref(db, 'clinicals/evaluations'));
            setEvaluations(snap.exists() ? Object.keys(snap.val()).map(id => ({ id, ...snap.val()[id] })) : []);
            setLoading(false);
        };
        fetchEvals();
    }, []);

    const handleDownloadReport = (evalData: Evaluation) => {
        const doc = new jsPDF();
        doc.setFontSize(20); doc.text("Clinical Evaluation Report", 14, 22);
        doc.setFontSize(12);
        doc.text(`Student: ${evalData.studentName} (${evalData.studentId})`, 14, 35);
        doc.text(`Rotation: ${evalData.rotation}`, 14, 42);
        doc.text(`Preceptor: ${evalData.preceptor}`, 14, 49);
        doc.text(`Score: ${evalData.score}/100`, 14, 56);
        doc.text(`Date: ${format(new Date(evalData.date), 'PPP')}`, 14, 63);
        doc.save(`Evaluation_${evalData.studentId}_${evalData.rotation}.pdf`);
    };

    const filtered = evaluations.filter(e => e.studentName.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Clinical Evaluation Reports</CardTitle>
                <CardDescription>Summarized clinical performance data based on preceptor feedback.</CardDescription>
                <div className="pt-4 relative">
                    <Search className="absolute left-2.5 top-6.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by student name..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Rotation</TableHead>
                            <TableHead className="text-center">Score</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                         filtered.map(e => (
                            <TableRow key={e.id}>
                                <TableCell className="font-bold">{e.studentName}</TableCell>
                                <TableCell>{e.rotation}</TableCell>
                                <TableCell className="text-center">{e.score}%</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadReport(e)}><Download className="mr-2 h-4 w-4"/> PDF</Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
