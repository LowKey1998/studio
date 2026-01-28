
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { onValue, ref, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Appeal = {
    id: string;
    studentName: string;
    studentSystemId: string;
    courseCode: string;
    assessment: string;
    reason: string;
    dateSubmitted: string;
    status: 'Pending' | 'Under Review' | 'Resolved' | 'Declined';
};

const statusOptions: Appeal['status'][] = ['Pending', 'Under Review', 'Resolved', 'Declined'];

export default function StudentAppealsPage() {
    const [appeals, setAppeals] = React.useState<Appeal[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const appealsRef = ref(db, 'appeals');
        const unsubscribe = onValue(appealsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const list = Object.keys(data).map(id => ({ id, ...data[id] }));
            setAppeals(list.sort((a,b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateStatus = async (id: string, status: Appeal['status']) => {
        try {
            await update(ref(db, `appeals/${id}`), { status });
            toast({ title: 'Appeal status updated successfully.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to update status.' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Appeals Tracking</CardTitle>
                <CardDescription>Manage and track academic appeals submitted by students regarding their grades.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Assessment</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-24"/></TableCell></TableRow> :
                         appeals.map(appeal => (
                            <TableRow key={appeal.id}>
                                <TableCell><div>{appeal.studentName}</div><div className="text-xs text-muted-foreground">{appeal.studentSystemId}</div></TableCell>
                                <TableCell>{appeal.courseCode}</TableCell>
                                <TableCell>{appeal.assessment}</TableCell>
                                <TableCell>{format(new Date(appeal.dateSubmitted), 'PPP')}</TableCell>
                                <TableCell>
                                    <Select value={appeal.status} onValueChange={(value) => handleUpdateStatus(appeal.id, value as Appeal['status'])}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">View Details</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Appeal from {appeal.studentName}</DialogTitle>
                                                <DialogDescription>{appeal.courseCode} - {appeal.assessment}</DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4 whitespace-pre-wrap">{appeal.reason}</div>
                                        </DialogContent>
                                    </Dialog>
                                </TableCell>
                            </TableRow>
                        ))}
                         {!loading && appeals.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">No appeals submitted.</TableCell></TableRow>}
                    </TableBody>
                 </Table>
            </CardContent>
        </Card>
    );
}
