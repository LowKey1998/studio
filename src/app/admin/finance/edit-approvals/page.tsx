'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db, createNotification } from '@/lib/firebase';
import { ref, onValue, update, remove, get } from 'firebase/database';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, ClipboardCheck, ArrowRight, History, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type EditRequest = {
    id: string;
    type: 'transaction' | 'invoice';
    targetId: string;
    userId: string;
    studentName: string;
    studentId: string;
    oldValue: number;
    newValue: number;
    reason: string;
    requestedBy: string;
    requestedByUid: string;
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected';
};

export default function EditApprovalsPage() {
    const [requests, setRequests] = React.useState<EditRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const requestsRef = ref(db, 'paymentEditRequests');
        const unsub = onValue(requestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(req => req.status === 'pending')
                    .sort((a, b) => b.timestamp - a.timestamp);
                setRequests(list);
            } else {
                setRequests([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleDecision = async (request: EditRequest, decision: 'approved' | 'rejected') => {
        setActionLoading(request.id);
        try {
            const updates: Record<string, any> = {};
            updates[`paymentEditRequests/${request.id}/status`] = decision;
            updates[`paymentEditRequests/${request.id}/decisionAt`] = Date.now();

            if (decision === 'approved') {
                if (request.type === 'transaction') {
                    updates[`transactions/${request.targetId}/amount`] = request.newValue;
                } else if (request.type === 'invoice') {
                    // This is a simplified total adjustment. 
                    // In a real system, we might adjust specific line items.
                    // Here we assume adjusting the main tuition component to reach the target total.
                    const invoiceRef = ref(db, `invoices/${request.userId}/${request.targetId}`);
                    const invSnap = await get(invoiceRef);
                    if (invSnap.exists()) {
                        const inv = invSnap.val();
                        const currentTotal = (inv.totalTuition || 0) + (inv.totalMandatoryFees || 0) + (inv.totalOptionalFees || 0) - (inv.applyScholarship ? inv.totalTuition : 0);
                        const diff = request.newValue - currentTotal;
                        updates[`invoices/${request.userId}/${request.targetId}/totalTuition`] = (inv.totalTuition || 0) + diff;
                    }
                }

                await createNotification(
                    request.userId,
                    `A financial adjustment has been made to your account. Your new ${request.type} total is ZMW ${request.newValue.toFixed(2)}.`,
                    '/student/payments'
                );
            }

            await update(ref(db), updates);
            toast({ variant: decision === 'approved' ? 'default' : 'destructive', title: `Request ${decision.charAt(0).toUpperCase() + decision.slice(1)}` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <ClipboardCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Financial Edit Approvals</CardTitle>
                            <CardDescription>Review and approve proposed changes to transactions and invoices.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl"/>)}
                </div>
            ) : requests.length > 0 ? (
                <div className="grid gap-4">
                    {requests.map(req => (
                        <Card key={req.id} className="overflow-hidden border-l-4 border-l-primary shadow-md">
                            <CardHeader className="bg-muted/30 py-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest">{req.type}</Badge>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <History className="h-3 w-3" />
                                            {formatDistanceToNow(new Date(req.timestamp), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase">Req By: {req.requestedBy}</div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 pb-4">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary" />
                                            <span className="font-bold">{req.studentName}</span>
                                            <span className="text-xs text-muted-foreground">({req.studentId})</span>
                                        </div>
                                        <div className="flex items-center gap-4 py-2">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Old Value</span>
                                                <span className="text-lg font-bold opacity-50 line-through">ZMW {req.oldValue.toFixed(2)}</span>
                                            </div>
                                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-bold text-primary">New Value</span>
                                                <span className="text-xl font-black text-primary">ZMW {req.newValue.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="bg-muted/50 p-3 rounded-lg border italic text-xs leading-relaxed">
                                            "{req.reason}"
                                        </div>
                                    </div>
                                    <div className="flex flex-row md:flex-col gap-2 justify-end self-end md:self-center">
                                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDecision(req, 'rejected')} disabled={!!actionLoading}>
                                            <X className="mr-2 h-4 w-4" /> Reject
                                        </Button>
                                        <Button size="sm" onClick={() => handleDecision(req, 'approved')} disabled={!!actionLoading}>
                                            {actionLoading === req.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                                            Approve Adjustment
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                    <ClipboardCheck className="mx-auto h-12 w-12 opacity-10 mb-4" />
                    <h3 className="text-lg font-bold">All Clear!</h3>
                    <p className="text-sm">There are no pending financial edit requests at this time.</p>
                </div>
            )}
        </div>
    );
}
