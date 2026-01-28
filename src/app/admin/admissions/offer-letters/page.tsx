
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileSignature, Search, Send, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type Applicant = {
    id: string;
    name: string;
    email?: string;
    status: 'Received' | 'Reviewed' | 'Interviewing' | 'Offered' | 'Accepted' | 'Enrolled' | 'Disqualified';
    offerSent?: boolean;
};

export default function OfferLettersPage() {
    const [applicants, setApplicants] = React.useState<Applicant[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const applicantsRef = ref(db, 'admissions/leads');
        const unsubscribe = onValue(applicantsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(app => app.status === 'Offered' || app.status === 'Accepted');
                setApplicants(list);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSendOffer = async (applicantId: string) => {
        // Here you would integrate with an email service to send the actual letter
        await update(ref(db, `admissions/leads/${applicantId}`), { offerSent: true, status: 'Offered' });
        toast({title: "Offer Letter Sent", description: "The offer letter has been marked as sent."});
    };

    const filteredApplicants = applicants.filter(app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Offer Letters</CardTitle>
                        <CardDescription>Generate, send, and track offer letters for accepted students.</CardDescription>
                    </div>
                </div>
                 <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search accepted applicant..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
             <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Applicant</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                        : filteredApplicants.length > 0 ? filteredApplicants.map(app => (
                            <TableRow key={app.id}>
                                <TableCell>{app.name}</TableCell>
                                <TableCell>{app.email}</TableCell>
                                <TableCell>
                                    <Badge variant={app.offerSent ? 'default' : 'secondary'}>
                                        {app.offerSent ? 'Sent' : 'Pending'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right flex items-center justify-end gap-2">
                                     <Button variant="outline" size="sm"><FileText className="mr-2 h-4 w-4" /> Generate</Button>
                                     <Button size="sm" onClick={() => handleSendOffer(app.id)} disabled={app.offerSent}><Send className="mr-2 h-4"/>{app.offerSent ? 'Sent' : 'Send'}</Button>
                                </TableCell>
                            </TableRow>
                        ))
                        : <TableRow><TableCell colSpan={4} className="text-center h-24">No applicants eligible for an offer.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
