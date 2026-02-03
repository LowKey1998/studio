
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, X, Pencil, Search, Copy, UserCheck } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, remove, get, update } from 'firebase/database';
import { findOrCreateUser } from '@/ai/flows/find-or-create-user';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type StaffApplication = {
    id: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    bio: string;
    appliedAt: string;
    status: 'Pending' | 'Approved' | 'Rejected';
};

export default function StaffApplicationsPage() {
    const [applications, setApplications] = React.useState<StaffApplication[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Edit Dialog State
    const [editingApp, setEditingApp] = React.useState<StaffApplication | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editEmail, setEditEmail] = React.useState('');
    const [editPhone, setEditPhone] = React.useState('');
    const [editDept, setEditDept] = React.useState('');

    React.useEffect(() => {
        const appsRef = ref(db, 'staffApplications');
        const unsub = onValue(appsRef, (snapshot) => {
            if (snapshot.exists()) {
                setApplications(Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...(data as any) })).sort((a,b) => b.appliedAt.localeCompare(a.appliedAt)));
            } else {
                setApplications([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/staff-registration`;
        navigator.clipboard.writeText(url);
        toast({ title: 'Link Copied!', description: 'You can now share this registration link with potential staff.' });
    };

    const handleApprove = async (app: StaffApplication) => {
        if (!window.confirm(`Approve ${app.name}? This will create a staff account and send them login credentials.`)) return;
        setActionLoading(app.id);
        try {
            const password = Math.random().toString(36).slice(-10);
            
            // Generate Staff ID (Simplified here, usually flows handle this)
            const staffId = `STF-AUTO-${Date.now().toString().slice(-4)}`;

            await findOrCreateUser({
                id: staffId,
                name: app.name,
                email: app.email,
                password: password,
                phoneNumber: app.phone,
                role: 'Staff',
            });

            await remove(ref(db, `staffApplications/${app.id}`));
            toast({ title: 'Application Approved!', description: 'Staff account created and email sent.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Approval Failed', description: error.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (appId: string) => {
        if (!window.confirm("Reject this application? It will be permanently removed.")) return;
        await remove(ref(db, `staffApplications/${appId}`));
        toast({ title: 'Application Rejected' });
    };

    const filteredApps = applications.filter(a => 
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl font-headline">Staff Registration Links & Applications</CardTitle>
                        <CardDescription>Manage the staff self-registration process. Verify and approve applicants before creating their accounts.</CardDescription>
                    </div>
                    <Button onClick={handleCopyLink} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copy Registration Link</Button>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search applicants..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email & Phone</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Applied On</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-24 w-full"/></TableCell></TableRow> :
                             filteredApps.length > 0 ? filteredApps.map(app => (
                                <TableRow key={app.id}>
                                    <TableCell className="font-medium">{app.name}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">{app.email}</div>
                                        <div className="text-xs text-muted-foreground">{app.phone}</div>
                                    </TableCell>
                                    <TableCell>{app.department}</TableCell>
                                    <TableCell>{format(new Date(app.appliedAt), 'PPP')}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            setEditingApp(app);
                                            setEditName(app.name);
                                            setEditEmail(app.email);
                                            setEditPhone(app.phone);
                                            setEditDept(app.department);
                                        }}><Pencil className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleReject(app.id)}><X className="h-4 w-4"/></Button>
                                        <Button size="sm" onClick={() => handleApprove(app)} disabled={!!actionLoading}>
                                            {actionLoading === app.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserCheck className="mr-2 h-4 w-4" />}
                                            Approve
                                        </Button>
                                    </TableCell>
                                </TableRow>
                             )) : <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No pending staff applications found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!editingApp} onOpenChange={() => setEditingApp(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Applicant Details</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1"><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Email</Label><Input value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Phone</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Department</Label><Input value={editDept} onChange={e => setEditDept(e.target.value)} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingApp(null)}>Cancel</Button>
                        <Button onClick={async () => {
                            if(!editingApp) return;
                            await update(ref(db, `staffApplications/${editingApp.id}`), {
                                name: editName,
                                email: editEmail,
                                phone: editPhone,
                                department: editDept
                            });
                            toast({ title: 'Application Updated' });
                            setEditingApp(null);
                        }}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
