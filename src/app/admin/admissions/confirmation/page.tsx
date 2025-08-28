
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Check } from 'lucide-react';

type Applicant = {
    id: string;
    name: string;
    offerStatus: 'Offered' | 'Accepted' | 'Declined';
    depositPaid?: boolean;
};

export default function AdmissionConfirmationPage() {
    const [applicants, setApplicants] = React.useState<Applicant[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const leadsRef = ref(db, 'admissions/leads');
        const unsub = onValue(leadsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(app => app.status === 'Offered' || app.status === 'Accepted' || app.status === 'Declined');
                setApplicants(list.map(app => ({
                    id: app.id,
                    name: app.name,
                    offerStatus: app.status,
                    depositPaid: app.depositPaid || false,
                })));
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleUpdateStatus = async (leadId: string, status: Applicant['offerStatus']) => {
        try {
            await update(ref(db, `admissions/leads/${leadId}`), { status });
            toast({ title: 'Status Updated' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };
    
    const handleMarkDepositPaid = async (leadId: string) => {
        try {
            await update(ref(db, `admissions/leads/${leadId}`), { depositPaid: true });
            toast({ title: 'Deposit Marked as Paid' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Admission Confirmation</CardTitle>
                        <CardDescription>Track which students have confirmed their admission and paid any required deposits.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Offer Status</TableHead>
                            <TableHead>Deposit</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                        applicants.length > 0 ? applicants.map(app => (
                            <TableRow key={app.id}>
                                <TableCell>{app.name}</TableCell>
                                <TableCell>
                                     <Select value={app.offerStatus} onValueChange={(value) => handleUpdateStatus(app.id, value as Applicant['offerStatus'])}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Offered">Offered</SelectItem>
                                            <SelectItem value="Accepted">Accepted</SelectItem>
                                            <SelectItem value="Declined">Declined</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell><Badge variant={app.depositPaid ? 'default' : 'destructive'}>{app.depositPaid ? 'Paid' : 'Unpaid'}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" disabled={app.depositPaid} onClick={() => handleMarkDepositPaid(app.id)}>
                                       <Check className="mr-2 h-4"/> Mark Deposit as Paid
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                    No applicants with offers to display.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
