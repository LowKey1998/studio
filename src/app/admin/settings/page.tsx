
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar as CalendarIcon, Upload, ShieldAlert, BadgeInfo, HandCoins, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth, storage } from '@/lib/firebase';
import { ref, get, set, update, onValue } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';


type Prefixes = {
    student: string;
    staff: string;
    admin: string;
};

type Institution = {
    name: string;
    logoUrl?: string;
}

type LeavePolicy = {
    maxDays: number;
};

type RegistrationPolicy = {
    lateRegistrationStartDate?: string;
    lateRegistrationEndDate?: string;
    lateRegistrationFee: number;
};

type EnrollmentPolicy = 'onCoveredCourses';
type OverduePolicy = 'doNothing' | 'suspendAccess';

type PaymentMethods = {
    flutterwave: { enabled: boolean };
}

export default function SettingsPage() {
    const [prefixes, setPrefixes] = React.useState<Prefixes>({ student: 'STU', staff: 'STF', admin: 'ADM' });
    const [institution, setInstitution] = React.useState<Institution>({ name: 'Edutrack360' });
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);

    const [leavePolicy, setLeavePolicy] = React.useState<LeavePolicy>({ maxDays: 14 });
    const [registrationPolicy, setRegistrationPolicy] = React.useState<RegistrationPolicy>({ lateRegistrationFee: 0 });
    const [enrollmentPolicy, setEnrollmentPolicy] = React.useState<EnrollmentPolicy>('onCoveredCourses');
    const [overduePolicy, setOverduePolicy] = React.useState<OverduePolicy>('doNothing');
    const [lateRegDateRange, setLateRegDateRange] = React.useState<DateRange | undefined>();
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethods>({ flutterwave: { enabled: true } });
    
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [isHR, setIsHR] = React.useState(false);
    const [isRegistrar, setIsRegistrar] = React.useState(false);
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [isAccountant, setIsAccountant] = React.useState(false);

    const { toast } = useToast();

     React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userRef = ref(db, `users/${user.uid}`);
                const snapshot = await get(userRef);
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    const userIsAdmin = userData.role?.toLowerCase() === 'admin';
                    const userIsHR = userIsAdmin || (userData.role === 'Staff' && userData.subRoles?.includes('HR'));
                    const userIsRegistrar = userIsAdmin || (userData.role === 'Staff' && userData.subRoles?.includes('Registrar'));
                    const userIsAccountant = userIsAdmin || (userData.role === 'Staff' && userData.subRoles?.includes('Accountant'));
                    
                    setIsAdmin(userIsAdmin);
                    setIsHR(userIsHR);
                    setIsRegistrar(userIsRegistrar);
                    setIsAccountant(userIsAccountant);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings');
        const unsub = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setPrefixes(data.idPrefixes || { student: 'STU', staff: 'STF', admin: 'ADM' });
                setInstitution(data.institution || { name: 'Edutrack360' });
                setLeavePolicy(data.leavePolicy || { maxDays: 14 });
                const regPolicy = data.registrationPolicy || { lateRegistrationFee: 0 };
                setRegistrationPolicy(regPolicy);
                setLateRegDateRange({
                    from: regPolicy.lateRegistrationStartDate ? parseISO(regPolicy.lateRegistrationStartDate) : undefined,
                    to: regPolicy.lateRegistrationEndDate ? parseISO(regPolicy.lateRegistrationEndDate) : undefined,
                });
                setEnrollmentPolicy('onCoveredCourses'); // Always set to this policy
                setPaymentMethods(data.paymentMethods || { flutterwave: { enabled: true } });
                setOverduePolicy(data.overduePolicy || 'doNothing');
            }
             setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>,
        setter: React.Dispatch<React.SetStateAction<any>>,
        key: string
    ) => {
        let value: string | number = e.target.value;
        if(e.target.name.includes("Prefix")) value = value.toUpperCase();
        setter((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                toast({
                variant: 'destructive',
                title: 'File Too Large',
                description: 'Please select an image smaller than 2MB.',
                });
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleLeavePolicyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        setLeavePolicy({ maxDays: Number(value) });
    };

    const handleRegistrationPolicyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setRegistrationPolicy(prev => ({ ...prev, [name]: Number(value) }));
    }

    const handlePaymentMethodToggle = (method: keyof PaymentMethods, checked: boolean) => {
        setPaymentMethods(prev => ({
            ...prev,
            [method]: { ...prev[method], enabled: checked }
        }));
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const settingsRef = ref(db, 'settings');
            
            let logoUrl: string | null = institution.logoUrl || null;
            if (logoFile) {
                const logoStorageRef = storageRef(storage, `institution/logo_${Date.now()}`);
                const snapshot = await uploadBytes(logoStorageRef, logoFile);
                logoUrl = await getDownloadURL(snapshot.ref);
            }

            const updatedRegistrationPolicy = {
                ...registrationPolicy,
                lateRegistrationStartDate: lateRegDateRange?.from ? format(lateRegDateRange.from, 'yyyy-MM-dd') : null,
                lateRegistrationEndDate: lateRegDateRange?.to ? format(lateRegDateRange.to, 'yyyy-MM-dd') : null,
            };

            await update(settingsRef, { 
                idPrefixes: prefixes,
                institution: { ...institution, logoUrl: logoUrl },
                leavePolicy: leavePolicy,
                registrationPolicy: updatedRegistrationPolicy,
                enrollmentPolicy: 'onCoveredCourses', // Hardcode the policy
                paymentMethods: paymentMethods,
                overduePolicy: overduePolicy
            });
            toast({
                variant: 'success',
                title: 'Settings Saved',
                description: 'System settings have been updated successfully.',
            });
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6">
            <Card className="shadow-lg">
                 <CardHeader>
                    <CardTitle className="font-headline text-2xl">Institution Details</CardTitle>
                    <CardDescription>Set your institution's name and logo for branding on documents.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <Label htmlFor="institution-name">Institution Name</Label>
                        <div className="sm:col-span-2">
                           <Input 
                                id="institution-name" 
                                name="name"
                                value={institution.name}
                                onChange={(e) => handleInputChange(e, setInstitution, 'name')}
                                className="max-w-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start">
                        <Label htmlFor="institution-logo">Institution Logo</Label>
                        <div className="sm:col-span-2 flex items-center gap-4">
                            <div className="w-20 h-20 rounded-md border p-1 flex items-center justify-center bg-muted">
                                {logoPreview || institution.logoUrl ? (
                                    <Image src={logoPreview || institution.logoUrl!} alt="Logo Preview" width={80} height={80} className="object-contain" data-ai-hint="logo"/>
                                ) : (
                                    <span className="text-xs text-muted-foreground">No Logo</span>
                                )}
                            </div>
                           <Input id="institution-logo" type="file" onChange={handleLogoChange} accept="image/*" className="max-w-xs"/>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">User ID Prefixes</CardTitle>
                    <CardDescription>Manage system-wide settings for User ID prefixes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Skeleton className="h-5 w-32" />
                                <div className="sm:col-span-2">
                                    <Skeleton className="h-10 w-full max-w-sm" />
                                </div>
                            </div>
                        ))
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Label htmlFor="student-prefix">Student ID Prefix</Label>
                                <div className="sm:col-span-2">
                                    <Input 
                                        id="student-prefix" 
                                        name="student"
                                        value={prefixes.student}
                                        onChange={(e) => handleInputChange(e, setPrefixes, 'student')}
                                        className="max-w-sm"
                                        disabled={saving}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Label htmlFor="staff-prefix">Staff ID Prefix</Label>
                                <div className="sm:col-span-2">
                                    <Input 
                                        id="staff-prefix" 
                                        name="staff"
                                        value={prefixes.staff}
                                        onChange={(e) => handleInputChange(e, setPrefixes, 'staff')}
                                        className="max-w-sm"
                                        disabled={saving}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Label htmlFor="admin-prefix">Admin ID Prefix</Label>
                                <div className="sm:col-span-2">
                                    <Input 
                                        id="admin-prefix" 
                                        name="admin"
                                        value={prefixes.admin}
                                        onChange={(e) => handleInputChange(e, setPrefixes, 'admin')}
                                        className="max-w-sm"
                                        disabled={saving}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {(isRegistrar || isAdmin) && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Registration & Enrollment Policy</CardTitle>
                        <CardDescription>Configure settings for registration and automatic student enrollment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         {loading ? (
                             <Skeleton className="h-10 w-full max-w-sm" />
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                    <Label htmlFor="lateRegistrationFee">Late Registration Penalty (ZMW)</Label>
                                    <div className="sm:col-span-2">
                                        <Input
                                            id="lateRegistrationFee"
                                            name="lateRegistrationFee"
                                            type="number"
                                            value={registrationPolicy.lateRegistrationFee}
                                            onChange={handleRegistrationPolicyChange}
                                            className="max-w-sm"
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                                    <div className="space-y-1">
                                        <Label>Automatic Enrollment Rule</Label>
                                        <p className="text-xs text-muted-foreground">The system is set to Pay-as-you-go. Students gain access to courses as they pay for them.</p>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <div className="border p-3 rounded-md bg-primary/5 border-primary">
                                            <div className="flex items-center space-x-2">
                                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                                <Label htmlFor="onCoveredCourses" className="font-semibold">Pay-as-you-go</Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground ml-6">Students are enrolled only in the specific courses and fees their cumulative payments can cover. More courses are unlocked as more payments are made.</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                         )}
                    </CardContent>
                </Card>
            )}

            {(isAccountant || isAdmin) && (
                 <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Payment Policy</CardTitle>
                        <CardDescription>Configure payment methods and rules for overdue payments.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {loading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                    <Skeleton className="h-5 w-32" />
                                    <div className="sm:col-span-2"> <Skeleton className="h-10 w-full max-w-sm" /> </div>
                                </div>
                            ))
                        ) : (
                            <>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Label htmlFor="flutterwave-switch">Flutterwave Payments</Label>
                                <div className="sm:col-span-2">
                                    <Switch id="flutterwave-switch" checked={paymentMethods.flutterwave.enabled} onCheckedChange={(checked) => handlePaymentMethodToggle('flutterwave', checked)} disabled={saving} />
                                    <p className="text-xs text-muted-foreground mt-1"> {paymentMethods.flutterwave.enabled ? 'Students can pay online via Mobile Money.' : 'Online payments are currently disabled.'} </p>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                                <div className="space-y-1">
                                    <Label>Overdue Payment Rule</Label>
                                    <p className="text-xs text-muted-foreground">Define what action the system should take automatically when a student misses a payment deadline.</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <RadioGroup value={overduePolicy} onValueChange={(v) => setOverduePolicy(v as OverduePolicy)} className="space-y-2">
                                        <div className="border p-3 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="doNothing" id="doNothing" />
                                                <Label htmlFor="doNothing" className="font-semibold flex items-center gap-2"><BadgeInfo/> Do Nothing (Manual Follow-up)</Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground ml-6">The system will take no action. Staff must manually follow up on overdue payments.</p>
                                        </div>
                                         <div className="border p-3 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="suspendAccess" id="suspendAccess" />
                                                <Label htmlFor="suspendAccess" className="font-semibold flex items-center gap-2"><ShieldAlert/> Suspend Student Portal Access</Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground ml-6">The student's account will be automatically disabled, preventing login until the payment is made or their status is manually reactivated by an admin.</p>
                                        </div>
                                    </RadioGroup>
                                </div>
                            </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {(isHR || isAdmin) && (
                 <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Leave Policy</CardTitle>
                        <CardDescription>Configure settings for staff leave applications.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {loading ? (
                             <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Skeleton className="h-5 w-32" />
                                <div className="sm:col-span-2">
                                    <Skeleton className="h-10 w-full max-w-sm" />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                <Label htmlFor="max-leave-days">Max Leave Days per Request</Label>
                                <div className="sm:col-span-2">
                                    <Input 
                                        id="max-leave-days" 
                                        name="maxDays"
                                        type="number"
                                        value={leavePolicy.maxDays}
                                        onChange={handleLeavePolicyChange}
                                        className="max-w-sm"
                                        disabled={saving}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save All Changes'}
                </Button>
            </div>
        </form>
    );
}
