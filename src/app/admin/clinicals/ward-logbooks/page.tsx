
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Eye, Check, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Logbook = {
    id: string;
    studentName: string;
    ward: string;
    date: string;
    logText: string;
    status: 'Pending Review' | 'Approved';
};

export default function WardLogbooksPage() {
    const [logbooks, setLogbooks] = React.useState<Logbook[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [viewingLog, setViewingLog] = React.useState<Logbook | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const logbooksRef = ref(db, 'wardLogbooks');
        const unsubscribe = onValue(logbooksRef, (snapshot) => {
            const data = snapshot.val() || {};
            const list: Logbook[] = [];
            for (const studentId in data) {
                for (const logId in data[studentId]) {
                    list.push({ id: logId, studentId, ...data[studentId][logId] });
                }
            }
            setLogbooks(list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleApprove = async (logbook: Logbook) => {
        setActionLoading(logbook.id);
        try {
            await update(ref(db, `wardLogbooks/${(logbook as any).studentId}/${logbook.id}`), { status: 'Approved' });
            await createNotification((logbook as any).studentId, `Your logbook entry for ${logbook.ward} on ${format(new Date(logbook.date), 'PPP')} has been approved.`, '/student/logbook');
            toast({ title: 'Logbook Approved' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Approval Failed' });
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ward Logbooks</CardTitle>
                <CardDescription>Review, comment on, and approve digital logbooks submitted by students for their activities in various wards.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Ward</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                        logbooks.map(log => (
                            <TableRow key={log.id}>
                                <TableCell>{log.studentName}</TableCell>
                                <TableCell>{log.ward}</TableCell>
                                <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                <TableCell><Badge variant={log.status === 'Approved' ? 'default' : 'secondary'}>{log.status}</Badge></TableCell>
                                <TableCell className="text-right">
                                <Dialog>
                                    <DialogTrigger asChild><Button variant="outline" size="sm" onClick={() => setViewingLog(log)}><Eye className="mr-2 h-4 w-4"/>View Log</Button></DialogTrigger>
                                     <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Logbook Entry: {viewingLog?.studentName}</DialogTitle>
                                            <DialogDescription>{viewingLog?.ward} - {viewingLog && format(new Date(viewingLog.date), 'PPP')}</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4 whitespace-pre-wrap">{viewingLog?.logText}</div>
                                    </DialogContent>
                                </Dialog>
                                {log.status === 'Pending Review' && <Button size="sm" className="ml-2" onClick={() => handleApprove(log)} disabled={!!actionLoading}>{actionLoading === log.id ? <Loader2 className="animate-spin h-4 w-4"/> : <Check className="mr-2 h-4 w-4"/>}Approve</Button>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
