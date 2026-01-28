
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { format, parseISO } from 'date-fns';
import { Mail, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Log = {
    id: string;
    type: 'Email' | 'SMS';
    subject?: string;
    body: string;
    recipients: string[];
    timestamp: string;
};

export default function CommunicationLogsPage() {
    const [logs, setLogs] = React.useState<Log[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const logsRef = ref(db, 'communicationLogs');
        const unsubscribe = onValue(logsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setLogs(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Communication Logs</CardTitle>
                <CardDescription>A history of all broadcast communications sent to parents and guardians.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="multiple" className="w-full space-y-2">
                    {loading ? <Skeleton className="h-48"/> :
                     logs.map(log => (
                        <AccordionItem value={log.id} key={log.id} className="border rounded-lg">
                            <AccordionTrigger className="p-4 hover:no-underline">
                                <div className="flex justify-between w-full">
                                    <div className="flex items-center gap-2 font-semibold">
                                        {log.type === 'Email' ? <Mail className="h-4 w-4"/> : <MessageSquare className="h-4 w-4"/>}
                                        {log.subject || log.body.substring(0, 50) + '...'}
                                    </div>
                                    <div className="text-sm text-muted-foreground pr-4">{format(parseISO(log.timestamp), 'PPP p')}</div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 pt-0">
                                <div className="space-y-2 bg-muted/50 p-3 rounded-md">
                                    <p><strong className="font-semibold">Type:</strong> <Badge>{log.type}</Badge></p>
                                    <p><strong className="font-semibold">Recipients:</strong> {log.recipients.length}</p>
                                    {log.subject && <p><strong className="font-semibold">Subject:</strong> {log.subject}</p>}
                                    <p className="whitespace-pre-wrap"><strong className="font-semibold">Body:</strong> {log.body}</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                     ))}
                 </Accordion>
            </CardContent>
        </Card>
    );
}
