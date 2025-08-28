
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import * as React from 'react';
import { UserPlus } from 'lucide-react';
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
import { Loader2 } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, push, serverTimestamp } from 'firebase/database';
import { app, auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { onAuthStateChanged } from 'firebase/auth';

type SubRole = {
    id: string;
    name: string;
    permissions: Record<string, boolean>;
}

type Department = {
    id: string;
    name: string;
}

type CurrentAdmin = {
    name: string;
    id: string;
}

export default function AddStaffPage() {
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [role, setRole] = React.useState('Staff'); // Default to staff
    const [subRoles, setSubRoles] = React.useState<string[]>([]);
    const [department, setDepartment] = React.useState('');
    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);
    const [availableDepartments, setAvailableDepartments] = React.useState<Department[]>([]);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);

    const [loading, setLoading] = React.useState(false);
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
        
        const subRolesRef = ref(db, 'settings/subRoles');
        get(subRolesRef).then((snapshot) => {
            if (snapshot.exists()) {
                setAvailableSubRoles(Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})));
            }
        });
        
        const deptsRef = ref(db, 'settings/departments');
        get(deptsRef).then((snapshot) => {
            if (snapshot.exists()) {
                setAvailableDepartments(Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})));
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const resetForm = () => {
        setName('');
        setEmail('');
        setPassword('');
        setPhoneNumber('');
        setRole('Staff');
        setSubRoles([]);
        setDepartment('');
    };
    
    const handleSubRoleChange = (subRoleName: string) => {
        setSubRoles(prev => prev.includes(subRoleName) ? prev.filter(r => r !== subRoleName) : [...prev, subRoleName]);
    };

    const handleCreateStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !password) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill out all required fields.' });
            return;
        }

        setLoading(true);
        
        const tempAppName = `temp-staff-creation-${Date.now()}`;
        const firebaseConfig = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
        const tempApp = initializeApp(firebaseConfig, tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            const prefixesRef = ref(db, 'settings/idPrefixes');
            const prefixesSnapshot = await get(prefixesRef);
            const prefixes = prefixesSnapshot.exists() ? prefixesSnapshot.val() : { staff: 'STF' };
            const counterRef = ref(db, 'userCounters/staff');
            let newId = '';
            
            await runTransaction(counterRef, (currentCount) => {
                const count = (currentCount || 0) + 1;
                const prefix = prefixes.staff || 'STF';
                newId = `${prefix}-${String(count).padStart(3, '0')}`;
                return count;
            });

            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const user = userCredential.user;
            
            const newStaffUser = { 
                id: newId, 
                name, 
                email, 
                phoneNumber, 
                role: 'Staff', 
                status: 'active',
                subRoles: subRoles,
                department: department
            };

            await set(ref(db, `users/${user.uid}`), newStaffUser);
            
            await set(ref(db, `userRoles/${user.uid}`), { role: 'staff' });
            const activityRef = push(ref(db, 'recentActivities'));
            await set(activityRef, { 
                user: currentAdmin?.name || 'Admin', 
                userId: currentAdmin?.id || 'N/A', 
                action: `created a new staff account for '${name}' (**${newId}**).`, 
                timestamp: serverTimestamp() 
            });

            toast({ variant: 'success', title: 'Staff Created Successfully', description: `${name} has been created with User ID: ${newId}` });
            resetForm();
        } catch (error: any) {
            console.error("Error creating staff user:", error);
            toast({ variant: 'destructive', title: 'User Creation Failed', description: error.message || 'An unexpected error occurred.' });
        } finally {
            await deleteApp(tempApp);
            setLoading(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl"><UserPlus/> Add New Staff Member</CardTitle>
                <CardDescription>Create a new account for a staff member and assign their roles.</CardDescription>
            </CardHeader>
            <CardContent>
                 <form id="add-staff-form" className="space-y-4" onSubmit={handleCreateStaff}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Full Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading}/></div>
                        <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></div>
                        <div className="space-y-1"><Label>Phone Number (Optional)</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                        <div className="space-y-1"><Label>Initial Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/></div>
                    </div>
                     <div className="space-y-1">
                        <Label>Department</Label>
                        <Select onValueChange={setDepartment} value={department}>
                            <SelectTrigger><SelectValue placeholder="Select a department"/></SelectTrigger>
                            <SelectContent>
                                {availableDepartments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2 rounded-md border p-4">
                        <Label className="font-semibold">Sub-Roles</Label>
                        <p className="text-sm text-muted-foreground">Select all applicable roles. Permissions are managed in Access Rules.</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                            {availableSubRoles.map(subRoleItem => (
                                <div key={subRoleItem.id} className="flex items-center gap-2">
                                    <Checkbox 
                                        id={`create-${subRoleItem.id}`} 
                                        checked={subRoles.includes(subRoleItem.name)} 
                                        onCheckedChange={() => handleSubRoleChange(subRoleItem.name)} 
                                        disabled={loading}
                                    />
                                    <Label htmlFor={`create-${subRoleItem.id}`} className="font-normal">{subRoleItem.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter>
                 <Button type="submit" form="add-staff-form" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Create Staff Account
                </Button>
            </CardFooter>
        </Card>
    )
}
