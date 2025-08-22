
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Upload, ShieldAlert, BadgeInfo, HandCoins, PlusCircle, Trash2, Users, Save, Pencil, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth, storage } from '@/lib/firebase';
import { ref, get, set, update, onValue, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import Image from 'next/image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { allMenuItems } from '@/lib/menu-items';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type IDPrefixes = { 
    student: string; 
    staff: string; 
    admin: string; 
    includeYear: boolean;
    includeMonth: boolean;
};
type Institution = { name: string; logoUrl?: string; }
type LeavePolicy = { maxDays: number; };
type OverduePolicy = 'doNothing' | 'suspendAccess';
type PaymentMethods = { flutterwave: { enabled: boolean }; }
type Integrations = { quickbooks: { enabled: boolean; apiKey?: string; }; sage: { enabled: boolean; apiKey?: string; }};
type SubRole = { id: string; name: string; permissions: Record<string, boolean>; };
type RegistrationPolicy = { lateRegistrationFee: number };
type Department = { id: string; name: string; };

export default function SettingsPage() {
    const [prefixes, setPrefixes] = React.useState<IDPrefixes>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
    const [institution, setInstitution] = React.useState<Institution>({ name: 'Edutrack360' });
    const [logoFile, setLogoFile] = React.useState<File | null>(null);
    const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
    const [leavePolicy, setLeavePolicy] = React.useState<LeavePolicy>({ maxDays: 14 });
    const [overduePolicy, setOverduePolicy] = React.useState<OverduePolicy>('doNothing');
    const [registrationPolicy, setRegistrationPolicy] = React.useState<RegistrationPolicy>({ lateRegistrationFee: 0 });
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethods>({ flutterwave: { enabled: true } });
    const [integrations, setIntegrations] = React.useState<Integrations>({ quickbooks: { enabled: false }, sage: { enabled: false } });
    const [subRoles, setSubRoles] = React.useState<SubRole[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    
    // Dialog State
    const [isRoleDialogOpen, setIsRoleDialogOpen] = React.useState(false);
    const [isDeptDialogOpen, setIsDeptDialogOpen] = React.useState(false);
    const [editingRole, setEditingRole] = React.useState<SubRole | null>(null);
    const [roleName, setRoleName] = React.useState('');
    const [permissions, setPermissions] = React.useState<Record<string, boolean>>({});
    const [newDeptName, setNewDeptName] = React.useState('');

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings');
        const unsub = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setPrefixes(data.idPrefixes || { student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
                setInstitution(data.institution || { name: 'Edutrack360' });
                setLeavePolicy(data.leavePolicy || { maxDays: 14 });
                setPaymentMethods(data.paymentMethods || { flutterwave: { enabled: true } });
                setOverduePolicy(data.overduePolicy || 'doNothing');
                setRegistrationPolicy(data.registrationPolicy || { lateRegistrationFee: 0 });
                setIntegrations(data.integrations || { quickbooks: { enabled: false }, sage: { enabled: false } });
                setSubRoles(data.subRoles ? Object.keys(data.subRoles).map(id => ({ id, ...data.subRoles[id] })) : []);
                setDepartments(data.departments ? Object.keys(data.departments).map(id => ({ id, ...data.departments[id] })) : []);
            }
             setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const resetRoleForm = () => {
        setEditingRole(null);
        setRoleName('');
        setPermissions({});
    };

    const openRoleDialog = (role: SubRole | null) => {
        if (role) {
            setEditingRole(role);
            setRoleName(role.name);
            setPermissions(role.permissions || {});
        } else {
            resetRoleForm();
        }
        setIsRoleDialogOpen(true);
    };

    const handlePermissionChange = (permissionKey: string) => {
        setPermissions(prev => ({
            ...prev,
            [permissionKey]: !prev[permissionKey]
        }));
    };
    
    const handleSaveRole = async () => {
        if (!roleName) {
            toast({ variant: 'destructive', title: 'Role name required' });
            return;
        }
        setSaving(true);
        const roleData = { name: roleName, permissions };
        try {
            if (editingRole) {
                await update(ref(db, `settings/subRoles/${editingRole.id}`), roleData);
                toast({ title: 'Role Updated' });
            } else {
                await push(ref(db, `settings/subRoles`), roleData);
                toast({ title: 'Role Created' });
            }
            setIsRoleDialogOpen(false);
            resetRoleForm();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Failed to save role', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!window.confirm("Are you sure? This may affect users assigned to this role.")) {
            return;
        }
        await remove(ref(db, `settings/subRoles/${roleId}`));
        toast({ title: "Role deleted" });
    };

     const handleAddDepartment = async () => {
        if (!newDeptName.trim()) return;
        setSaving(true);
        try {
            await push(ref(db, 'settings/departments'), { name: newDeptName.trim() });
            toast({ title: "Department added." });
            setNewDeptName('');
            setIsDeptDialogOpen(false);
        } catch(e) {
             toast({ variant: 'destructive', title: 'Failed to add department.' });
        } finally {
            setSaving(false);
        }
    };
    const handleDeleteDepartment = async (deptId: string) => {
        if (!window.confirm("Are you sure?")) return;
        await remove(ref(db, `settings/departments/${deptId}`));
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
            await update(settingsRef, { 
                idPrefixes: prefixes,
                institution: { ...institution, logoUrl: logoUrl },
                leavePolicy: leavePolicy,
                paymentMethods: paymentMethods,
                overduePolicy: overduePolicy,
                registrationPolicy: registrationPolicy,
                integrations: integrations,
            });
            toast({ variant: 'success', title: 'Settings Saved' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Role & Permission Management</CardTitle>
                    <CardDescription>Create staff sub-roles and assign permissions to different parts of the system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button type="button" onClick={() => openRoleDialog(null)}><PlusCircle className="mr-2 h-4"/>New Sub-Role</Button>
                     <div className="mt-4 space-y-2">
                        {subRoles.map(role => (
                            <Card key={role.id}>
                                <CardHeader className="flex flex-row items-center justify-between p-4">
                                    <p className="font-semibold">{role.name}</p>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="outline" onClick={() => openRoleDialog(role)}>Edit</Button>
                                        <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteRole(role.id)}>Delete</Button>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Department Management</CardTitle>
                    <CardDescription>Manage departments for staff allocation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                        <DialogTrigger asChild><Button type="button" variant="outline"><PlusCircle className="mr-2 h-4"/>Add Department</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
                            <div className="py-4"><Input placeholder="e.g., Academics, Finance" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} /></div>
                            <DialogFooter><Button onClick={handleAddDepartment}>Add Department</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <div className="mt-4 space-y-2">
                        {departments.map(dept => (
                            <div key={dept.id} className="flex justify-between items-center p-2 border rounded-md">
                               <span>{dept.name}</span>
                               <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteDepartment(dept.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                 <CardHeader><CardTitle className="font-headline text-2xl">Institution Details</CardTitle><CardDescription>Set your institution's name and logo for branding on documents.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Label htmlFor="institution-name">Institution Name</Label><div className="sm:col-span-2"><Input id="institution-name" name="name" value={institution.name} onChange={(e) => setInstitution(p => ({...p, name: e.target.value}))} className="max-w-sm" disabled={saving} /></div></div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start"><Label htmlFor="institution-logo">Institution Logo</Label><div className="sm:col-span-2 flex items-center gap-4"><div className="w-20 h-20 rounded-md border p-1 flex items-center justify-center bg-muted">{logoPreview || institution.logoUrl ? (<Image src={logoPreview || institution.logoUrl!} alt="Logo Preview" width={80} height={80} className="object-contain" data-ai-hint="logo"/>) : (<span className="text-xs text-muted-foreground">No Logo</span>)}</div><Input id="institution-logo" type="file" onChange={(e) => { const file = e.target.files?.[0]; if(file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file));}}} accept="image/*" className="max-w-xs"/></div></div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">User ID Prefixes</CardTitle><CardDescription>Manage system-wide settings for User ID prefixes.</CardDescription></CardHeader>
                <CardContent className="space-y-6">{loading ? (Array.from({ length: 3 }).map((_, i) => (<div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Skeleton className="h-5 w-32" /><div className="sm:col-span-2"><Skeleton className="h-10 w-full max-w-sm" /></div></div>))) : 
                (<>
                    {(['student', 'staff', 'admin'] as const).map(role => (
                    <div key={role} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <Label htmlFor={`${role}-prefix`}>{role.charAt(0).toUpperCase() + role.slice(1)} ID Prefix</Label>
                        <div className="sm:col-span-2"><Input id={`${role}-prefix`} name={role} value={prefixes[role]} onChange={(e) => setPrefixes(p => ({ ...p, [role]: e.target.value.toUpperCase() }))} className="max-w-sm" disabled={saving}/></div>
                    </div>
                    ))}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center pt-4 border-t">
                        <Label>Prefix Options</Label>
                        <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center space-x-2"><Switch id="include-year" checked={prefixes.includeYear} onCheckedChange={(c) => setPrefixes(p => ({...p, includeYear: c}))} /><Label htmlFor="include-year">Include Year (YY)</Label></div>
                            <div className="flex items-center space-x-2"><Switch id="include-month" checked={prefixes.includeMonth} onCheckedChange={(c) => setPrefixes(p => ({...p, includeMonth: c}))} /><Label htmlFor="include-month">Include Month (MM)</Label></div>
                        </div>
                    </div>
                </>)}
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Financial Policy</CardTitle><CardDescription>Configure payment methods and rules for registrations.</CardDescription></CardHeader>
                <CardContent className="space-y-6">{loading ? (Array.from({ length: 2 }).map((_, i) => (<div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Skeleton className="h-5 w-32" /><div className="sm:col-span-2"> <Skeleton className="h-10 w-full max-w-sm" /> </div></div>))) : (<><div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Label htmlFor="late-fee">Late Registration Fee (ZMW)</Label><div className="sm:col-span-2"><Input id="late-fee" type="number" value={registrationPolicy.lateRegistrationFee} onChange={(e) => setRegistrationPolicy({ lateRegistrationFee: Number(e.target.value)})} className="max-w-sm" disabled={saving}/></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Label htmlFor="flutterwave-switch">Flutterwave Payments</Label><div className="sm:col-span-2"><Switch id="flutterwave-switch" checked={paymentMethods.flutterwave.enabled} onCheckedChange={(checked) => setPaymentMethods(p => ({...p, flutterwave: {enabled: checked}}))} disabled={saving} /><p className="text-xs text-muted-foreground mt-1"> {paymentMethods.flutterwave.enabled ? 'Students can pay online via Mobile Money.' : 'Online payments are currently disabled.'} </p></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start"><div className="space-y-1"><Label>Overdue Payment Rule</Label><p className="text-xs text-muted-foreground">Define what action the system should take automatically when a student misses a payment deadline.</p></div><div className="sm:col-span-2"><RadioGroup value={overduePolicy} onValueChange={(v) => setOverduePolicy(v as OverduePolicy)} className="space-y-2"><div className="border p-3 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"><div className="flex items-center space-x-2"><RadioGroupItem value="doNothing" id="doNothing" /><Label htmlFor="doNothing" className="font-semibold flex items-center gap-2"><BadgeInfo/> Do Nothing (Manual Follow-up)</Label></div><p className="text-xs text-muted-foreground ml-6">The system will take no action. Staff must manually follow up on overdue payments.</p></div><div className="border p-3 rounded-md has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"><div className="flex items-center space-x-2"><RadioGroupItem value="suspendAccess" id="suspendAccess" /><Label htmlFor="suspendAccess" className="font-semibold flex items-center gap-2"><ShieldAlert/> Suspend Student Portal Access</Label></div><p className="text-xs text-muted-foreground ml-6">The student's account will be automatically disabled, preventing login until the payment is made or their status is manually reactivated by an admin.</p></div></RadioGroup></div></div></>)}</CardContent>
            </Card>
            
            <Card id="integrations" className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Integrations</CardTitle><CardDescription>Manage third-party software integrations.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <Label>QuickBooks</Label>
                        <div className="sm:col-span-2 space-y-2">
                           <div className="flex items-center space-x-2">
                                <Switch id="quickbooks-switch" checked={integrations.quickbooks.enabled} onCheckedChange={(checked) => setIntegrations(p => ({...p, quickbooks: {...p.quickbooks, enabled: checked}}))} disabled={saving} />
                                <Label htmlFor="quickbooks-switch">{integrations.quickbooks.enabled ? "Enabled" : "Disabled"}</Label>
                           </div>
                           <Input placeholder="QuickBooks API Key" value={integrations.quickbooks.apiKey || ''} onChange={e => setIntegrations(p => ({...p, quickbooks: {...p.quickbooks, apiKey: e.target.value}}))} disabled={saving || !integrations.quickbooks.enabled}/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <Label>Sage</Label>
                        <div className="sm:col-span-2 space-y-2">
                           <div className="flex items-center space-x-2">
                                <Switch id="sage-switch" checked={integrations.sage.enabled} onCheckedChange={(checked) => setIntegrations(p => ({...p, sage: {...p.sage, enabled: checked}}))} disabled={saving} />
                                <Label htmlFor="sage-switch">{integrations.sage.enabled ? "Enabled" : "Disabled"}</Label>
                           </div>
                           <Input placeholder="Sage API Key" value={integrations.sage.apiKey || ''} onChange={e => setIntegrations(p => ({...p, sage: {...p.sage, apiKey: e.target.value}}))} disabled={saving || !integrations.sage.enabled}/>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg"><CardHeader><CardTitle className="font-headline text-2xl">Leave Policy</CardTitle><CardDescription>Configure settings for staff leave applications.</CardDescription></CardHeader><CardContent className="space-y-6">{loading ? (<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Skeleton className="h-5 w-32" /><div className="sm:col-span-2"><Skeleton className="h-10 w-full max-w-sm" /></div></div>) : (<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center"><Label htmlFor="max-leave-days">Max Leave Days per Request</Label><div className="sm:col-span-2"><Input id="max-leave-days" name="maxDays" type="number" value={leavePolicy.maxDays} onChange={(e) => setLeavePolicy({ maxDays: Number(e.target.value)})} className="max-w-sm" disabled={saving}/></div></div>)}</CardContent></Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2"/>} Save All Changes
                </Button>
            </div>
            
            <Dialog open={isRoleDialogOpen} onOpenChange={(open) => {if(!open) resetRoleForm(); setIsRoleDialogOpen(open);}}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? `Edit ${editingRole.name}` : "Create New Sub-Role"}</DialogTitle>
                        <DialogDescription>Define the name and permissions for this staff sub-role.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input placeholder="Role Name, e.g., Bursar" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
                        <Accordion type="multiple" defaultValue={allMenuItems.map(item => item.label)} className="w-full">
                            {allMenuItems.map(item => {
                                if (!item.items || item.items.length === 0) {
                                    return null;
                                }
                                return (
                                    <AccordionItem value={item.label} key={item.label}>
                                        <AccordionTrigger>{item.label}</AccordionTrigger>
                                        <AccordionContent className="space-y-2 max-h-60 overflow-y-auto pr-4">
                                            {item.items.map(subItem => (
                                                <div key={subItem.href} className="flex items-center gap-2">
                                                    <Checkbox id={subItem.href} checked={!!permissions[subItem.href]} onCheckedChange={() => handlePermissionChange(subItem.href)}/>
                                                    <Label htmlFor={subItem.href} className="font-normal">{subItem.label}</Label>
                                                </div>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSaveRole} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Role"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </form>
    );
}
