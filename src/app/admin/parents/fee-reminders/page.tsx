
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { Loader2, Mail } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

type Defaulter = {
    userId: string;
    studentId: string;
    studentName: string;
    guardianName?: string;
    guardianContact?: string;
    balance: number;
    status: 'Due' | 'Overdue';
};

export default function FeeRemindersPage() {
    const [defaulters, setDefaulters] = React.useState<Defaulter[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [sending, setSending] = React.useState(false);
    const [selected, setSelected] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchDefaulters = async () => {
            setLoading(true);
            try {
                const [usersSnap, regsSnap, transactionsSnap, invoicesSnap] = await Promise.all([
                    get(ref(db, 'users')), get(ref(db, 'registrations')), get(ref(db, 'transactions')), get(ref(db, 'invoices'))
                ]);

                if (!usersSnap.exists() || !regsSnap.exists() || !invoicesSnap.exists()) {
                    setLoading(false); return;
                }

                const users = usersSnap.val();
                const registrations = regsSnap.val();
                const transactions = transactionsSnap.val() || {};
                const allInvoices = invoicesSnap.val();
                const defaulterList: Defaulter[] = [];

                for (const userId in registrations) {
                    for (const semesterId in registrations[userId]) {
                        const reg = registrations[userId][semesterId];
                        const invoice = allInvoices[userId]?.[reg.invoiceId];
                        if (!invoice || users[userId]?.role !== 'Student') continue;

                        const totalDue = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) - (invoice.applyScholarship ? invoice.totalTuition : 0);
                        const totalPaid = Object.values(transactions).filter((tx: any) => tx.userId === userId && tx.invoiceId === reg.invoiceId).reduce((acc: number, tx: any) => acc + tx.amount, 0);
                        const balance = totalDue - totalPaid;

                        if (balance > 0.01) {
                            defaulterList.push({
                                userId,
                                studentId: users[userId].id,
                                studentName: users[userId].name,
                                guardianName: users[userId].guardian?.name,
                                guardianContact: users[userId].guardian?.contact,
                                balance,
                                status: 'Due', // Simplified for this context
                            });
                        }
                    }
                }
                setDefaulters(defaulterList.sort((a,b) => b.balance - a.balance));
            } catch (error) {
                console.error("Error fetching defaulter data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDefaulters();
    }, []);

    const handleSelect = (userId: string) => {
        setSelected(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const handleSendReminders = async () => {
        const recipients = defaulters.filter(d => selected[d.userId] && d.guardianContact?.includes('@'));
        if (recipients.length === 0) {
            toast({ variant: 'destructive', title: 'No recipients selected or no valid emails found.' });
            return;
        }

        setSending(true);
        try {
            const subject = "Fee Balance Reminder";
            const promises = recipients.map(r => {
                const body = `<p>Dear ${r.guardianName || 'Guardian'},</p><p>This is a friendly reminder that there is an outstanding balance of <strong>ZMW ${r.balance.toFixed(2)}</strong> for ${r.studentName}'s fees.</p><p>Please make a payment at your earliest convenience.</p><p>Thank you,<br/>The Finance Department</p>`;
                return sendEmail({ to: [r.guardianContact!], subject, body, log: true, userIds: [r.userId] });
            });
            await Promise.all(promises);
            toast({ title: "Reminders Sent", description: `Emails have been sent to ${recipients.length} guardians.` });
            setSelected({});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to send reminders', description: error.message });
        } finally {
            setSending(false);
        }
    };
    
    const selectedCount = Object.values(selected).filter(Boolean).length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Send Fee Reminders</CardTitle>
                <CardDescription>Select students with outstanding balances to send reminders to their guardians.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><Checkbox onCheckedChange={checked => { const newSelected: Record<string, boolean> = {}; if(checked) { defaulters.forEach(d => newSelected[d.userId] = true); } setSelected(newSelected); }} /></TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Guardian</TableHead>
                            <TableHead>Guardian Contact</TableHead>
                            <TableHead className="text-right">Balance (ZMW)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24"/></TableCell></TableRow> :
                         defaulters.map(defaulter => (
                            <TableRow key={defaulter.userId} data-state={selected[defaulter.userId] && 'selected'}>
                                <TableCell><Checkbox checked={!!selected[defaulter.userId]} onCheckedChange={() => handleSelect(defaulter.userId)} /></TableCell>
                                <TableCell className="font-medium">{defaulter.studentName} ({defaulter.studentId})</TableCell>
                                <TableCell>{defaulter.guardianName || '-'}</TableCell>
                                <TableCell>{defaulter.guardianContact || '-'}</TableCell>
                                <TableCell className="text-right font-semibold">{defaulter.balance.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="flex justify-end">
                 <Button onClick={handleSendReminders} disabled={sending || selectedCount === 0}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4"/>}
                    Send Reminders to {selectedCount} Selected
                </Button>
            </CardFooter>
        </Card>
    );
}
