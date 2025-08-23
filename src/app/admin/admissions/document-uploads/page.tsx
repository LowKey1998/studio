
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Download, Search, Check, X, FileUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type Document = {
    id: string;
    applicantId: string;
    applicantName: string;
    documentType: string;
    fileUrl: string;
    status: 'Pending Verification' | 'Verified' | 'Rejected';
};

export default function DocumentUploadsPage() {
    const [documents, setDocuments] = React.useState<Document[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const docsRef = ref(db, 'admissions/documents');
        const unsub = onValue(docsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setDocuments(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleUpdateStatus = async (docId: string, status: Document['status']) => {
        await update(ref(db, `admissions/documents/${docId}`), { status });
        toast({ title: "Status Updated", description: `Document has been marked as ${status}.` });
    };

    const filteredDocuments = documents.filter(doc =>
        doc.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.documentType.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Document Uploads</CardTitle>
                        <CardDescription>Manage and verify applicant-submitted documents like transcripts and identification.</CardDescription>
                    </div>
                </div>
                <div className="relative pt-2">
                    <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search applicant by name or document type..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Applicant</TableHead>
                            <TableHead>Document Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow>
                         : filteredDocuments.length > 0 ? filteredDocuments.map(doc => (
                            <TableRow key={doc.id}>
                                <TableCell>{doc.applicantName}</TableCell>
                                <TableCell>{doc.documentType}</TableCell>
                                <TableCell><Badge variant={doc.status === 'Verified' ? 'default' : (doc.status === 'Rejected' ? 'destructive' : 'secondary')}>{doc.status}</Badge></TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm" asChild><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4"/>View</a></Button>
                                    {doc.status === 'Pending Verification' && (
                                        <>
                                            <Button size="sm" onClick={() => handleUpdateStatus(doc.id, 'Verified')}><Check className="mr-2 h-4"/>Verify</Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleUpdateStatus(doc.id, 'Rejected')}><X className="mr-2 h-4"/>Reject</Button>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                         )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No documents submitted yet.
                                </TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
