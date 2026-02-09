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
import { PlusCircle, MoreVertical, Search, Loader2, UserX, UserCheck, Trash2, Pencil, Copy, Download, Send, Mail, Info, Shield, CheckSquare, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from '@/components/ui/checkbox';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { ref, set, runTransaction, get, push, serverTimestamp, update, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { app, auth, db, createNotification } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { initializeApp, deleteApp } from 'firebase/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { onAuthStateChanged } from 'firebase/auth';
import { updateUserStatus } from '@/ai/flows/update-user-status';
import { setUserPassword } from '@/ai/flows/set-user-password';
import { cn } from '@/lib/utils';
import { allMenuItems, staffBaseMenuItems, studentMenuItems } from '@/lib/menu-items';
import { Textarea } from '@/components/ui/textarea';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';

type User = {
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
    exemptedCourses?: Record<string, boolean>;
    status?: 'active' | 'disabled';
    intakeId?: string;
    dob?: string;
    gender?: string;
    nationalId?: string;
    passport?: string;
    address?: string;
    guardian?: { name: string; contact: string; };
    emergencyContact?: { name: string; relationship: string; contact: string; };
    educationBackground?: { school: string; qualifications: string; };
    medicalHistory?: string;
    baseSalary?: number;
    isOnline?: boolean;
    lastSeen?: number;
};

type Programme = { id: string; name: string; };
type Semester = { id: string; name: string; status: string; year: number; semesterInYear: number; };
type Course = { id: string; name: string; code: string; year: number; }
type Intake = { id: string; name: string; }
type SubRole = { id: string; name: string; permissions: Record<string, boolean>; }

const roleVariant: { [key: string]: 'default' | 'secondary' | 'outline' } = {
  Admin: 'default',
  Staff: 'secondary',
  Student: 'outline',
};

export default function UserManagementPage() {
    const { user: adminUser, userProfile: adminProfile } = useAuth();
    const [open, setOpen] = React.useState(false);
    const [users, setUsers] = React.useState<User[]>([]);
    
    // Form state
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [role, setRole] = React.useState('');
    const [subRoleIds, setSubRoleIds] = React.useState<string[]>([]);
    const [programme, setProgramme] = React.useState('');
    const [manualId, setManualId] = React.useState('');
    const [isManualId, setIsManualId] = React.useState(false);
    const [selectedIntake, setSelectedIntake] = React.useState('');
    const [selectedYear, setSelectedYear] = React.useState('');
    const [selectedSemester, setSelectedSemester] = React.useState('');
    
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [allSemesters, setAllSemesters] = React.useState<Semester[]>([]);
    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);
    const [idSettings, setIdSettings] = React.useState<any>(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [roleFilter, setRoleFilter] = React.useState('All');
    const [isSetPasswordOpen, setIsSetPasswordOpen] = React.useState(false);
    const [settingPasswordUser, setSettingPasswordUser] = React.useState<User | null>(null);
    const [newPassword, setNewPassword] = React.useState('');
    const [passwordEmailSubject, setPasswordEmailSubject] = React.useState('');
    const [passwordEmailBody, setPasswordEmailBody] = React.useState('');
    const [settingPassword, setSettingPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        setTableLoading(true);
        const refs = {
            users: ref(db, 'users'),
            programmes: ref(db, 'programmes'),
            subRoles: ref(db, 'settings/subRoles'),
            idPrefixes: ref(db, 'settings/idPrefixes'),
            semesters: ref(db, 'semesters'),
            intakes: ref(db, 'intakes')
        };
        const dataCache: any = { users: {}, programmes: {}, subRoles: {} };
        const processAndSetUsers = () => {
            const usersData = dataCache.users;
            const programmesData = dataCache.programmes;
            const subRolesData = dataCache.subRoles;
            const subRolesMap = new Map(Object.entries(subRolesData).map(([id, role]: [string, any]) => [id, role.name]));
            const usersList: User[] = Object.keys(usersData).map(uid => {
                const user = usersData[uid];
                const uSubRoleIds = user.subRoles ? (Array.isArray(user.subRoles) ? user.subRoles : Object.values(user.subRoles)) : [];
                return {
                    uid, ...user, status: user.status || 'active',
                    programmeName: user.programmeId ? programmesData[user.programmeId]?.name : undefined,
                    subRoles: uSubRoleIds,
                    subRoleNames: uSubRoleIds.map((id: string) => subRolesMap.get(id)).filter(Boolean)
                };
            });
            setUsers(usersList); setTableLoading(false);
        };
        const unsubs = [
            onValue(refs.users, (s) => { dataCache.users = s.val() || {}; processAndSetUsers(); }),
            onValue(refs.programmes, (s) => { dataCache.programmes = s.val() || {}; setAllProgrammes(Object.keys(dataCache.programmes).map(id => ({ id, ...dataCache.programmes[id] }))); processAndSetUsers(); }),
            onValue(refs.subRoles, (s) => { dataCache.subRoles = s.val() || {}; setAvailableSubRoles(Object.keys(dataCache.subRoles).map(id => ({id, ...dataCache.subRoles[id]}))); processAndSetUsers(); }),
            onValue(refs.intakes, (s) => setAllIntakes(s.exists() ? Object.keys(s.val()).map(id => ({ id, ...s.val()[id] })) : [])),
            onValue(refs.semesters, (s) => setAllSemesters(s.exists() ? Object.keys(s.val()).map(id => ({ id, ...s.val()[id] })) : [])),
            onValue(refs.idPrefixes, (s) => setIdSettings(s.exists() ? s.val() : { student: 'STU', staff: 'STF', admin: 'ADM' })),
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setRole(''); setSubRoleIds([]); setProgramme('');
        setManualId(''); setIsManualId(false); setSelectedIntake(''); setSelectedYear(''); setSelectedSemester('');
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !role) return;
        setLoading(true);
        const tempApp = initializeApp({ apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, `temp-${Date.now()}`);
        const tempAuth = getAuth(tempApp);
        try {
            let newId = manualId || `ID-${Date.now().toString().slice(-6)}`;
            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const newUser: any = { id: newId, name, email, phoneNumber, role: role.charAt(0).toUpperCase() + role.slice(1), status: 'active' };
            if (role === 'student') Object.assign(newUser, { programmeId: programme, intakeId: selectedIntake, year: Number(selectedYear), semesterId: selectedSemester });
            else if (role === 'staff' && subRoleIds.length > 0) newUser.subRoles = subRoleIds;
            await set(ref(db, `users/${userCredential.user.uid}`), newUser);
            await set(ref(db, `userRoles/${userCredential.user.uid}`), { role });
            toast({ title: 'User Created' });
            resetForm(); setOpen(false);
        } catch (error: any) { toast({ variant: 'destructive', title: 'Error', description: error.message }); }
        finally { await deleteApp(tempApp); setLoading(false); }
    };

    const handleSetPassword = async () => {
        if (!settingPasswordUser || !newPassword) return;
        setSettingPassword(true);
        try {
            await setUserPassword({ 
                uid: settingPasswordUser.uid, 
                newPassword,
                welcomeSubject: passwordEmailSubject,
                welcomeBody: passwordEmailBody
            });
            toast({ title: 'Password Updated' });
            setIsSetPasswordOpen(false); setNewPassword('');
        } catch (error: any) { toast({ variant: 'destructive', title: 'Failed', description: error.message }); }
        finally { setSettingPassword(false); }
    }

    const filteredUsers = React.useMemo(() => {
        return users.filter(user => {
            const queryText = searchQuery.toLowerCase();
            const roleMatch = roleFilter === 'All' || user.role === roleFilter;
            
            const nameMatch = (user.name || '').toLowerCase().includes(queryText);
            const idMatch = (user.id || '').toLowerCase().includes(queryText);
            const emailMatch = (user.email || '').toLowerCase().includes(queryText);

            return roleMatch && (nameMatch || idMatch || emailMatch);
        });
    }, [users, roleFilter, searchQuery]);

    const handlePasswordResetRequest = (email: string) => {
        sendPasswordResetEmail(auth, email).then(() => {
            toast({ title: "Reset Link Sent", description: `Check ${email} for instructions.` });
        }).catch(err => {
            toast({ variant: 'destructive', title: "Failed to send", description: err.message });
        });
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle>User Management</CardTitle><CardDescription>Create and manage students and staff.</CardDescription></div>
                    <Button onClick={() => setOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Add User</Button>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search name, ID or email..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="All">All Roles</SelectItem><SelectItem value="Admin">Admin</SelectItem><SelectItem value="Staff">Staff</SelectItem><SelectItem value="Student">Student</SelectItem></SelectContent></Select>
                    </div>
                    <Table>
                        <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {tableLoading ? Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full"/></TableCell></TableRow>) :
                            filteredUsers.map(user => (
                                <TableRow key={user.uid}>
                                    <TableCell className="font-mono text-xs">{user.id}</TableCell>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell><Badge variant={roleVariant[user.role]}>{user.role}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { 
                                                    setSettingPasswordUser(user); 
                                                    setPasswordEmailSubject('Account Credentials Updated');
                                                    setPasswordEmailBody(`<p>Hello ${user.name},</p><p>Your password has been updated by an administrator. Your new temporary password is: <strong>[Password]</strong></p>`);
                                                    setIsSetPasswordOpen(true); 
                                                }}>
                                                    <Shield className="mr-2 h-4 w-4"/>Set Password
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handlePasswordResetRequest(user.email)}><Mail className="mr-2 h-4 w-4"/>Reset Link</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <form onSubmit={handleCreateUser}>
                        <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>Full Name</Label><Input value={name} onChange={e=>setName(e.target.value)} required /></div>
                                <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>Role</Label><Select onValueChange={setRole} value={role}><SelectTrigger><SelectValue placeholder="Select role"/></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1"><Label>Password</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
                            </div>
                        </div>
                        <DialogFooter><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Create User</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isSetPasswordOpen} onOpenChange={setIsSetPasswordOpen}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle>Set Password for {settingPasswordUser?.name}</DialogTitle><DialogDescription>Reset user password and customize the email notification.</DialogDescription></DialogHeader>
                    <div className="flex-1 overflow-auto py-4 space-y-6 pr-2">
                        <div className="space-y-2"><Label>New Temporary Password</Label><Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 chars" /></div>
                        <Separator />
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm uppercase text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Email Preview</h4>
                            <div className="space-y-2"><Label>Subject</Label><Input value={passwordEmailSubject} onChange={e => setPasswordEmailSubject(e.target.value)} /></div>
                            <div className="space-y-2"><Label>Body (HTML)</Label><Textarea value={passwordEmailBody} onChange={e => setPasswordEmailBody(e.target.value)} rows={12} className="font-mono text-xs" /></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSetPassword} disabled={settingPassword || newPassword.length < 6}>{settingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}Update Password</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}