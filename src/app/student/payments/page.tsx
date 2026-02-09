'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, History, DollarSign, AlertCircle, Download, GraduationCap, Trash2, Banknote, ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, update, push, set, remove, onValue } from 'firebase/database';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

type Invoice = { invoiceId: string; totalTuition: number; totalMandatoryFees: number; totalOptionalFees: number; lateFee?: number; paymentPlan: string; dateCreated: string; semester: string; semesterId: string; courses?: string[]; optionalFees?: string[]; applyScholarship?: boolean; };
type Transaction = { transactionId: string; invoiceId: string; amount: number; paymentDate: string; status: 'successful' | 'failed'; semesterId: string; userId: string; }
type Registration = { courses: string[]; coursePriority: string[]; invoiceId: string; status: string; semesterName: string; }
type DuePayment = { installmentName: string; dueDate: string | null; amountDue: number; amountPaid: number; balance: number; status: string; invoice: Invoice; isPayable: boolean; registration: Registration; };

export default function PaymentsPage() {
    const [groupedDuePayments, setGroupedDuePayments] = React.useState<Record<string, DuePayment[]>>({});
    const [rawInvoices, setRawInvoices] = React.useState<Invoice[]>([]);
    const [rawTransactions, setRawTransactions] = React.useState<Transaction[]>([]);
    const [rawRegistrations, setRawRegistrations] = React.useState<Record<string, Registration>>({});
    const [semesters, setSemesters] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        onAuthStateChanged(auth, user => { if(user) setCurrentUser(user); else setLoading(false); });
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [rSnap, iSnap, tSnap, sSnap] = await Promise.all([
                    get(ref(db, `registrations/${currentUser.uid}`)),
                    get(ref(db, `invoices/${currentUser.uid}`)),
                    get(ref(db, 'transactions')),
                    get(ref(db, 'semesters'))
                ]);
                setRawRegistrations(rSnap.val() || {});
                setRawInvoices(Object.values(iSnap.val() || {}));
                setRawTransactions(Object.values(tSnap.val() || {}).filter((t:any) => t.userId === currentUser.uid) as Transaction[]);
                setSemesters(Object.keys(sSnap.val() || {}).map(k => ({ id: k, ...sSnap.val()[k] })));
            } finally { setLoading(false); }
        };
        fetchData();
    }, [currentUser]);

    React.useEffect(() => {
        if (loading || !currentUser) return;
        const allDue: DuePayment[] = [];
        rawInvoices.forEach(inv => {
            const reg = rawRegistrations[inv.semesterId];
            if (!reg) return;
            const total = (inv.totalTuition || 0) + (inv.totalMandatoryFees || 0) + (inv.totalOptionalFees || 0);
            const paid = rawTransactions.filter(t => t.invoiceId === inv.invoiceId).reduce((s, t) => s + t.amount, 0);
            const bal = total - paid;
            allDue.push({ installmentName: 'Full Payment', dueDate: null, amountDue: total, amountPaid: paid, balance: bal, status: bal <= 0.01 ? 'Paid' : 'Due', invoice: inv, isPayable: bal > 0.01, registration: reg });
        });
        const grouped: Record<string, DuePayment[]> = {};
        allDue.forEach(p => { if(!grouped[p.invoice.semesterId]) grouped[p.invoice.semesterId] = []; grouped[p.invoice.semesterId].push(p); });
        setGroupedDuePayments(grouped);
    }, [loading, rawInvoices, rawRegistrations, rawTransactions, currentUser]);

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <div className="space-y-6">
            <Card><CardHeader><CardTitle>Payments</CardTitle></CardHeader>
                <CardContent>
                    {Object.keys(groupedDuePayments).map(semId => (
                        <div key={semId} className="mb-8">
                            <h3 className="font-bold mb-4">{semesters.find(s=>s.id===semId)?.name}</h3>
                            {groupedDuePayments[semId].map((p, i) => (
                                <Card key={i} className="p-4 mb-2 flex justify-between items-center">
                                    <div><p className="font-medium">{p.installmentName}</p><p className="text-sm text-muted-foreground">Balance: ZMW {p.balance.toFixed(2)}</p></div>
                                    <Badge>{p.status}</Badge>
                                </Card>
                            ))}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
