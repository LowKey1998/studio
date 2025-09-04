
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Upload, ShieldAlert, BadgeInfo, HandCoins, PlusCircle, Trash2, Users, Save, Pencil, Link as LinkIcon, KeyRound, Mail, Percent, Banknote } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

type IDPrefixes = { 
    student: string; 
    staff: string; 
    admin: string; 
    includeYear: boolean;
    includeMonth: boolean;
};

type LeavePolicy = { maxDays: number; };
type OverduePolicy = 'doNothing' | 'suspendAccess';
type PaymentMethods = { flutterwave: { enabled: boolean }; }
type Integrations = { 
    quickbooks: { enabled: boolean; clientId?: string; clientSecret?: string; }; 
    sage: { enabled: boolean; apiKey?: string; }; 
    facebook?: { pageAccessToken?: string; formId?: string; }; 
    twilio?: { accountSid?: string; authToken?: string; fromNumber?: string; };
    smtp?: { service?: string; host?: string; port?: number; secure?: boolean; user?: string; pass?: string; fromName?: string; fromEmail?: string; };
};
type SubRole = { id: string; name: string; permissions: Record<string, boolean>; };
type RegistrationPolicy = { lateRegistrationFee: number; };
type Department = { id: string; name: string; };

export default function SettingsPage() {
    const [prefixes, setPrefixes] = React.useState<IDPrefixes>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
    const [leavePolicy, setLeavePolicy] = React.useState<LeavePolicy>({ maxDays: 14 });
    const [overduePolicy, setOverduePolicy] = React.useState<OverduePolicy>('doNothing');
    const [registrationPolicy, setRegistrationPolicy] = React.useState<RegistrationPolicy>({ lateRegistrationFee: 0 });
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethods>({ flutterwave: { enabled: true } });
    const [integrations, setIntegrations] = React.useState<Integrations>({ quickbooks: { enabled: false }, sage: { enabled: false }, facebook: { pageAccessToken: '', formId: '' }, twilio: {}, smtp: {} });
    const [subRoles, setSubRoles] = React.useState<SubRole[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    
    const [isDeptDialogOpen, setIsDeptDialogOpen] = React.useState(false);
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
                setLeavePolicy(data.leavePolicy || { maxDays: 14 });
                setPaymentMethods(data.paymentMethods || { flutterwave: { enabled: true } });
                setOverduePolicy(data.overduePolicy || 'doNothing');
                setRegistrationPolicy(data.registrationPolicy || { lateRegistrationFee: 0 });
                setIntegrations(data.integrations || { quickbooks: { enabled: false }, sage: { enabled: false }, facebook: {}, twilio: {}, smtp: {} });
                setDepartments(data.departments ? Object.keys(data.departments).map(id => ({ id, ...data.departments[id] })) : []);
            }
             setLoading(false);
        });
        return () => unsub();
    }, []);
    

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
            
            await update(settingsRef, { 
                idPrefixes: prefixes,
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

            <Card id="integrations" className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">API Integrations</CardTitle><CardDescription>Manage third-party software integrations.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2">QuickBooks</Label>
                        <div className="sm:col-span-2 space-y-2">
                           <div className="flex items-center space-x-2">
                                <Switch id="quickbooks-switch" checked={integrations.quickbooks?.enabled || false} onCheckedChange={(checked) => setIntegrations(p => ({...p, quickbooks: {...p.quickbooks, enabled: checked}}))} disabled={saving} />
                                <Label htmlFor="quickbooks-switch">{integrations.quickbooks?.enabled ? "Enabled" : "Disabled"}</Label>
                           </div>
                           <Input type="password" placeholder="QuickBooks Client ID" value={integrations.quickbooks?.clientId || ''} onChange={e => setIntegrations(p => ({...p, quickbooks: {...p.quickbooks, clientId: e.target.value}}))} disabled={saving || !integrations.quickbooks?.enabled}/>
                           <Input type="password" placeholder="QuickBooks Client Secret" value={integrations.quickbooks?.clientSecret || ''} onChange={e => setIntegrations(p => ({...p, quickbooks: {...p.quickbooks, clientSecret: e.target.value}}))} disabled={saving || !integrations.quickbooks?.enabled}/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2">Sage</Label>
                        <div className="sm:col-span-2 space-y-2">
                           <div className="flex items-center space-x-2">
                                <Switch id="sage-switch" checked={integrations.sage?.enabled || false} onCheckedChange={(checked) => setIntegrations(p => ({...p, sage: {...p.sage, enabled: checked}}))} disabled={saving} />
                                <Label htmlFor="sage-switch">{integrations.sage?.enabled ? "Enabled" : "Disabled"}</Label>
                           </div>
                           <Input placeholder="Sage API Key" value={integrations.sage?.apiKey || ''} onChange={e => setIntegrations(p => ({...p, sage: {...p.sage, apiKey: e.target.value}}))} disabled={saving || !integrations.sage?.enabled}/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2">Facebook (for Leads)</Label>
                        <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="fb-token" className="text-xs">Page Access Token</Label>
                           <Textarea id="fb-token" placeholder="Paste your Page Access Token" value={integrations.facebook?.pageAccessToken || ''} onChange={e => setIntegrations(p => ({...p, facebook: {...p.facebook, pageAccessToken: e.target.value}}))} disabled={saving}/>
                            <Label htmlFor="fb-form" className="text-xs">Lead Form ID</Label>
                           <Input id="fb-form" placeholder="Enter your Lead Form ID" value={integrations.facebook?.formId || ''} onChange={e => setIntegrations(p => ({...p, facebook: {...p.facebook, formId: e.target.value}}))} disabled={saving}/>
                        </div>
                    </div>
                    <Separator/>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2">Twilio (for SMS)</Label>
                        <div className="sm:col-span-2 space-y-2">
                            <Input placeholder="Account SID" value={integrations.twilio?.accountSid || ''} onChange={e => setIntegrations(p => ({...p, twilio: {...p.twilio, accountSid: e.target.value}}))} disabled={saving}/>
                            <Input placeholder="Auth Token" type="password" value={integrations.twilio?.authToken || ''} onChange={e => setIntegrations(p => ({...p, twilio: {...p.twilio, authToken: e.target.value}}))} disabled={saving}/>
                            <Input placeholder="Twilio 'From' Number (e.g., +15017122661)" value={integrations.twilio?.fromNumber || ''} onChange={e => setIntegrations(p => ({...p, twilio: {...p.twilio, fromNumber: e.target.value}}))} disabled={saving}/>
                        </div>
                    </div>
                     <Separator/>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
                        <Label className="pt-2">SMTP (for Email)</Label>
                        <div className="sm:col-span-2 space-y-2">
                            <Input placeholder="From Name (e.g., Edutrack360)" value={integrations.smtp?.fromName || ''} onChange={e => setIntegrations(p => ({...p, smtp: {...p.smtp, fromName: e.target.value}}))} disabled={saving}/>
                            <Input placeholder="From Email (e.g., no-reply@yourdomain.com)" value={integrations.smtp?.fromEmail || ''} onChange={e => setIntegrations(p => ({...p, smtp: {...p.smtp, fromEmail: e.target.value}}))} disabled={saving}/>
                            <Input placeholder="SMTP User (e.g., your-email@gmail.com)" value={integrations.smtp?.user || ''} onChange={e => setIntegrations(p => ({...p, smtp: {...p.smtp, user: e.target.value}}))} disabled={saving}/>
                            <Input type="password" placeholder="SMTP Password or App Key" value={integrations.smtp?.pass || ''} onChange={e => setIntegrations(p => ({...p, smtp: {...p.smtp, pass: e.target.value}}))} disabled={saving}/>
                             <p className="text-xs text-muted-foreground">For Gmail, use an <a href="https://support.google.com/accounts/answer/185833?hl=en" target="_blank" rel="noopener noreferrer" className="underline">App Password</a>. The system will automatically use the correct Gmail settings if your SMTP User is a gmail.com address.</p>
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
            
        </form>
    );
}
