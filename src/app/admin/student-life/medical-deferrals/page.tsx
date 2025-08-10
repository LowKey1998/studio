
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { onValue, ref, update } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

type DeferralRequest = {
    id: string;
    studentName: string;
    studentId: string;
    dateRequested: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Declined';
    documentUrl?: string;
};

export default function MedicalDeferralsPage() {
    const [requests, setRequests] = React.useState<DeferralRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const deferralsRef = ref(db, 'medicalDeferrals');
        const unsub = onValue(deferralsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setRequests(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.dateRequested.localeCompare(a.dateRequested)));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleUpdateStatus = async (id: string, status: DeferralRequest['status']) => {
        try {
            await update(ref(db, `medicalDeferrals/${id}`), { status });
            toast({ title: 'Status Updated' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to update status' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Medical Deferrals</CardTitle>
                <CardDescription>Track and manage student requests for medical deferrals.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Date Requested</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         requests.map(d => (
                             <TableRow key={d.id}>
                                <TableCell>{d.studentName} ({d.studentId})</TableCell>
                                <TableCell>{format(new Date(d.dateRequested), 'PPP')}</TableCell>
                                <TableCell className="max-w-xs truncate">{d.reason}</TableCell>
                                <TableCell><Badge variant={d.status === 'Approved' ? 'default' : (d.status === 'Declined' ? 'destructive' : 'secondary')}>{d.status}</Badge></TableCell>
                                <TableCell className="text-right space-x-2">
                                    {d.documentUrl && <Button asChild variant="outline" size="sm"><a href={d.documentUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>Document</a></Button>}
                                    {d.status === 'Pending' && (
                                        <>
                                        <Button size="sm" onClick={() => handleUpdateStatus(d.id, 'Approved')}>Approve</Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(d.id, 'Declined')}>Decline</Button>
                                        </>
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
