
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, MoreVertical, Search, Loader2, UserX, UserCheck, Trash2, Pencil, Mail, Shield, CheckCircle2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox';
import { ref, get, update, onValue, push } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { updateUserStatus } from '@/ai/flows/update-user-status';
import { setUserPassword } from '@/ai/flows/set-user-password';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { updateUserAccount } from '@/ai/flows/update-user-account';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type UserProfile = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    subRoles?: string[];
    subRoleNames?: string[];
    programmeId?: string;
    programmeName?: string;
    year?: number;
    semesterId?: string;
    status?: 'active' | 'disabled';
    intakeId?: string;
    dob?: string;
    gender?: string;
    nationalId?: string;
    passport?: string;
    address?: string;
    bio?: string;
    guardian?: { name: string; contact: string; email?: string; relationship?: string; };
    emergencyContact?: { name: string; relationship: string; contact: string; };
    educationBackground?: { school: string; qualifications: string; };
    medicalHistory?: string;
    lastLogin?: number;
};

type Programme = { id: string; name: string; };
type Intake = { id: string; name: string; };
type Semester = { id: string; name: string; year: number; semesterInYear: number; intakeId: string; };
type SubRole = { id: string; name: string; permissions: Record<string, boolean>; };

const roleVariant: { [key: string]: 'default' | 'secondary' | 'outline' } = {
  Admin: 'default',
  Staff: 'secondary',
  Student: 'outline',
};

