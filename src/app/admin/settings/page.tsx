'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Wand2, PlusCircle, Trash2, KeyRound, Mail, Percent, Banknote, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { ref, update, onValue, push, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
    quickbooks?: { enabled?: boolean; clientId?: string; clientSecret?: string; syncInvoices?: boolean; syncExpenses?: boolean; syncPayroll?: boolean; }; 
    sage?: { enabled?: boolean; apiKey?: string; }; 
    facebook?: { pageAccessToken?: string; formId?: string; }; 
    twilio?: { accountSid?: string; authToken?: string; fromNumber?: string; };
    smtp?: { service?: string; host?: string; port?: number; secure?: boolean; user?: string; pass?: string; fromName?: string; fromEmail?: string; };
};
type SubRole = { id: string; name: string; permissions: Record<string, boolean>; };
type RegistrationPolicy = { lateRegistrationFee: number; };
type Department = { id: string; name: string; };

type EmailTemplate = {
    subject: string;
    body: string;
    enabled: boolean;
};

type EmailTemplates = {
    passwordUpdate: EmailTemplate;
    idChange: EmailTemplate;
    emailChange: EmailTemplate;
};

export default function SettingsPage() {
    const [prefixes, setPrefixes] = React.useState<IDPrefixes>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
    const [leavePolicy, setLeavePolicy] = React.useState<LeavePolicy>({ maxDays: 14 });
    const [overduePolicy, setOverduePolicy] = React.useState<OverduePolicy>('doNothing');
    const [registrationPolicy, setRegistrationPolicy] = React.useState<RegistrationPolicy>({ lateRegistrationFee: 0 });
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethods>({ flutterwave: { enabled: true } });
    const [integrations, setIntegrations] = React.useState<Integrations>({ quickbooks: { enabled: false }, sage: { enabled: false }, facebook: { pageAccessToken: '', formId: '' }, twilio: {}, smtp: {} });
    const [departments, setDepartments] = React.useState<Department[]>([]);
    
    const [emailTemplates, setEmailTemplates] = React.useState<EmailTemplates>({
        passwordUpdate: { subject: 'Your New Portal Credentials', body: '<p>Hello [Name],</p><p>Your password has been updated.</p><p>UserID: [UserID]</p><p>Password: [Password]</p>', enabled: true },
        idChange: { subject: 'System ID Change Notification', body: '<p>Hello [Name],</p><p>Your User ID has been changed from [OldID] to [UserID].</p>', enabled: true },
        emailChange: { subject: 'Account Email Change', body: '<p>Hello [Name],</p><p>Your portal login email has been updated to [NewEmail].</p>', enabled: true },
    });

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
                if (data.idPrefixes) setPrefixes(data.idPrefixes);
                if (data.leavePolicy) setLeavePolicy(data.leavePolicy);
                if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
                if (data.overduePolicy) setOverduePolicy(data.overduePolicy);
                if (data.registrationPolicy) setRegistrationPolicy(data.registrationPolicy);
                if (data.integrations) setIntegrations(data.integrations);
                if (data.departments) setDepartments(Object.keys(data.departments).map(id => ({ id, ...data.departments[id] })));
                if (data.emailTemplates) setEmailTemplates(data.emailTemplates);
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
                emailTemplates: emailTemplates,
            });
            toast({ variant: 'success', title: 'Settings Saved' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleTemplateChange = (key: keyof EmailTemplates, field: keyof EmailTemplate, value: any) => {
        setEmailTemplates(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
    };

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6 pb-12">
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

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Email Templates & Notifications</CardTitle>
                    <CardDescription>Configure the automated emails sent by the system when sensitive user data is updated.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['password-tpl']} className="w-full">
                        <AccordionItem value="password-tpl">
                            <AccordionTrigger className="font-bold">Password Reset Template</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5">
                                        <Label>Enable Automated Password Email</Label>
                                        <p className="text-xs text-muted-foreground">Send an email when an administrator sets or resets a user's password.</p>
                                    </div>
                                    <Switch checked={emailTemplates.passwordUpdate.enabled} onCheckedChange={(val) => handleTemplateChange('passwordUpdate', 'enabled', val)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Subject</Label>
                                    <Input value={emailTemplates.passwordUpdate.subject} onChange={e => handleTemplateChange('passwordUpdate', 'subject', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Body (HTML)</Label>
                                    <Textarea value={emailTemplates.passwordUpdate.body} onChange={e => handleTemplateChange('passwordUpdate', 'body', e.target.value)} rows={8} className="font-mono text-xs" />
                                    <p className="text-[10px] text-muted-foreground">Use placeholders: <code className="bg-muted px-1">[Name]</code>, <code className="bg-muted px-1">[UserID]</code>, <code className="bg-muted px-1">[Password]</code></p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="id-tpl">
                            <AccordionTrigger className="font-bold">User ID Change Template</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5">
                                        <Label>Enable ID Change Notification</Label>
                                        <p className="text-xs text-muted-foreground">Send an email when a user's System ID is updated.</p>
                                    </div>
                                    <Switch checked={emailTemplates.idChange.enabled} onCheckedChange={(val) => handleTemplateChange('idChange', 'enabled', val)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Subject</Label>
                                    <Input value={emailTemplates.idChange.subject} onChange={e => handleTemplateChange('idChange', 'subject', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Body (HTML)</Label>
                                    <Textarea value={emailTemplates.idChange.body} onChange={e => handleTemplateChange('idChange', 'body', e.target.value)} rows={8} className="font-mono text-xs" />
                                    <p className="text-[10px] text-muted-foreground">Use placeholders: <code className="bg-muted px-1">[Name]</code>, <code className="bg-muted px-1">[OldID]</code>, <code className="bg-muted px-1">[UserID]</code></p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="email-tpl">
                            <AccordionTrigger className="font-bold">Email Address Change Template</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5">
                                        <Label>Enable Email Update Notification</Label>
                                        <p className="text-xs text-muted-foreground">Send a notification when a user's portal email address is changed.</p>
                                    </div>
                                    <Switch checked={emailTemplates.emailChange.enabled} onCheckedChange={(val) => handleTemplateChange('emailChange', 'enabled', val)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Subject</Label>
                                    <Input value={emailTemplates.emailChange.subject} onChange={e => handleTemplateChange('emailChange', 'subject', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Body (HTML)</Label>
                                    <Textarea value={emailTemplates.emailChange.body} onChange={e => handleTemplateChange('emailChange', 'body', e.target.value)} rows={8} className="font-mono text-xs" />
                                    <p className="text-[10px] text-muted-foreground">Use placeholders: <code className="bg-muted px-1">[Name]</code>, <code className="bg-muted px-1">[NewEmail]</code></p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2"/>} Save All Changes
                </Button>
            </div>
            
        </form>
    );
}
