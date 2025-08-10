
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { onValue, ref, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Complaint = {
    id: string;
    studentName: string;
    studentId: string;
    type: string;
    date: string;
    details: string;
    status: 'Pending Review' | 'In Progress' | 'Resolved';
};

export default function ComplaintsPage() {
    const [complaints, setComplaints] = React.useState<Complaint[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const complaintsRef = ref(db, 'complaints');
        const unsub = onValue(complaintsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setComplaints(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.date.localeCompare(a.date)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleUpdateStatus = async (id: string, status: Complaint['status']) => {
        try {
            await update(ref(db, `complaints/${id}`), { status });
            toast({ title: 'Status Updated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to update status' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Complaint Submissions</CardTitle>
                <CardDescription>View, manage, and resolve student-submitted complaints.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-24"/></TableCell></TableRow> :
                         complaints.map(c => (
                             <TableRow key={c.id}>
                                <TableCell>{c.studentName} ({c.studentId})</TableCell>
                                <TableCell>{c.type}</TableCell>
                                <TableCell>{format(new Date(c.date), 'PPP')}</TableCell>
                                <TableCell className="max-w-xs truncate">{c.details}</TableCell>
                                <TableCell>
                                    <Select value={c.status} onValueChange={(val) => handleUpdateStatus(c.id, val as Complaint['status'])}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pending Review">Pending Review</SelectItem>
                                            <SelectItem value="In Progress">In Progress</SelectItem>
                                            <SelectItem value="Resolved">Resolved</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                     <Badge variant={c.status === 'Resolved' ? 'default' : 'secondary'}>{c.status}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
