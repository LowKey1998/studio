
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type MentorshipLog = {
    id: string;
    date: string;
    notes: string;
    advisorName: string;
};

type GroupedLogs = Record<string, { studentName: string; studentId: string; logs: MentorshipLog[] }>;

export default function MentorshipLogsPage() {
    const [logsByStudent, setLogsByStudent] = React.useState<GroupedLogs>({});
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        const logsRef = ref(db, 'mentorshipLogs');
        const usersRef = ref(db, 'users');

        const unsubscribe = onValue(logsRef, async (logSnapshot) => {
            if (!logSnapshot.exists()) {
                setLogsByStudent({});
                setLoading(false);
                return;
            }

            const logsData = logSnapshot.val();
            const userSnapshot = await get(usersRef);
            const usersData = userSnapshot.val() || {};
            const groupedLogs: GroupedLogs = {};

            for (const studentUid in logsData) {
                const studentLogs = logsData[studentUid];
                const studentInfo = usersData[studentUid] || { name: 'Unknown Student', id: 'N/A' };
                
                if (!groupedLogs[studentUid]) {
                    groupedLogs[studentUid] = {
                        studentName: studentInfo.name,
                        studentId: studentInfo.id,
                        logs: []
                    };
                }

                for (const logId in studentLogs) {
                    const log = studentLogs[logId];
                    const advisorName = usersData[log.advisorId]?.name || 'Unknown Advisor';
                    groupedLogs[studentUid].logs.push({
                        id: logId,
                        date: log.date,
                        notes: log.notes,
                        advisorName
                    });
                }
                groupedLogs[studentUid].logs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            }

            setLogsByStudent(groupedLogs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Mentorship Logs</CardTitle>
                <CardDescription>View logs of mentorship and advising sessions.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-48 w-full" /> : 
                 Object.keys(logsByStudent).length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                        {Object.entries(logsByStudent).map(([studentUid, data]) => (
                            <AccordionItem value={studentUid} key={studentUid}>
                                <AccordionTrigger>{data.studentName} ({data.studentId})</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Advisor</TableHead>
                                                <TableHead>Notes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.logs.map(log => (
                                                <TableRow key={log.id}>
                                                    <TableCell>{format(new Date(log.date), 'PPP')}</TableCell>
                                                    <TableCell>{log.advisorName}</TableCell>
                                                    <TableCell>{log.notes}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-center text-muted-foreground py-16">No mentorship logs have been recorded yet.</p>
                )}
            </CardContent>
        </Card>
    );
}
