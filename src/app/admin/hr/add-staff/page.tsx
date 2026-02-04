
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import * as React from 'react';
import { UserPlus, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, runTransaction, get, push, serverTimestamp } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { initializeApp, deleteApp } from 'firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { sendEmail } from "@/ai/flows/send-email-flow";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';

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
    // Basic Info
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [subRoleIds, setSubRoleIds] = React.useState<string[]>([]);
    
    // Identity & Address
    const [dob, setDob] = React.useState('');
    const [gender, setGender] = React.useState('');
    const [nationalId, setNationalId] = React.useState('');
    const [passport, setPassport] = React.useState('');
    const [address, setAddress] = React.useState('');
    
    // Background
    const [previousEmployer, setPreviousEmployer] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');
    const [bio, setBio] = React.useState('');

    const [availableSubRoles, setAvailableSubRoles] = React.useState<SubRole[]>([]);
    const [availableDepartments, setAvailableDepartments] = React.useState<Department[]>([]);
    const [currentAdmin, setCurrentAdmin] = React.useState<CurrentAdmin | null>(null);
    const [idSettings, setIdSettings] = React.useState<any>(null);

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
        
        get(ref(db, 'settings/subRoles')).then((snapshot) => {
            if (snapshot.exists()) setAvailableSubRoles(Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})));
        });
        
        get(ref(db, 'settings/departments')).then((snapshot) => {
            if (snapshot.exists()) setAvailableDepartments(Object.keys(snapshot.val()).map(id => ({id, ...snapshot.val()[id]})));
        });
        
        get(ref(db, 'settings/idPrefixes')).then((snapshot) => {
            if (snapshot.exists()) setIdSettings(snapshot.val());
        });

        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setName(''); setEmail(''); setPassword(''); setPhoneNumber(''); setDepartment(''); setSubRoleIds([]);
        setDob(''); setGender(''); setNationalId(''); setPassport(''); setAddress('');
        setPreviousEmployer(''); setQualifications(''); setBio('');
    };
    
    const handleSubRoleChange = (subRoleId: string) => {
        setSubRoleIds(prev => prev.includes(subRoleId) ? prev.filter(id => id !== subRoleId) : [...prev, subRoleId]);
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
            const prefixes = idSettings || { staff: 'STF' };
            const counterRef = ref(db, 'userCounters/Staff');
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
                subRoles: subRoleIds,
                department,
                dob,
                gender,
                nationalId,
                passport,
                address,
                bio,
                educationBackground: {
                    school: previousEmployer,
                    qualifications
                }
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

            const welcomeEmailBody = `
                <h2>Welcome to ${idSettings?.name || 'the Institution'}!</h2>
                <p>A staff account has been created for you. You can now access the portal using the credentials below.</p>
                <ul>
                    <li><strong>Portal Link:</strong> <a href="${window.location.origin}/login">${window.location.origin}/login</a></li>
                    <li><strong>User ID:</strong> ${newId}</li>
                    <li><strong>Password:</strong> ${password}</li>
                </ul>
                <p>We recommend you log in and change your password at your earliest convenience.</p>
                <p>Best regards,<br/>The Administration</p>
            `;

            await sendEmail({
                to: [email],
                subject: `Welcome! Your Staff Account Credentials`,
                body: welcomeEmailBody
            });

            toast({ variant: 'success', title: 'Staff Created Successfully', description: `${name} has been created with User ID: ${newId}.` });
            resetForm();
        } catch (error: any) {
            console.error("Error creating staff user:", error);
            toast({ variant: 'destructive', title: 'User Creation Failed', description: error.message });
        } finally {
            await deleteApp(tempApp);
            setLoading(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-2xl"><UserPlus/> Add New Staff Member</CardTitle>
                <CardDescription>Create a new account for a staff member and assign their roles and profile details.</CardDescription>
            </CardHeader>
            <CardContent>
                 <form id="add-staff-form" onSubmit={handleCreateStaff}>
                    <Accordion type="multiple" defaultValue={['basic', 'role']} className="w-full">
                        <AccordionItem value="basic">
                            <AccordionTrigger className="text-lg font-semibold">Basic & Identity Information</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Full Name</Label><Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading}/></div>
                                    <div className="space-y-1"><Label>Email</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading}/></div>
                                    <div className="space-y-1"><Label>Phone Number</Label><Input type="tel" placeholder="+260 977 123456" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} disabled={loading}/></div>
                                    <div className="space-y-1"><Label>Initial Password</Label><Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading}/></div>
                                    <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} disabled={loading}/></div>
                                    <div className="space-y-1"><Label>Gender</Label>
                                        <Select onValueChange={setGender} value={gender} disabled={loading}>
                                            <SelectTrigger><SelectValue placeholder="Select gender"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1"><Label>National ID</Label><Input placeholder="NRC Number" value={nationalId} onChange={e => setNationalId(e.target.value)} disabled={loading}/></div>
                                    <div className="space-y-1"><Label>Passport Number (Optional)</Label><Input placeholder="Passport Number" value={passport} onChange={e => setPassport(e.target.value)} disabled={loading}/></div>
                                </div>
                                <div className="space-y-1"><Label>Residential Address</Label><Textarea placeholder="Current residential address" value={address} onChange={e => setAddress(e.target.value)} disabled={loading}/></div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="role">
                            <AccordionTrigger className="text-lg font-semibold">Institutional Role</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-1">
                                    <Label>Department</Label>
                                    <Select onValueChange={setDepartment} value={department}>
                                        <SelectTrigger><SelectValue placeholder="Select a department"/></SelectTrigger>
                                        <SelectContent>
                                            {availableDepartments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="space-y-2 rounded-md border p-4 bg-muted/20">
                                    <Label className="font-semibold">Sub-Roles</Label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                                        {availableSubRoles.map(subRoleItem => (
                                            <div key={subRoleItem.id} className="flex items-center gap-2">
                                                <Checkbox 
                                                    id={`create-${subRoleItem.id}`} 
                                                    checked={subRoleIds.includes(subRoleItem.id)} 
                                                    onCheckedChange={() => handleSubRoleChange(subRoleItem.id)} 
                                                    disabled={loading}
                                                />
                                                <Label htmlFor={`create-${subRoleItem.id}`} className="font-normal">{subRoleItem.name}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="background">
                            <AccordionTrigger className="text-lg font-semibold">Background & Experience</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-2">
                                <div className="space-y-1"><Label>Previous Employer / School</Label><Input value={previousEmployer} onChange={e => setPreviousEmployer(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Qualifications</Label><Textarea placeholder="List academic and professional qualifications" value={qualifications} onChange={e => setQualifications(e.target.value)} disabled={loading}/></div>
                                <div className="space-y-1"><Label>Professional Bio</Label><Textarea placeholder="Short summary of experience" value={bio} onChange={e => setBio(e.target.value)} disabled={loading}/></div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </form>
            </CardContent>
            <CardFooter className="justify-end">
                 <Button type="submit" form="add-staff-form" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Create Staff Account
                </Button>
            </CardFooter>
        </Card>
    )
}
