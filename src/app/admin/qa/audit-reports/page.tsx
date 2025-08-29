
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download, Trash2, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Report = {
    id: string;
    title: string;
    department: string;
    date: string;
    fileUrl: string;
    fileName: string;
};

export default function AuditReportsPage() {
    const [reports, setReports] = React.useState<Report[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [title, setTitle] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [date, setDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
    const [file, setFile] = React.useState<File | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        const reportsRef = ref(db, 'auditReports');
        const unsub = onValue(reportsRef, (snapshot) => {
            setReports(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const resetForm = () => {
        setTitle(''); setDepartment(''); setDate(format(new Date(), 'yyyy-MM-dd')); setFile(null);
    };

    const handleSave = async () => {
        if (!title || !department || !date || !file) {
            toast({ variant: 'destructive', title: "All fields are required." });
            return;
        }
        setFormLoading(true);
        try {
            const fileRef = storageRef(storage, `auditReports/${file.name}_${Date.now()}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);

            await push(ref(db, 'auditReports'), {
                title, department, date, fileUrl: url, fileName: file.name
            });

            toast({ title: "Report Uploaded" });
            resetForm();
            setIsDialogOpen(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Upload Failed", description: e.message });
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(!window.confirm("Are you sure you want to delete this report?")) return;
        await remove(ref(db, `auditReports/${id}`));
        toast({ title: 'Report deleted' });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Internal Audit Reports</CardTitle>
                    <CardDescription>Upload and manage internal and external audit reports.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) resetForm(); setIsDialogOpen(open); }}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Upload Report</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>New Audit Report</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1"><Label>Report Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Department</Label><Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g., Finance, Academics" /></div>
                            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                            <div className="space-y-1"><Label>Report File (PDF)</Label><Input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleSave} disabled={formLoading}>{formLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Report"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Report Title</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-24"/></TableCell></TableRow> :
                        reports.map(report => (
                             <TableRow key={report.id}>
                                <TableCell>{report.title}</TableCell>
                                <TableCell>{report.department}</TableCell>
                                <TableCell>{format(new Date(report.date), 'PPP')}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button asChild variant="outline" size="sm"><a href={report.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Download</a></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(report.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