export default function UserManagementPage() {
    const { userProfile: adminProfile } = useAuth();
    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [selectedUids, setSelectedUids] = React.useState<Record<string, boolean>>({});
    
    // Form & Dialog states
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [isSetPasswordOpen, setIsSetPasswordOpen] = React.useState(false);
    const [editingUser, setEditingUser] = React.useState<UserProfile | null>(null);
    const [bulkActionLoading, setBulkActionLoading] = React.useState(false);

    // Global filters
    const [searchQuery, setSearchQuery] = React.useState('');
    const [roleFilter, setRoleFilter] = React.useState('All');

    // Shared Form Fields
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [role, setRole] = React.useState('');
    const [subRoleIds, setSubRoleIds] = React.useState<string[]>([]);
    const [programmeId, setProgrammeId] = React.useState('');
    const [intakeId, setIntakeId] = React.useState('');
    const [year, setYear] = React.useState('');
    const [semesterId, setSemesterId] = React.useState('');
    
    // Extended Form Fields
    const [dob, setDob] = React.useState('');
    const [gender, setGender] = React.useState('');
    const [nationalId, setNationalId] = React.useState('');
    const [passport, setPassport] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [bio, setBio] = React.useState('');
    const [school, setSchool] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');
    const [medicalHistory, setMedicalHistory] = React.useState('');
    
    // Guardian Info (for students)
    const [guardianName, setGuardianName] = React.useState('');
    const [guardianEmail, setGuardianEmail] = React.useState('');
    const [guardianContact, setGuardianContact] = React.useState('');
    const [guardianRelationship, setGuardianRelationship] = React.useState('');

    // Password Dialog State
    const [settingPasswordUser, setSettingPasswordUser] = React.useState<UserProfile | null>(null);
    const [newPassword, setNewPassword] = React.useState('');
    const [passwordEmailSubject, setPasswordEmailSubject] = React.useState('Your New Portal Credentials');
    const [passwordEmailBody, setPasswordEmailBody] = React.useState(`<p>Hello [Name],</p><p>Your password has been updated by an administrator. Your new credentials are:</p><ul><li><strong>User ID:</strong> [UserID]</li><li><strong>New Password:</strong> [Password]</li></ul><p>Please log in and change your password at your earliest convenience.</p>`);

    // Reference Data
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);

    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    const fetchUsers = React.useCallback(async () => {
        setTableLoading(true);
        const refs = {
            users: ref(db, 'users'),
            programmes: ref(db, 'programmes'),
            subRoles: ref(db, 'settings/subRoles'),
            semesters: ref(db, 'semesters'),
            intakes: ref(db, 'intakes')
        };
        
        try {
            const [u, p, s, i, sem] = await Promise.all([
                get(refs.users), get(refs.programmes), get(refs.subRoles), get(refs.intakes), get(refs.semesters)
            ]);
            
            const pData = p.val() || {};
            const srData = s.val() || {};
            const subRolesMap = new Map(Object.entries(srData).map(([id, r]: [string, any]) => [id, r.name]));
            
            setAllProgrammes(Object.keys(pData).map(id => ({ id, ...pData[id] })));
            setAvailableSubRoles(Object.keys(srData).map(id => ({id, ...srData[id]})));
            setAllIntakes(i.exists() ? Object.keys(i.val()).map(id => ({ id, ...i.val()[id] })) : []);
            setAllSemesters(sem.exists() ? Object.keys(sem.val()).map(id => ({ id, ...sem.val()[id] })) : []);

            if (u.exists()) {
                const usersData = u.val();
                const list: UserProfile[] = Object.keys(usersData).map(uid => {
                    const user = usersData[uid];
                    const uSubRoleIds = user.subRoles ? (Array.isArray(user.subRoles) ? user.subRoles : Object.values(user.subRoles)) : [];
                    return {
                        uid, 
                        ...user, 
                        status: user.status || 'active',
                        programmeName: user.programmeId ? pData[user.programmeId]?.name : undefined,
                        subRoles: uSubRoleIds,
                        subRoleNames: uSubRoleIds.map((id: string) => subRolesMap.get(id)).filter(Boolean)
                    };
                });
                setUsers(list);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setTableLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchUsers();
        const unsub = onValue(ref(db, 'users'), (snapshot) => { if(snapshot.exists()) fetchUsers(); });
        return () => unsub();
    }, [fetchUsers]);

    const handleOpenEdit = (user: UserProfile) => {
        setEditingUser(user);
        setName(user.name || '');
        setEmail(user.email || '');
        setPhoneNumber(user.phoneNumber || '');
        setRole(user.role?.toLowerCase() || '');
        setSubRoleIds(user.subRoles || []);
        setProgrammeId(user.programmeId || '');
        setIntakeId(user.intakeId || '');
        setYear(user.year ? String(user.year) : '');
        setSemesterId(user.semesterId || '');
        setDob(user.dob || '');
        setGender(user.gender || '');
        setNationalId(user.nationalId || '');
        setPassport(user.passport || '');
        setAddress(user.address || '');
        setBio(user.bio || '');
        setSchool(user.educationBackground?.school || '');
        setQualifications(user.educationBackground?.qualifications || '');
        setMedicalHistory(user.medicalHistory || '');
        setGuardianName(user.guardian?.name || '');
        setGuardianEmail(user.guardian?.email || '');
        setGuardianContact(user.guardian?.contact || '');
        setGuardianRelationship(user.guardian?.relationship || '');
        setIsEditOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setLoading(true);
        try {
            const dbData: any = {
                role: role.charAt(0).toUpperCase() + role.slice(1),
                phoneNumber,
                subRoles: subRoleIds,
                dob, gender, nationalId, passport, address, bio, medicalHistory,
                educationBackground: { school, qualifications }
            };
            
            if (role === 'student') {
                dbData.programmeId = programmeId;
                dbData.intakeId = intakeId;
                dbData.year = Number(year);
                dbData.semesterId = semesterId;
                dbData.guardian = { name: guardianName, email: guardianEmail, contact: guardianContact, relationship: guardianRelationship };
            }

            await updateUserAccount({
                uid: editingUser.uid,
                name,
                email,
                phoneNumber,
                dbData
            });
            
            toast({ title: 'User Updated' });
            setIsEditOpen(false);
            resetForm();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSelection = (uid: string) => {
        setSelectedUids(prev => ({ ...prev, [uid]: !prev[uid] }));
    };

    const handleSelectAll = (checked: boolean) => {
        const next: Record<string, boolean> = {};
        if (checked) filteredUsers.forEach(u => next[u.uid] = true);
        setSelectedUids(next);
    };

    const handleBulkStatusUpdate = async (disabled: boolean) => {
        setBulkActionLoading(true);
        const uids = Object.keys(selectedUids).filter(uid => selectedUids[uid]);
        try {
            const promises = uids.map(uid => updateUserStatus({ uid, disabled }));
            const dbUpdates: Record<string, any> = {};
            uids.forEach(uid => dbUpdates[`users/${uid}/status`] = disabled ? 'disabled' : 'active');
            await Promise.all([...promises, update(ref(db), dbUpdates)]);
            toast({ title: `Bulk Update Complete`, description: `${uids.length} users have been ${disabled ? 'disabled' : 'enabled'}.` });
            setSelectedUids({});
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        const count = Object.values(selectedUids).filter(Boolean).length;
        if (!window.confirm(`Are you sure you want to delete ${count} users? This will remove their database records but NOT their authentication credentials.`)) return;
        setBulkActionLoading(true);
        const uids = Object.keys(selectedUids).filter(uid => selectedUids[uid]);
        try {
            const updates: Record<string, null> = {};
            uids.forEach(uid => {
                updates[`users/${uid}`] = null;
                updates[`userRoles/${uid}`] = null;
            });
            await update(ref(db), updates);
            toast({ title: 'Bulk Deletion Complete' });
            setSelectedUids({});
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Deletion Failed' });
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleSetPassword = async () => {
        if (!settingPasswordUser || !newPassword) return;
        setLoading(true);
        try {
            await setUserPassword({ 
                uid: settingPasswordUser.uid, 
                newPassword,
                welcomeSubject: passwordEmailSubject,
                welcomeBody: passwordEmailBody
            });
            toast({ title: 'Password Updated Successfully' });
            setIsSetPasswordOpen(false); 
            setNewPassword('');
        } catch (error: any) { 
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message }); 
        } finally { 
            setLoading(false); 
        }
    };

    const handlePasswordResetRequest = (email: string) => {
        sendPasswordResetEmail(auth, email).then(() => {
            toast({ title: "Reset Link Sent", description: `Check ${email} for instructions.` });
        }).catch(err => {
            toast({ variant: 'destructive', title: "Failed to send link", description: err.message });
        });
    };

    const filteredUsers = React.useMemo(() => {
        const queryText = searchQuery.toLowerCase();
        return users.filter(user => {
            const roleMatch = roleFilter === 'All' || user.role === roleFilter;
            const nameMatch = (user.name || '').toLowerCase().includes(queryText);
            const idMatch = (user.id || '').toLowerCase().includes(queryText);
            const emailMatch = (user.email || '').toLowerCase().includes(queryText);
            return roleMatch && (nameMatch || idMatch || emailMatch);
        });
    }, [users, roleFilter, searchQuery]);

    const selectedCount = Object.values(selectedUids).filter(Boolean).length;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><CardTitle className="text-2xl font-headline">User Management</CardTitle><CardDescription>Manage student and staff accounts across the institution.</CardDescription></div>
                    <Button asChild><Link href="/admin/admissions/add-student"><PlusCircle className="mr-2 h-4 w-4"/>Add Student</Link></Button>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search name, ID or email..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-full md:w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="All">All Roles</SelectItem><SelectItem value="Admin">Admin</SelectItem><SelectItem value="Staff">Staff</SelectItem><SelectItem value="Student">Student</SelectItem></SelectContent></Select>
                    </div>

                    {selectedCount > 0 && (
                        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm font-bold text-primary">{selectedCount} Selected</span>
                            <Separator orientation="vertical" className="h-6 mx-2" />
                            <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate(false)} disabled={bulkActionLoading}>Enable</Button>
                            <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate(true)} disabled={bulkActionLoading}>Disable</Button>
                            <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkActionLoading}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    )}

                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-12"><Checkbox checked={selectedCount === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={handleSelectAll} /></TableHead>
                                    <TableHead>System ID</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableLoading ? Array.from({length: 8}).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full"/></TableCell></TableRow>) :
                                filteredUsers.map(user => (
                                    <TableRow key={user.uid} className={cn(selectedUids[user.uid] && "bg-muted")}>
                                        <TableCell><Checkbox checked={!!selectedUids[user.uid]} onCheckedChange={() => handleToggleSelection(user.uid)} /></TableCell>
                                        <TableCell className="font-mono text-xs">{user.id}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{user.name}</span>
                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant={roleVariant[user.role] || 'outline'} className="w-fit">{user.role}</Badge>
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{user.subRoleNames?.join(', ')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant={user.status === 'active' ? 'default' : 'destructive'} className="capitalize">{user.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenEdit(user)}><Pencil className="mr-2 h-4 w-4"/>Edit Profile</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => { setSettingPasswordUser(user); setIsSetPasswordOpen(true); }}><Shield className="mr-2 h-4 w-4"/>Reset Password</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handlePasswordResetRequest(user.email)}><Mail className="mr-2 h-4 w-4"/>Send Reset Link</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader><DialogTitle>Edit User: {editingUser?.name}</DialogTitle><DialogDescription>Update professional and personal details.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-auto pr-4 py-4">
                        <form id="edit-user-form" onSubmit={handleSaveEdit}>
                            <Accordion type="multiple" defaultValue={['basic', 'academic']} className="w-full">
                                <AccordionItem value="basic">
                                    <AccordionTrigger className="text-lg font-semibold">Basic & Identity</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Email</Label><Input value={email} readOnly disabled /></div>
                                            <div className="space-y-1"><Label>Phone</Label><Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Gender</Label>
                                                <Select value={gender} onValueChange={setGender}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select>
                                            </div>
                                            <div className="space-y-1"><Label>National ID</Label><Input value={nationalId} onChange={e => setNationalId(e.target.value)} /></div>
                                        </div>
                                        <div className="space-y-1"><Label>Residential Address</Label><Textarea value={address} onChange={e => setAddress(e.target.value)} /></div>
                                    </AccordionContent>
                                </AccordionItem>
                                {role === 'student' && (
                                    <AccordionItem value="academic">
                                        <AccordionTrigger className="text-lg font-semibold">Student Academic Info</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label>Programme</Label>
                                                    <Select value={programmeId} onValueChange={setProgrammeId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allProgrammes.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                                <div className="space-y-1"><Label>Intake</Label>
                                                    <Select value={intakeId} onValueChange={setIntakeId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allIntakes.map(i=><SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                                <div className="space-y-1"><Label>Year</Label><Input type="number" value={year} onChange={e => setYear(e.target.value)} /></div>
                                                <div className="space-y-1"><Label>Semester</Label>
                                                    <Select value={semesterId} onValueChange={setSemesterId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{allSemesters.filter(s=>s.intakeId === intakeId).map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                            </div>
                                            <Separator />
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label>Guardian Name</Label><Input value={guardianName} onChange={e => setGuardianName(e.target.value)} /></div>
                                                <div className="space-y-1"><Label>Guardian Contact</Label><Input value={guardianContact} onChange={e => setGuardianContact(e.target.value)} /></div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                                {role === 'staff' && (
                                    <AccordionItem value="staff">
                                        <AccordionTrigger className="text-lg font-semibold">Staff Configuration</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <Label>Sub-Roles</Label>
                                            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/20">
                                                {availableSubRoles.map(sr => (
                                                    <div key={sr.id} className="flex items-center gap-2">
                                                        <Checkbox id={`sr-${sr.id}`} checked={subRoleIds.includes(sr.id)} onCheckedChange={(c) => setSubRoleIds(prev => c ? [...prev, sr.id] : prev.filter(id => id !== sr.id))}/>
                                                        <Label htmlFor={`sr-${sr.id}`} className="font-normal">{sr.name}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-1"><Label>Professional Bio</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} /></div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )}
                            </Accordion>
                        </form>
                    </div>
                    <DialogFooter><Button type="submit" form="edit-user-form" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Changes</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isSetPasswordOpen} onOpenChange={setIsSetPasswordOpen}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle>Set Password for {settingPasswordUser?.name}</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-auto py-4 space-y-6">
                        <div className="space-y-2"><Label>New Password</Label><Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 chars" /></div>
                        <Separator />
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Branded Email Notification</h4>
                            <div className="space-y-2"><Label>Subject</Label><Input value={passwordEmailSubject} onChange={e => setPasswordEmailSubject(e.target.value)} /></div>
                            <div className="space-y-2"><Label>Body (HTML)</Label><Textarea value={passwordEmailBody} onChange={e => setPasswordEmailBody(e.target.value)} rows={12} className="font-mono text-xs" /></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSetPassword} disabled={loading || newPassword.length < 6}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Update Password</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
