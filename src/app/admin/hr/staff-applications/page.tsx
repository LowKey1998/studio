'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, X, Pencil, Search, Copy, UserCheck, Eye, Info } from "lucide-react";
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

type StaffApplication = {
    id: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    bio: string;
    dob?: string;
    gender?: string;
    nationalId?: string;
    passport?: string;
    address?: string;
    previousEmployer?: string;
    qualifications?: string;
    appliedAt: string;
    status: 'Pending' | 'Approved' | 'Rejected';
};

type SubRole = {
    id: string;
    name: string;
};

export default function StaffApplicationsPage() {
    const [applications, setApplications] = React.useState<StaffApplication[]>([]);
    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const { toast } = useToast();

    // Dialog States
    const [viewingApp, setViewingApp] = React.useState<StaffApplication | null>(null);
    const [editingApp, setEditingApp] = React.useState<StaffApplication | null>(null);
    const [approvingApp, setApprovingApp] = React.useState<StaffApplication | null>(null);
    
    // Edit Form State
    const [editName, setEditName] = React.useState('');
    const [editEmail, setEditEmail] = React.useState('');
    const [editPhone, setEditPhone] = React.useState('');
    const [editDept, setEditDept] = React.useState('');

    // Approval State
    const [selectedSubRoleIds, setSelectedSubRoleIds] = React.useState<string[]>([]);

    React.useEffect(() => {
        const appsRef = ref(db, 'staffApplications');
        const subRolesRef = ref(db, 'settings/subRoles');

        const unsub = onValue(appsRef, (snapshot) => {
            if (snapshot.exists()) {
                setApplications(Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...(data as any) })).sort((a,b) => b.appliedAt.localeCompare(a.appliedAt)));
            } else {
                setApplications([]);
            }
            setLoading(false);
        });

        const unsubRoles = onValue(subRolesRef, (snapshot) => {
            if (snapshot.exists()) {
                setAvailableSubRoles(Object.entries(snapshot.val()).map(([id, data]: [string, any]) => ({ id, name: data.name })));
            }
        });

        return () => { unsub(); unsubRoles(); };
    }, []);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/staff-registration`;
        navigator.clipboard.writeText(url);
        toast({ title: 'Link Copied!', description: 'You can now share this registration link with potential staff.' });
    };

    const handleConfirmApproval = async () => {
        if (!approvingApp) return;
        
        const app = approvingApp;
        setActionLoading(app.id);
        try {
            const password = Math.random().toString(36).slice(-10);
            
            await findOrCreateUser({
                id: `STF-${Date.now().toString().slice(-6)}`,
                name: app.name,
                email: app.email,
                password: password,
                phoneNumber: app.phone,
                role: 'Staff',
                department: app.department,
                subRoles: selectedSubRoleIds,
                dob: app.dob,
                gender: app.gender,
                nationalId: app.nationalId,
                passport: app.passport,
                address: app.address,
                nationality: '', 
                guardian: {}, 
            });

            await remove(ref(db, `staffApplications/${app.id}`));
            toast({ title: 'Application Approved!', description: 'Staff account created and email sent.' });
            setApprovingApp(null);
            setSelectedSubRoleIds([]);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Approval Failed', description: error.message });
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (appId: string) => {
        if (!window.confirm("Reject this application?")) return;
        await remove(ref(db, `staffApplications/${appId}`));
        toast({ title: 'Application Rejected' });
    };

    const handleSubRoleToggle = (roleId: string) => {
        setSelectedSubRoleIds(prev => 
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
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
                        <CardTitle className="text-2xl font-headline">Pending Staff Applications</CardTitle>
                        <CardDescription>Verify and approve applicants who self-registered via the public portal.</CardDescription>
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
                                        <Button variant="ghost" size="icon" onClick={() => setViewingApp(app)} title="View Full Details"><Eye className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            setEditingApp(app);
                                            setEditName(app.name);
                                            setEditEmail(app.email);
                                            setEditPhone(app.phone);
                                            setEditDept(app.department);
                                        }} title="Edit Application"><Pencil className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleReject(app.id)} title="Reject Application"><X className="h-4 w-4"/></Button>
                                        <Button size="sm" onClick={() => setApprovingApp(app)}>
                                            <UserCheck className="mr-2 h-4 w-4" />
                                            Approve
                                        </Button>
                                    </TableCell>
                                </TableRow>
                             )) : <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No pending applications.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!viewingApp} onOpenChange={() => setViewingApp(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Application Details</DialogTitle></DialogHeader>
                    {viewingApp && (
                        <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><Label className="text-xs text-muted-foreground">Full Name</Label><p className="font-medium">{viewingApp.name}</p></div>
                                <div><Label className="text-xs text-muted-foreground">Department</Label><p className="font-medium">{viewingApp.department}</p></div>
                                <div><Label className="text-xs text-muted-foreground">Email</Label><p className="font-medium">{viewingApp.email}</p></div>
                                <div><Label className="text-xs text-muted-foreground">Phone</Label><p className="font-medium">{viewingApp.phone}</p></div>
                                <div><Label className="text-xs text-muted-foreground">DOB</Label><p className="font-medium">{viewingApp.dob || 'N/A'}</p></div>
                                <div><Label className="text-xs text-muted-foreground">Gender</Label><p className="font-medium capitalize">{viewingApp.gender || 'N/A'}</p></div>
                                <div><Label className="text-xs text-muted-foreground">National ID</Label><p className="font-medium">{viewingApp.nationalId || 'N/A'}</p></div>
                                <div><Label className="text-xs text-muted-foreground">Passport</Label><p className="font-medium">{viewingApp.passport || 'N/A'}</p></div>
                            </div>
                            <Separator/>
                            <div><Label className="text-xs text-muted-foreground">Residential Address</Label><p className="text-sm">{viewingApp.address || 'N/A'}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Previous Employer / School</Label><p className="text-sm font-medium">{viewingApp.previousEmployer || 'N/A'}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Qualifications</Label><p className="text-sm whitespace-pre-wrap">{viewingApp.qualifications || 'N/A'}</p></div>
                            <div><Label className="text-xs text-muted-foreground">Professional Summary</Label><p className="text-sm bg-muted p-3 rounded-md italic">{viewingApp.bio || 'No bio provided.'}</p></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingApp(null)}>Close</Button>
                        <Button onClick={() => { if(viewingApp) setApprovingApp(viewingApp); setViewingApp(null); }}>Proceed to Approval</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!approvingApp} onOpenChange={() => setApprovingApp(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Approve {approvingApp?.name}</DialogTitle>
                        <DialogDescription>Select the sub-roles this staff member should have before creating their account.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Assigned Department</Label>
                            <p className="text-sm">{approvingApp?.department}</p>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Assign Sub-Roles</Label>
                            <ScrollArea className="h-48 rounded-md border p-2 bg-muted/20">
                                <div className="space-y-2">
                                    {availableSubRoles.map(role => (
                                        <div key={role.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded transition-colors">
                                            <Checkbox 
                                                id={`role-${role.id}`} 
                                                checked={selectedSubRoleIds.includes(role.id)} 
                                                onCheckedChange={() => handleSubRoleToggle(role.id)}
                                            />
                                            <Label htmlFor={`role-${role.id}`} className="flex-1 cursor-pointer text-sm">{role.name}</Label>
                                        </div>
                                    ))}
                                    {availableSubRoles.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No sub-roles defined in Access Rules.</p>}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setApprovingApp(null)}>Cancel</Button>
                        <Button onClick={handleConfirmApproval} disabled={!!actionLoading}>
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserCheck className="mr-2 h-4 w-4" />}
                            Confirm & Create Account
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingApp} onOpenChange={() => setEditingApp(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Applicant Basics</DialogTitle></DialogHeader>
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
                                name: editName, email: editEmail, phone: editPhone, department: editDept
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
