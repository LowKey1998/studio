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
import { Trash2, Eye, Terminal, User as UserIcon, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type ErrorLog = {
    id: string;
    message: string;
    category: string;
    timestamp: any;
    userId?: string;
    userName?: string;
    details?: string;
};

export default function ErrorLogsPage() {
    const [logs, setLogs] = React.useState<ErrorLog[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [viewingLog, setViewingLog] = React.useState<ErrorLog | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const logsRef = ref(db, 'errorLogs');
        const unsub = onValue(logsRef, (snapshot) => {
            const data = snapshot.val() || {};
            const list = Object.keys(data)
                .map(id => ({ id, ...data[id] }))
                .sort((a,b) => {
                    const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                    const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                    return timeB - timeA;
                });
            setLogs(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this log?")) return;
        try {
            await remove(ref(db, `errorLogs/${id}`));
            toast({ title: 'Log Deleted' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to delete log' });
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm("CRITICAL: Wipe all system error logs?")) return;
        try {
            await remove(ref(db, 'errorLogs'));
            toast({ title: 'Logs Wiped' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Action failed' });
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-destructive/10 rounded-lg">
                            <Terminal className="h-6 w-6 text-destructive" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">System Audit Logs</CardTitle>
                            <CardDescription>Monitor and debug user-facing errors and system exceptions.</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={handleClearAll}>
                        <Trash2 className="mr-2 h-4 w-4" /> Wipe All Logs
                    </Button>
                </CardHeader>
            </Card>

            <Card className="shadow-md">
                <CardContent className="pt-6">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[180px]">Occurred</TableHead>
                                    <TableHead>User Context</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Error Message</TableHead>
                                    <TableHead className="text-right">Audit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                )) : logs.length > 0 ? logs.map(log => (
                                    <TableRow key={log.id} className="group hover:bg-muted/30">
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {log.timestamp ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true }) : 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold flex items-center gap-1.5">
                                                    <UserIcon className="h-3 w-3 text-primary opacity-60" />
                                                    {log.userName}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono ml-4.5 opacity-60">{log.userId}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest bg-background">{log.category}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-md">
                                            <p className="text-sm font-medium line-clamp-1 text-destructive/80">{log.message}</p>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewingLog(log)}>
                                                    <Eye className="h-4 w-4"/>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(log.id)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                            <CheckCircle2 className="h-12 w-12 mx-auto opacity-10 mb-4" />
                                            <p className="text-sm font-medium">System status healthy. No errors logged.</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!viewingLog} onOpenChange={(o) => !o && setViewingLog(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <DialogTitle>Error Metadata</DialogTitle>
                        </div>
                        <DialogDescription>
                            Detailed context for the event recorded at {viewingLog?.timestamp ? new Date(viewingLog.timestamp).toLocaleString() : 'N/A'}.
                        </DialogDescription>
                    </DialogHeader>
                    {viewingLog && (
                        <div className="space-y-4 py-4">
                            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/10">
                                <Label className="text-[10px] font-black uppercase text-destructive tracking-widest block mb-1">Message</Label>
                                <p className="font-bold text-sm leading-relaxed">{viewingLog.message}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Encountered By</Label>
                                    <p className="text-sm font-medium">{viewingLog.userName} ({viewingLog.userId})</p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Source Category</Label>
                                    <p className="text-sm font-medium">{viewingLog.category}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Terminal className="h-3 w-3" /> Stack Trace / Object Data
                                </Label>
                                <ScrollArea className="h-48 w-full rounded-md border bg-slate-950 p-4 font-mono text-[10px] text-green-400 shadow-inner">
                                    <pre className="whitespace-pre-wrap">
                                        {viewingLog.details ? JSON.stringify(JSON.parse(viewingLog.details), null, 2) : "No additional details provided."}
                                    </pre>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Close Audit</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
