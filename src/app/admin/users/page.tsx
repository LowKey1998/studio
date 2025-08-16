
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, MoreVertical, Search, Loader2, UserX, UserCheck, Trash2, Pencil } from 'lucide-react';
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
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, child, push, serverTimestamp, update, onValue, remove } from 'firebase/database';
import { app, auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { onAuthStateChanged } from 'firebase/auth';
import { updateUserStatus } from '@/ai/flows/update-user-status';
import { cn } from '@/lib/utils';
import { allMenuItems, staffBaseMenuItems } from '@/lib/menu-items';


type User = {
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    subRoles?: string[];
    programmeId?: string;
    year?: number;
    exemptedCourses?: Record<string, boolean>;
    status?: 'active' | 'disabled';
    intakeId?: string;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type Course = {
    id: string;
    name: string;
    code: string;
    year: number;
}

type CurrentAdmin = {
    name: string;
    id: string;
}

type Intake = {
    id: string;
    name: string;
}

type SubRole = {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
}

const roleVariant: { [key: string]: 'default' | 'secondary' | 'outline' } = {
  Admin: 'default',
  Staff: 'secondary',
  Student: 'outline',
};

export default function UserManagementPage() {
    const [open, setOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [users, setUsers] = React.useState<User[]>([]);
    
    // State for creating a user
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [role, setRole] = React.useState('');
    const [subRoles, setSubRoles] = React.useState<string[]>([]);
    const [programme, setProgramme] = React.useState('');
    const [year, setYear] = React.useState('');
    const [isTransfer, setIsTransfer] = React.useState(false);
    const [exemptedCourses, setExemptedCourses] = React.useState<Record<string, boolean>>({});
    const [selectedIntake, setSelectedIntake] = React.useState('');


    // State for editing a user
    const [editingUser, setEditingUser] = React.useState<User | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editRole, setEditRole] = React.useState('');
    const [editSubRoles, setEditSubRoles] = React.useState<string[]>([]);
    const [editProgramme, setEditProgramme] = React.useState('');
    const [editIntake, setEditIntake] = React.useState('');
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    
    // Data for dialogs
    const [allProgrammes, setAllProgrammes] = React.useState<Programme[]>([]);
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [allIntakes, setAllIntakes] = React.useState<Intake[]>([]);
    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);


    // State for filtering and searching
    const [searchQuery, setSearchQuery] = React.useState('');
    const [roleFilter, setRoleFilter] = React.useState('All');
    

    const [loading, setLoading] = React.useState(false);
    const [tableLoading, setTableLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            if (snapshot.exists()) {
              const userData = snapshot.val();
              setCurrentAdmin({ name: userData.name, id: userData.id });
            }
          }
        });
        return () => unsubscribe();
    }, []);

    const fetchInitialData = React.useCallback(async () => {
        setTableLoading(true);
        try {
            const usersRef = ref(db, 'users');
            onValue(usersRef, (snapshot) => {
                 if (snapshot.exists()) {
                    const usersData = snapshot.val();
                    const usersList: User[] = Object.keys(usersData).map(uid => ({
                        uid,
                        ...usersData[uid],
                        status: usersData[uid].status || 'active',
                    }));
                    setUsers(usersList);
                } else { setUsers([]); }
                setTableLoading(false);
            })

            const [programmesSnap, coursesSnap, intakesSnap] = await Promise.all([
                get(child(ref(db), 'programmes')),
                get(child(ref(db), 'courses')),
                get(child(ref(db), 'intakes')),
            ]);

            if (programmesSnap.exists()) setAllProgrammes(Object.keys(programmesSnap.val()).map(id => ({ id, ...programmesSnap.val()[id] }))); else setAllProgrammes([]);
            if (coursesSnap.exists()) setAllCourses(Object.keys(coursesSnap.val()).map(id => ({ id, ...coursesSnap.val()[id] }))); else setAllCourses([]);
            if (intakesSnap.exists()) setAllIntakes(Object.keys(intakesSnap.val()).map(id => ({ id, ...intakesSnap.val()[id] }))); else setAllIntakes([]);
            
            const subRolesRef = ref(db, 'settings/subRoles');
            onValue(subRolesRef, (snapshot) => {
                 if (snapshot.exists()) {
                    const subRolesData = snapshot.val();
                    setAvailableSubRoles(Object.keys(subRolesData).map(id => ({id, ...subRolesData[id]})));
                } else { setAvailableSubRoles([]) }
            });


        } catch (error) {
            console.error("Error fetching data:", error);
             toast({ variant: 'destructive', title: 'Failed to fetch data', description: 'Could not load data from the database.' });
            setTableLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setRole(''); setSubRoles([]); setProgramme(''); setYear(''); setIsTransfer(false); setExemptedCourses({}); setSelectedIntake('');
    };
    
    const handleSubRoleChange = (subRoleName: string, setRoles: React.Dispatch<React.SetStateAction<string[]>>) => {
        setRoles(prev => prev.includes(subRoleName) ? prev.filter(r => r !== subRoleName) : [...prev, subRoleName]);
    };


    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password || !role) { toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required fields.' }); return; }
        if (role === 'student' && (!programme || !year || !selectedIntake)) { toast({ variant: 'destructive', title: 'Missing Student Info', description: 'Please assign an intake, programme and year for the student.' }); return; }

        setLoading(true);
        
        const tempAppName = `temp-user-creation-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            const prefixesRef = ref(db, 'settings/idPrefixes');
            const prefixesSnapshot = await get(prefixesRef);
            const prefixes = prefixesSnapshot.exists() ? prefixesSnapshot.val() : { student: 'STU', staff: 'STF', admin: 'ADM' };
            const counterRef = ref(db, `userCounters/${role}`);
            let newId = '';
            
            await runTransaction(counterRef, (currentCount) => {
                const count = (currentCount || 0) + 1;
                const prefix = role === 'student' ? prefixes.student : role === 'staff' ? prefixes.staff : prefixes.admin;
                newId = `${prefix}-${String(count).padStart(3, '0')}`;
                return count;
            });

            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const user = userCredential.user;
            
            const newUserRole = role.charAt(0).toUpperCase() + role.slice(1);
            const newUser: Omit<User, 'uid'> = { id: newId, name, email, phoneNumber, role: newUserRole, status: 'active' };

            if (role === 'staff' && subRoles.length > 0) { newUser.subRoles = subRoles; }
            if (role === 'student') { newUser.programmeId = programme; newUser.year = Number(year); newUser.intakeId = selectedIntake; if(isTransfer && Object.keys(exemptedCourses).length > 0) newUser.exemptedCourses = exemptedCourses; }

            await set(ref(db, `users/${user.uid}`), newUser);
            await set(ref(db, `userRoles/${user.uid}`), { role: role });
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { user: currentAdmin?.name || 'Admin', userId: currentAdmin?.id || 'N/A', action: `created a new ${newUser.role} account for '${name}' (**${newId}**).`, timestamp: serverTimestamp() });
            toast({ variant: 'success', title: 'User Created Successfully', description: `${name} has been created with User ID: ${newId}` });
            resetForm(); setOpen(false);
        } catch (error: any) {
            console.error("Error creating user:", error);
            toast({ variant: 'destructive', title: 'User Creation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            await deleteApp(tempApp); setLoading(false);
        }
    };

    const handleOpenEditDialog = (user: User) => {
        setEditingUser(user); 
        setEditName(user.name); 
        setEditRole(user.role); 
        setEditSubRoles(user.subRoles || []); 
        setEditProgramme(user.programmeId || '');
        setEditIntake(user.intakeId || '');
        setIsEditOpen(true);
    };
    
    const handleToggleUserStatus = async (user: User) => {
        const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
        const disabling = newStatus === 'disabled';
        if (!window.confirm(`Are you sure you want to ${disabling ? 'disable' : 'enable'} this user? ${disabling ? 'They will be logged out immediately.' : ''}`)) return;
        setTableLoading(true);
        try {
            await updateUserStatus({ uid: user.uid, disabled: disabling });
            toast({ variant: 'success', title: 'User Status Updated', description: `${user.name} has been ${disabling ? 'disabled' : 'enabled'}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: `Failed to ${disabling ? 'disable' : 'enable'} user.` });
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser || !editName || !editRole) { toast({ variant: 'destructive', title: 'Missing Fields' }); return; }
        setLoading(true);
        try {
            const userRef = ref(db, `users/${editingUser.uid}`);
            const updatedUserData: Partial<User> = { name: editName, role: editRole };
             if (editRole === 'Staff') {
                updatedUserData.subRoles = editSubRoles;
             }
             if (editRole === 'Student') {
                updatedUserData.intakeId = editIntake;
                updatedUserData.programmeId = editProgramme;
             }

            await update(userRef, updatedUserData);
            await set(ref(db, `userRoles/${editingUser.uid}`), { role: editRole.toLowerCase() });
            let action = `updated the profile for '${editName}' (**${editingUser.id}**).`;
            const changes = [];
            if(editingUser.name !== editName) changes.push(`Name changed to '${editName}'`);
            if(editingUser.role !== editRole) changes.push(`Role changed from ${editingUser.role} to ${editRole}`);
            if(JSON.stringify(editingUser.subRoles || []) !== JSON.stringify(editSubRoles)) changes.push(`Sub-roles changed to '${editSubRoles.join(', ')}'`);
            if (editRole === 'Student') {
                 if (editingUser.intakeId !== editIntake) changes.push(`Intake updated`);
                 if (editingUser.programmeId !== editProgramme) changes.push(`Programme updated`);
            }
            if(changes.length > 0) action += ` Details: ${changes.join('. ')}.`;
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { user: currentAdmin?.name || 'Admin', userId: currentAdmin?.id || 'N/A', action, timestamp: serverTimestamp() });
            toast({ variant: 'success', title: 'User Updated Successfully', description: `${editName}'s profile has been updated.` });
            setIsEditOpen(false); setEditingUser(null);
        } catch (error: any) {
             console.error("Error updating user:", error);
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'An unexpected error occurred.' });
        } finally { setLoading(false); }
    };
    
    const handleExemptionChange = (courseId: string) => {
        setExemptedCourses(prev => {
            const newExemptions = { ...prev };
            if (newExemptions[courseId]) delete newExemptions[courseId]; else newExemptions[courseId] = true;
            return newExemptions;
        });
    }

    const filteredUsers = React.useMemo(() => {
        return users.filter(user => {
            const query = searchQuery.toLowerCase();
            const roleMatch = roleFilter.toLowerCase() === 'all' || user.role.toLowerCase() === roleFilter.toLowerCase();
            const searchMatch = user.name.toLowerCase().includes(query) || user.id.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
            return roleMatch && searchMatch;
        });
    }, [users, roleFilter, searchQuery]);
    
    const coursesForSelectedProgramme = React.useMemo(() => {
        if (!programme) return [];
        const prog = allProgrammes.find(p => p.id === programme);
        if (!prog || !prog.courseIds) return [];
        return allCourses.filter(c => prog.courseIds![c.id]);
    }, [programme, allProgrammes, allCourses]);


  return (
    <>
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="font-headline text-2xl">User Management</CardTitle><CardDescription>Create, view, and manage all users in the system.</CardDescription></div>
            <div className='flex gap-2'>
                <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}><DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Add User</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-lg"><form onSubmit={handleCreateUser}><DialogHeader><DialogTitle className="font-headline">Create New User</DialogTitle><DialogDescription>A unique User ID will be generated automatically.</DialogDescription></DialogHeader>
                            <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-4 pr-4">
                                <div className="space-y-1"><Label>Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Phone Number (Optional)</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Role</Label><Select onValueChange={setRole} value={role} disabled={loading}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
                                {role === 'staff' && (<div className="space-y-2 rounded-md border p-3">
                                    <Label>Sub-Roles</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableSubRoles.map(subRoleItem => (<div key={subRoleItem.id} className="flex items-center gap-2"><Checkbox id={`create-${subRoleItem.id}`} checked={subRoles.includes(subRoleItem.name)} onCheckedChange={() => handleSubRoleChange(subRoleItem.name, setSubRoles)} disabled={loading}/><Label htmlFor={`create-${subRoleItem.id}`} className="font-normal">{subRoleItem.name}</Label></div>))}
                                    </div>
                                </div>)}
                                {role === 'student' && (<div className="space-y-4 rounded-md border p-3">
                                    <div className="space-y-1"><Label>Intake</Label><Select onValueChange={setSelectedIntake} value={selectedIntake} disabled={loading}><SelectTrigger><SelectValue placeholder="Select an intake" /></SelectTrigger><SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label>Programme</Label><Select onValueChange={setProgramme} value={programme} disabled={loading}><SelectTrigger><SelectValue placeholder="Select a programme" /></SelectTrigger><SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-1"><Label>Year of Study</Label><Input type="number" placeholder="e.g. 1" value={year} onChange={e => setYear(e.target.value)} disabled={loading}/></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="isTransfer" checked={isTransfer} onCheckedChange={(checked) => setIsTransfer(checked as boolean)} disabled={loading}/><Label htmlFor="isTransfer">This is a transfer student</Label></div>
                                    {isTransfer && (<Accordion type="single" collapsible className="w-full"><AccordionItem value="exemptions"><AccordionTrigger>Course Exemptions</AccordionTrigger><AccordionContent>{coursesForSelectedProgramme.length > 0 ? coursesForSelectedProgramme.map(course => (<div key={course.id} className="flex items-center gap-2"><Checkbox id={`exempt-${course.id}`} checked={!!exemptedCourses[course.id]} onCheckedChange={() => handleExemptionChange(course.id)}/><Label htmlFor={`exempt-${course.id}`} className="font-normal">{course.name} ({course.code})</Label></div>)) : <p className="text-sm text-muted-foreground">Select a programme to see courses.</p>}</AccordionContent></AccordionItem></Accordion>)}
                                </div>)}
                            </div>
                            <DialogFooter><DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create User'}</Button></DialogFooter>
                        </form></DialogContent>
                </Dialog>
            </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, ID, or email..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <Tabs value={roleFilter} onValueChange={setRoleFilter}><TabsList><TabsTrigger value="All">All</TabsTrigger><TabsTrigger value="Admin">Admin</TabsTrigger><TabsTrigger value="Staff">Staff</TabsTrigger><TabsTrigger value="Student">Student</TabsTrigger></TabsList></Tabs>
        </div>
      </CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>User ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {tableLoading ? ( Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell><Skeleton className="h-5 w-20" /></TableCell><TableCell><Skeleton className="h-5 w-32" /></TableCell><TableCell><Skeleton className="h-5 w-48" /></TableCell><TableCell><Skeleton className="h-5 w-16" /></TableCell><TableCell className="text-right"><Skeleton className="h-8 w-8 inline-block" /></TableCell></TableRow>))
            ) : filteredUsers.map((user) => (
              <TableRow key={user.uid} className={cn(user.status === 'disabled' && 'bg-muted/50 opacity-60')}><TableCell className="font-medium">{user.id}</TableCell><TableCell>{user.name}</TableCell><TableCell>{user.email}</TableCell>
                <TableCell><div className='flex gap-2 items-center'><Badge variant={roleVariant[user.role] || 'outline'}>{user.role} {user.subRoles && user.subRoles.length > 0 && `(${user.subRoles.join(', ')})`}</Badge>{user.status === 'disabled' && <Badge variant="destructive">Disabled</Badge>}</div></TableCell>
                <TableCell className="text-right">
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem onClick={() => handleOpenEditDialog(user)}>Edit Profile</DropdownMenuItem><DropdownMenuItem>Reset Password</DropdownMenuItem><DropdownMenuSeparator />
                        {user.status === 'disabled' ? (<DropdownMenuItem onClick={() => handleToggleUserStatus(user)}><UserCheck className="mr-2 h-4 w-4"/>Enable User</DropdownMenuItem>) : (<DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleToggleUserStatus(user)}><UserX className="mr-2 h-4 w-4"/>Disable User</DropdownMenuItem>)}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
             {!tableLoading && filteredUsers.length === 0 && (<TableRow><TableCell colSpan={5} className="h-24 text-center">No users found.</TableCell></TableRow>)}
          </TableBody>
        </Table></CardContent>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent className="sm:max-w-[425px]">
             <form onSubmit={handleUpdateUser}><DialogHeader><DialogTitle className="font-headline">Edit User Profile</DialogTitle><DialogDescription>Update the user's details below. Email and User ID cannot be changed.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-id" className="text-right">User ID</Label><Input id="edit-id" value={editingUser?.id || ''} className="col-span-3" disabled /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-email" className="text-right">Email</Label><Input id="edit-email" value={editingUser?.email || ''} className="col-span-3" disabled /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-name" className="text-right">Name</Label><Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} className="col-span-3" disabled={loading}/></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="edit-role" className="text-right">Role</Label><Select onValueChange={setEditRole} value={editRole} disabled={loading}><SelectTrigger className="col-span-3"><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent><SelectItem value="Student">Student</SelectItem><SelectItem value="Staff">Staff</SelectItem><SelectItem value="Admin">Admin</SelectItem></SelectContent></Select></div>
                    {editRole === 'Student' && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-intake" className="text-right">Intake</Label>
                                <Select onValueChange={setEditIntake} value={editIntake} disabled={loading}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select an intake" /></SelectTrigger>
                                    <SelectContent>{allIntakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-programme" className="text-right">Programme</Label>
                                <Select onValueChange={setEditProgramme} value={editProgramme} disabled={loading}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a programme" /></SelectTrigger>
                                    <SelectContent>{allProgrammes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    {editRole === 'Staff' && (<div className="grid grid-cols-4 items-start gap-4 pt-2"><Label className="text-right pt-2">Sub-Roles</Label><div className="col-span-3 space-y-2">{availableSubRoles.map(subRoleItem => (<div key={subRoleItem.id} className="flex items-center gap-2"><Checkbox id={`edit-${subRoleItem.id}`} checked={editSubRoles.includes(subRoleItem.name)} onCheckedChange={() => handleSubRoleChange(subRoleItem.name, setEditSubRoles)} disabled={loading}/><Label htmlFor={`edit-${subRoleItem.id}`} className="font-normal">{subRoleItem.name}</Label></div>))}</div></div>)}
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update User'}</Button></DialogFooter>
            </form></DialogContent>
        </Dialog>
    </Card>
    </>
  );
}

