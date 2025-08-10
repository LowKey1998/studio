
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

type LeaveRequest = {
    id: string;
    studentName: string;
    studentId: string;
    dateRequested: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Declined';
};

export default function LeaveOfAbsencePage() {
    const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const leaveRef = ref(db, 'leaveOfAbsence');
        const unsub = onValue(leaveRef, (snapshot) => {
            const data = snapshot.val() || {};
            setRequests(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.dateRequested.localeCompare(a.dateRequested)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleUpdateStatus = async (id: string, status: LeaveRequest['status']) => {
        try {
            await update(ref(db, `leaveOfAbsence/${id}`), { status });
            toast({ title: 'Status Updated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to update status' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Leave of Absence</CardTitle>
                <CardDescription>Manage and track student requests for leave of absence.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Dates Requested</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         requests.map(r => (
                             <TableRow key={r.id}>
                                <TableCell>{r.studentName} ({r.studentId})</TableCell>
                                <TableCell>{format(new Date(r.startDate), 'PPP')} - {format(new Date(r.endDate), 'PPP')}</TableCell>
                                <TableCell className="max-w-sm truncate">{r.reason}</TableCell>
                                <TableCell><Badge variant={r.status === 'Approved' ? 'default' : (r.status === 'Declined' ? 'destructive' : 'secondary')}>{r.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                    {r.status === 'Pending' && (
                                        <div className="space-x-2">
                                            <Button size="sm" onClick={() => handleUpdateStatus(r.id, 'Approved')}>Approve</Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(r.id, 'Declined')}>Decline</Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
