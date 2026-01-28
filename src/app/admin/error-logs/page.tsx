
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, remove } from 'firebase/database';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ErrorLog = {
    id: string;
    message: string;
    category: string;
    timestamp: string;
    userId?: string;
    userName?: string;
    details?: string;
};

export default function ErrorLogsPage() {
    const [logs, setLogs] = React.useState<ErrorLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const logsRef = ref(db, 'errorLogs');
        const unsub = onValue(logsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const list = Object.keys(data)
                .map(id => ({ id, ...data[id] }))
                .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setLogs(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this log?")) return;
        await remove(ref(db, `errorLogs/${id}`));
        toast({ title: 'Log Deleted' });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>System Error Logs</CardTitle>
                <CardDescription>A log of user-facing errors that have occurred in the system.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                        )) : logs.length > 0 ? logs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</TableCell>
                                <TableCell>{log.userName || 'N/A'} ({log.userId || 'System'})</TableCell>
                                <TableCell><Badge variant="outline">{log.category}</Badge></TableCell>
                                <TableCell className="max-w-sm truncate">{log.message}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(log.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">No error logs found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
