'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Wand2, PlusCircle, Trash2, KeyRound, Mail, Percent, Banknote, AlertCircle, Info, Link as LinkIcon, MessageSquare, Facebook, Settings2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, update, onValue, push, remove } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

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
    const [integrations, setIntegrations] = React.useState<Integrations>({ 
        quickbooks: { enabled: false }, 
        sage: { enabled: false }, 
        facebook: { pageAccessToken: '', formId: '' }, 
        twilio: { accountSid: '', authToken: '', fromNumber: '' }, 
        smtp: { host: '', port: 587, user: '', pass: '', fromName: '', fromEmail: '' } 
    });
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
                if (data.integrations) setIntegrations(prev => ({ ...prev, ...data.integrations }));
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

    const handleIntegrationChange = (integration: keyof Integrations, field: string, value: any) => {
        setIntegrations(prev => ({
            ...prev,
            [integration]: {
                ...(prev[integration] || {}),
                [field]: value
            }
        }));
    };

    const handleTemplateChange = (key: keyof EmailTemplates, field: keyof EmailTemplate, value: any) => {
        setEmailTemplates(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
        }));
    };

    if (loading) return <Skeleton className="h-screen w-full" />;

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6 pb-12">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Institutional Infrastructure</CardTitle>
                    <CardDescription>Manage core departmental structures and account settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label className="text-base font-bold">Departments</Label>
                            <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                                <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><PlusCircle className="mr-2 h-4"/>Add Department</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
                                    <div className="py-4"><Input placeholder="e.g., Academics, Finance" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} /></div>
                                    <DialogFooter><Button onClick={handleAddDepartment}>Add Department</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {departments.map(dept => (
                                <div key={dept.id} className="flex justify-between items-center p-2 border rounded-md bg-muted/20">
                                <span className="text-sm font-medium">{dept.name}</span>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteDepartment(dept.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Integrations & External APIs</CardTitle><CardDescription>Configure connections to third-party services.</CardDescription></CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['smtp', 'quickbooks']} className="w-full">
                        <AccordionItem value="smtp">
                            <AccordionTrigger className="font-bold flex gap-2"><Mail className="h-4 w-4"/>SMTP Email Settings</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <Alert className="bg-blue-50 border-blue-200">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-700">These settings are used for all system-generated emails including credentials and enrollment alerts.</AlertDescription>
                                </Alert>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>SMTP Host</Label><Input placeholder="smtp.gmail.com" value={integrations.smtp?.host} onChange={e => handleIntegrationChange('smtp', 'host', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>SMTP Port</Label><Input type="number" placeholder="587" value={integrations.smtp?.port} onChange={e => handleIntegrationChange('smtp', 'port', Number(e.target.value))}/></div>
                                    <div className="space-y-1"><Label>Username / Email</Label><Input placeholder="portal@institution.com" value={integrations.smtp?.user} onChange={e => handleIntegrationChange('smtp', 'user', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Password / App Key</Label><Input type="password" placeholder="••••••••" value={integrations.smtp?.pass} onChange={e => handleIntegrationChange('smtp', 'pass', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>From Name</Label><Input placeholder="Edutrack360 Admin" value={integrations.smtp?.fromName} onChange={e => handleIntegrationChange('smtp', 'fromName', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>From Email</Label><Input placeholder="noreply@institution.com" value={integrations.smtp?.fromEmail} onChange={e => handleIntegrationChange('smtp', 'fromEmail', e.target.value)}/></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="quickbooks">
                            <AccordionTrigger className="font-bold flex gap-2"><LinkIcon className="h-4 w-4"/>QuickBooks Online</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/20">
                                    <Switch checked={integrations.quickbooks?.enabled} onCheckedChange={val => handleIntegrationChange('quickbooks', 'enabled', val)} />
                                    <Label>Enable QuickBooks Sync</Label>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Client ID</Label><Input value={integrations.quickbooks?.clientId} onChange={e => handleIntegrationChange('quickbooks', 'clientId', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Client Secret</Label><Input type="password" value={integrations.quickbooks?.clientSecret} onChange={e => handleIntegrationChange('quickbooks', 'clientSecret', e.target.value)}/></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="flex items-center gap-2"><Checkbox checked={integrations.quickbooks?.syncInvoices} onCheckedChange={v => handleIntegrationChange('quickbooks', 'syncInvoices', !!v)}/><Label className="text-xs">Sync Invoices</Label></div>
                                    <div className="flex items-center gap-2"><Checkbox checked={integrations.quickbooks?.syncExpenses} onCheckedChange={v => handleIntegrationChange('quickbooks', 'syncExpenses', !!v)}/><Label className="text-xs">Sync Expenses</Label></div>
                                    <div className="flex items-center gap-2"><Checkbox checked={integrations.quickbooks?.syncPayroll} onCheckedChange={v => handleIntegrationChange('quickbooks', 'syncPayroll', !!v)}/><Label className="text-xs">Sync Payroll</Label></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="twilio">
                            <AccordionTrigger className="font-bold flex gap-2"><MessageSquare className="h-4 w-4"/>Twilio SMS Gateway</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Account SID</Label><Input value={integrations.twilio?.accountSid} onChange={e => handleIntegrationChange('twilio', 'accountSid', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Auth Token</Label><Input type="password" value={integrations.twilio?.authToken} onChange={e => handleIntegrationChange('twilio', 'authToken', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>From Number (E.164)</Label><Input placeholder="+1234567890" value={integrations.twilio?.fromNumber} onChange={e => handleIntegrationChange('twilio', 'fromNumber', e.target.value)}/></div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="facebook">
                            <AccordionTrigger className="font-bold flex gap-2"><Facebook className="h-4 w-4"/>Facebook Leads API</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="space-y-1"><Label>Page Access Token</Label><Input type="password" value={integrations.facebook?.pageAccessToken} onChange={e => handleIntegrationChange('facebook', 'pageAccessToken', e.target.value)}/></div>
                                <div className="space-y-1"><Label>Lead Form ID</Label><Input value={integrations.facebook?.formId} onChange={e => handleIntegrationChange('facebook', 'formId', e.target.value)}/></div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Policies & Logic</CardTitle><CardDescription>Set the rules for system automation.</CardDescription></CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['reg-policy']} className="w-full">
                        <AccordionItem value="reg-policy">
                            <AccordionTrigger className="font-bold flex gap-2"><Settings2 className="h-4 w-4"/>Registration & Fees</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Late Registration Fee (ZMW)</Label>
                                        <Input type="number" value={registrationPolicy.lateRegistrationFee} onChange={e => setRegistrationPolicy({ lateRegistrationFee: Number(e.target.value) })}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Overdue Balance Action</Label>
                                        <Select value={overduePolicy} onValueChange={val => setOverduePolicy(val as any)}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="doNothing">Do Nothing (Display Only)</SelectItem>
                                                <SelectItem value="suspendAccess">Suspend Portal Access</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="hr-policy">
                            <AccordionTrigger className="font-bold flex gap-2"><Clock className="h-4 w-4"/>HR & Leave</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="space-y-1 max-w-xs">
                                    <Label>Max Leave Days (Annual)</Label>
                                    <Input type="number" value={leavePolicy.maxDays} onChange={e => setLeavePolicy({ maxDays: Number(e.target.value) })}/>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Email Templates & Notifications</CardTitle><CardDescription>Branding for system-automated emails.</CardDescription></CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['password-tpl']} className="w-full">
                        <AccordionItem value="password-tpl">
                            <AccordionTrigger className="font-bold">Password Reset Template</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5"><Label>Enable Automated Email</Label><p className="text-xs text-muted-foreground">Send when an admin sets a password.</p></div>
                                    <Switch checked={emailTemplates.passwordUpdate.enabled} onCheckedChange={val => handleTemplateChange('passwordUpdate', 'enabled', val)} />
                                </div>
                                <div className="space-y-2"><Label>Email Subject</Label><Input value={emailTemplates.passwordUpdate.subject} onChange={e => handleTemplateChange('passwordUpdate', 'subject', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Email Body (HTML)</Label><Textarea value={emailTemplates.passwordUpdate.body} onChange={e => handleTemplateChange('passwordUpdate', 'body', e.target.value)} rows={8} className="font-mono text-xs" /></div>
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
