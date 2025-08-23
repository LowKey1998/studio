
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';

type Applicant = {
    id: string;
    name: string;
    offerStatus: 'Offered' | 'Accepted' | 'Declined';
    depositPaid: boolean;
};

export default function AdmissionConfirmationPage() {
    const [applicants, setApplicants] = React.useState<Applicant[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        // This is a placeholder for real data fetching logic
        const mockData: Applicant[] = [
            // Example data - replace with Firebase fetch
            { id: '1', name: 'Alice Johnson', offerStatus: 'Accepted', depositPaid: true },
            { id: '2', name: 'Bob Smith', offerStatus: 'Offered', depositPaid: false },
        ];
        setApplicants(mockData);
        setLoading(false);
    }, []);

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
                            <TableHead>Deposit Paid</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-24"/></TableCell></TableRow> :
                        applicants.length > 0 ? applicants.map(app => (
                            <TableRow key={app.id}>
                                <TableCell>{app.name}</TableCell>
                                <TableCell><Badge variant={app.offerStatus === 'Accepted' ? 'default' : 'secondary'}>{app.offerStatus}</Badge></TableCell>
                                <TableCell><Badge variant={app.depositPaid ? 'default' : 'destructive'}>{app.depositPaid ? 'Paid' : 'Unpaid'}</Badge></TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                    No confirmation data available.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
