
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from '@/lib/firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Inquiry = {
    id: string;
    name: string;
    phone: string;
    programmeOfInterest: string;
    results: string;
    createdAt: string;
    status: 'New' | 'Contacted' | 'Disqualified';
};

export default function AdmissionInquiriesPage() {
    const [inquiries, setInquiries] = React.useState<Inquiry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const inquiriesRef = ref(db, 'admissions/leads');
        const unsub = onValue(inquiriesRef, (snapshot) => {
            const data = snapshot.val() || {};
            const list = Object.keys(data)
                .filter(id => data[id].source === 'Website Inquiry Form')
                .map(id => ({ id, ...data[id] }))
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setInquiries(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleStatusChange = async (id: string, status: Inquiry['status']) => {
        try {
            await update(ref(db, `admissions/leads/${id}`), { status });
            toast({ title: "Status Updated", description: `Inquiry marked as ${status}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure? This will permanently delete the inquiry.")) return;
        await remove(ref(db, `admissions/leads/${id}`));
        toast({ title: 'Inquiry Deleted' });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Admission Inquiries</CardTitle>
                <CardDescription>Review and manage inquiries submitted through the website form.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Applicant Name</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Programme of Interest</TableHead>
                            <TableHead>Qualifications</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                        )) : inquiries.length > 0 ? inquiries.map(inquiry => (
                            <TableRow key={inquiry.id}>
                                <TableCell>
                                    <div className="font-medium">{inquiry.name}</div>
                                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(inquiry.createdAt), { addSuffix: true })}</div>
                                </TableCell>
                                <TableCell>{inquiry.phone}</TableCell>
                                <TableCell>{inquiry.programmeOfInterest}</TableCell>
                                <TableCell className="max-w-xs truncate">{inquiry.results}</TableCell>
                                <TableCell>
                                    <Select value={inquiry.status} onValueChange={(value) => handleStatusChange(inquiry.id, value as Inquiry['status'])}>
                                        <SelectTrigger className="w-[150px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="New">New</SelectItem>
                                            <SelectItem value="Contacted">Contacted</SelectItem>
                                            <SelectItem value="Disqualified">Disqualified</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(inquiry.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">No inquiries submitted yet.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

    