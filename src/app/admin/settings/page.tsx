"use client";
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, PlusCircle, Trash2, KeyRound, Mail, Percent, AlertCircle, Info, Link as LinkIcon, MessageSquare, Facebook, Settings2, Clock, LayoutGrid, ShieldAlert, Lock, Stethoscope, Settings } from 'lucide-react';
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
import NextLink from 'next/link';

type IDPrefixes = { 
    student: string; 
    staff: string; 
    admin: string; 
    includeYear: boolean;
    includeMonth: boolean;
};

type LeavePolicy = { maxDays: number; };
type OverduePolicy = 'doNothing' | 'restrict';

type FinancialSettings = {
    paymentThreshold: number;
    defaulterRestrictions: {
        registration: boolean;
        results: boolean;
        library: boolean;
        exams: boolean;
        sidebar: Record<string, boolean>;
    }
};

type NotificationRules = {
    registration: boolean;
    grading: boolean;
    attendance: boolean;
    leave: boolean;
    library: boolean;
    financial: boolean;
};

type ClinicalSettings = {
    studentVisible: boolean;
};

type Integrations = { 
    quickbooks?: { enabled?: boolean; clientId?: string; clientSecret?: string; syncInvoices?: boolean; syncExpenses?: boolean; syncPayroll?: boolean; }; 
    sage?: { enabled?: boolean; apiKey?: string; }; 
    facebook?: { pageAccessToken?: string; formId?: string; }; 
    twilio?: { accountSid?: string; authToken?: string; fromNumber?: string; };
    smtp?: { service?: string; host?: string; port?: number; secure?: boolean; user?: string; pass?: string; fromName?: string; fromEmail?: string; };
};
type RegistrationPolicy = { lateRegistrationFee: number; gracePeriodDays: number; };
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
    credentials: EmailTemplate;
    attendanceMarker?: EmailTemplate;
};

const studentSidebarCategories = [
    "Academics",
    "eLearning",
    "Campus Life",
    "Innovation",
    "Spiritual Life"
];

export default function SettingsPage() {
    const [prefixes, setPrefixes] = React.useState<IDPrefixes>({ student: 'STU', staff: 'STF', admin: 'ADM', includeYear: false, includeMonth: false });
    const [leavePolicy, setLeavePolicy] = React.useState<LeavePolicy>({ maxDays: 14 });
    const [overduePolicy, setOverduePolicy] = React.useState<OverduePolicy>('doNothing');
    const [financialSettings, setFinancialSettings] = React.useState<FinancialSettings>({
        paymentThreshold: 75,
        defaulterRestrictions: {
            registration: true,
            results: true,
            library: false,
            exams: false,
            sidebar: {}
        }
    });
    const [registrationPolicy, setRegistrationPolicy] = React.useState<RegistrationPolicy>({ lateRegistrationFee: 0, gracePeriodDays: 7 });
    const [notificationRules, setNotificationRules] = React.useState<NotificationRules>({
        registration: true,
        grading: true,
        attendance: true,
        leave: true,
        library: true,
        financial: true
    });
    const [clinicalSettings, setClinicalSettings] = React.useState<ClinicalSettings>({ studentVisible: true });
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
        credentials: { subject: 'Your Portal Login Details', body: '<p>Hello [Name],</p><p>Access your portal using the credentials below:</p><p>URL: [Link]</p><p>UserID: [UserID]</p>', enabled: true },
        attendanceMarker: { subject: 'Attendance Marker Assignment: [CourseName]', body: `<h2>Attendance Marker Privilege Assigned</h2>\n<p>Hello <strong>[Name]</strong>,</p>\n<p>You have been assigned as the attendance marker for the class <strong>[CourseName] ([CourseCode])</strong>.</p>\n<p><strong>Privilege Details:</strong></p>\n<ul>\n  <li><strong>Mark on exact class day only:</strong> [ExactDayOnlyText]</li>\n</ul>\n<p>Please log in to your student portal and navigate to <strong>Academics -> Mark Attendance</strong> to view your roster and record attendance for this class.</p>\n<p>Best regards,<br/>The Academics Department</p>`, enabled: true },
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
                if (data.overduePolicy) setOverduePolicy(data.overduePolicy);
                if (data.financialSettings) {
                    setFinancialSettings({
                        ...data.financialSettings,
                        defaulterRestrictions: {
                            ...data.financialSettings.defaulterRestrictions,
                            sidebar: data.financialSettings.defaulterRestrictions?.sidebar || {}
                        }
                    });
                }
                if (data.registrationPolicy) setRegistrationPolicy(prev => ({ ...prev, ...data.registrationPolicy }));
                if (data.notificationRules) setNotificationRules(prev => ({ ...prev, ...data.notificationRules }));
                if (data.clinicalSettings) setClinicalSettings(prev => ({ ...prev, ...data.clinicalSettings }));
                if (data.integrations) setIntegrations(prev => ({ ...prev, ...data.integrations }));
                if (data.departments) setDepartments(Object.keys(data.departments).map(id => ({ id, ...data.departments[id] })));
                if (data.emailTemplates) setEmailTemplates(prev => ({ ...prev, ...data.emailTemplates }));
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
                overduePolicy: overduePolicy,
                financialSettings: financialSettings,
                registrationPolicy: registrationPolicy,
                integrations: integrations,
                emailTemplates: emailTemplates,
                notificationRules: notificationRules,
                clinicalSettings: clinicalSettings,
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

    const toggleNotificationRule = (key: keyof NotificationRules) => {
        setNotificationRules(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleRestrictionChange = (key: keyof Omit<FinancialSettings['defaulterRestrictions'], 'sidebar'>) => {
        setFinancialSettings(prev => ({
            ...prev,
            defaulterRestrictions: {
                ...prev.defaulterRestrictions,
                [key]: !prev.defaulterRestrictions[key]
            }
        }));
    };

    const handleSidebarRestrictionToggle = (category: string) => {
        setFinancialSettings(prev => ({
            ...prev,
            defaulterRestrictions: {
                ...prev.defaulterRestrictions,
                sidebar: {
                    ...prev.defaulterRestrictions.sidebar,
                    [category]: !prev.defaulterRestrictions.sidebar[category]
                }
            }
        }));
    };

    if (loading) return <Skeleton className="h-screen w-full" />;

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6 pb-12">
            <Card className="shadow-lg border-l-4 border-l-primary">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><Settings className="h-6 w-6 text-primary"/>Administrative Operations</CardTitle>
                    <CardDescription>Execute bulk operations and track institutional automation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-muted/10 gap-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold">Student Auto-Registration</h4>
                            <p className="text-xs text-muted-foreground">Automatically check and register unregistered students to their current standing's semester if fees are configured.</p>
                        </div>
                        <Button type="button" variant="outline" asChild>
                            <NextLink href="/admin/settings/auto-registrations">Manage Auto-Registrations</NextLink>
                        </Button>
                    </div>
                </CardContent>
            </Card>

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
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Push Notification Rules</CardTitle>
                    <CardDescription>Configure which automated system events trigger a push notification to users.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Registration Alerts</Label>
                                <p className="text-xs text-muted-foreground">Approval and decline notifications.</p>
                            </div>
                            <Switch checked={notificationRules.registration} onCheckedChange={() => toggleNotificationRule('registration')} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Grading Alerts</Label>
                                <p className="text-xs text-muted-foreground">When new results are published.</p>
                            </div>
                            <Switch checked={notificationRules.grading} onCheckedChange={() => toggleNotificationRule('grading')} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Attendance Alerts</Label>
                                <p className="text-xs text-muted-foreground">Absence and late arrival warnings.</p>
                            </div>
                            <Switch checked={notificationRules.attendance} onCheckedChange={() => toggleNotificationRule('attendance')} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Leave & HR Alerts</Label>
                                <p className="text-xs text-muted-foreground">Staff and student leave approvals.</p>
                            </div>
                            <Switch checked={notificationRules.leave} onCheckedChange={() => toggleNotificationRule('leave')} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Library Alerts</Label>
                                <p className="text-xs text-muted-foreground">Book loan and return updates.</p>
                            </div>
                            <Switch checked={notificationRules.library} onCheckedChange={() => toggleNotificationRule('library')} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/10">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Financial Alerts</Label>
                                <p className="text-xs text-muted-foreground">Payment confirmations and scholarship news.</p>
                            </div>
                            <Switch checked={notificationRules.financial} onCheckedChange={() => toggleNotificationRule('financial')} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Clinicals & Nursing Portal</CardTitle>
                    <CardDescription>Control visibility of professional clinical modules for students.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-blue-50/20 border-blue-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <Stethoscope className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold">Enable Clinicals for Students</Label>
                                <p className="text-xs text-muted-foreground">Hides the "Clinicals" sidebar section from the student portal when disabled.</p>
                            </div>
                        </div>
                        <Switch checked={clinicalSettings.studentVisible} onCheckedChange={(val) => setClinicalSettings({ studentVisible: val })} />
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
                                <div className="space-y-1"><Label>Lead Form ID</Label><Input type="password" value={integrations.facebook?.formId} onChange={e => handleIntegrationChange('facebook', 'formId', e.target.value)}/></div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader><CardTitle className="font-headline text-2xl">Policies & Logic</CardTitle><CardDescription>Set the global rules for system automation.</CardDescription></CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['reg-policy']} className="w-full">
                        <AccordionItem value="reg-policy">
                            <AccordionTrigger className="font-bold flex gap-2"><Settings2 className="h-4 w-4"/>Registration & Finance Compliance</AccordionTrigger>
                            <AccordionContent className="space-y-6 pt-4">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <Label>Late Registration Fee (ZMW)</Label>
                                        <Input type="number" value={registrationPolicy.lateRegistrationFee} onChange={e => setRegistrationPolicy(p => ({ ...p, lateRegistrationFee: Number(e.target.value) }))}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Global Grace Period (Days)</Label>
                                        <div className="relative">
                                            <Input type="number" min="0" value={registrationPolicy.gracePeriodDays} onChange={e => setRegistrationPolicy(p => ({ ...p, gracePeriodDays: Number(e.target.value) }))} className="pr-10"/>
                                            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <Label className="text-base font-bold flex items-center gap-2 text-destructive"><ShieldAlert className="h-4 w-4"/> Overdue Balance Action</Label>
                                    <div className="grid md:grid-cols-3 gap-6 items-start">
                                        <div className="space-y-1">
                                            <Label>Global Strategy</Label>
                                            <Select value={overduePolicy} onValueChange={val => setOverduePolicy(val as any)}>
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="doNothing">Do Nothing (Display Only)</SelectItem>
                                                    <SelectItem value="restrict">Enforce Functional Restrictions</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {overduePolicy === 'restrict' && (
                                            <div className="md:col-span-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-black uppercase text-muted-foreground">Functional Restrictions</Label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {[
                                                            { key: 'registration', label: 'Block Registration', desc: 'Prevent future enrollment.' },
                                                            { key: 'results', label: 'Hide Exam Results', desc: 'Restrict grade visibility.' },
                                                            { key: 'library', label: 'Suspend Library', desc: 'Block book borrowing.' },
                                                            { key: 'exams', label: 'Restrict Exams', desc: 'Ineligible for seat numbers.' }
                                                        ].map((item) => (
                                                            <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                                                <div className="space-y-0.5">
                                                                    <p className="text-xs font-bold">{item.label}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                                                                </div>
                                                                <Switch 
                                                                    checked={financialSettings.defaulterRestrictions[item.key as keyof typeof financialSettings.defaulterRestrictions] as boolean} 
                                                                    onCheckedChange={() => handleRestrictionChange(item.key as any)} 
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-xs font-black uppercase text-muted-foreground">Sidebar Page Restrictions (Hide Categories)</Label>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-md bg-muted/20">
                                                        {studentSidebarCategories.map(category => (
                                                            <div key={category} className="flex items-center space-x-2">
                                                                <Checkbox 
                                                                    id={`restrict-${category}`} 
                                                                    checked={!!financialSettings.defaulterRestrictions.sidebar[category]} 
                                                                    onCheckedChange={() => handleSidebarRestrictionToggle(category)} 
                                                                />
                                                                <Label htmlFor={`restrict-${category}`} className="text-xs font-medium cursor-pointer">{category} Section</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Alert className="bg-primary/5 border-primary/20">
                                    <Info className="h-4 w-4 text-primary" />
                                    <AlertTitle className="font-bold">Understanding Compliance Enforcement</AlertTitle>
                                    <AlertDescription className="text-xs leading-relaxed italic space-y-2">
                                        <p>Restrictions are triggered automatically when a student's <strong>Total Paid %</strong> falls below the <strong>Threshold</strong> set for their active semester, and the <strong>Grace Period</strong> has elapsed.</p>
                                        <p>Navigation locks will hide entire sidebar modules to prevent unauthorized access while the account is in arrears.</p>
                                    </AlertDescription>
                                </Alert>
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
                <CardHeader><CardTitle className="font-headline text-2xl">Email Templates & Notifications</CardTitle><CardDescription>Manage and brand system-automated emails. Use [Name], [UserID], [Password], [OldID], [NewEmail], [Link] as placeholders.</CardDescription></CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        <AccordionItem value="credentials-tpl">
                            <AccordionTrigger className="font-bold">Portal Credentials (Manual Send)</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5"><Label>Enable Option</Label><p className="text-xs text-muted-foreground">Allow sending login details from User Management.</p></div>
                                    <Switch checked={emailTemplates.credentials.enabled} onCheckedChange={val => handleTemplateChange('credentials', 'enabled', val)} />
                                </div>
                                <div className="space-y-2"><Label>Email Subject</Label><Input value={emailTemplates.credentials.subject} onChange={e => handleTemplateChange('credentials', 'subject', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Email Body (HTML)</Label><Textarea value={emailTemplates.credentials.body} onChange={e => handleTemplateChange('credentials', 'body', e.target.value)} rows={10} className="font-mono text-xs" /></div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="password-tpl">
                            <AccordionTrigger className="font-bold">Password Update / Reset</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5"><Label>Enable Notification</Label><p className="text-xs text-muted-foreground">Send automatically when an admin changes a user's password.</p></div>
                                    <Switch checked={emailTemplates.passwordUpdate.enabled} onCheckedChange={val => handleTemplateChange('passwordUpdate', 'enabled', val)} />
                                </div>
                                <div className="space-y-2"><Label>Email Subject</Label><Input value={emailTemplates.passwordUpdate.subject} onChange={e => handleTemplateChange('passwordUpdate', 'subject', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Email Body (HTML)</Label><Textarea value={emailTemplates.passwordUpdate.body} onChange={e => handleTemplateChange('passwordUpdate', 'body', e.target.value)} rows={10} className="font-mono text-xs" /></div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="id-tpl">
                            <AccordionTrigger className="font-bold">System ID Change</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5"><Label>Enable Notification</Label><p className="text-xs text-muted-foreground">Send when an admin updates a user's unique System ID.</p></div>
                                    <Switch checked={emailTemplates.idChange.enabled} onCheckedChange={val => handleTemplateChange('idChange', 'enabled', val)} />
                                </div>
                                <div className="space-y-2"><Label>Email Subject</Label><Input value={emailTemplates.idChange.subject} onChange={e => handleTemplateChange('idChange', 'subject', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Email Body (HTML)</Label><Textarea value={emailTemplates.idChange.body} onChange={e => handleTemplateChange('idChange', 'body', e.target.value)} rows={10} className="font-mono text-xs" /></div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="email-tpl">
                            <AccordionTrigger className="font-bold">Email Address Change</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5"><Label>Enable Notification</Label><p className="text-xs text-muted-foreground">Send when an admin updates a user's primary login email.</p></div>
                                    <Switch checked={emailTemplates.emailChange.enabled} onCheckedChange={val => handleTemplateChange('emailChange', 'enabled', val)} />
                                </div>
                                <div className="space-y-2"><Label>Email Subject</Label><Input value={emailTemplates.emailChange.subject} onChange={e => handleTemplateChange('emailChange', 'subject', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Email Body (HTML)</Label><Textarea value={emailTemplates.emailChange.body} onChange={e => handleTemplateChange('emailChange', 'body', e.target.value)} rows={10} className="font-mono text-xs" /></div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="attendance-marker-tpl">
                            <AccordionTrigger className="font-bold flex gap-2"><Mail className="h-4 w-4"/>Attendance Marker Assignment</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="space-y-0.5"><Label>Enable Notification</Label><p className="text-xs text-muted-foreground">Send automatically when a student is assigned attendance marker privilege.</p></div>
                                    <Switch checked={emailTemplates.attendanceMarker?.enabled !== false} onCheckedChange={val => handleTemplateChange('attendanceMarker', 'enabled', val)} />
                                </div>
                                <div className="space-y-2"><Label>Email Subject</Label><Input value={emailTemplates.attendanceMarker?.subject || ''} onChange={e => handleTemplateChange('attendanceMarker', 'subject', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Email Body (HTML)</Label><Textarea value={emailTemplates.attendanceMarker?.body || ''} onChange={e => handleTemplateChange('attendanceMarker', 'body', e.target.value)} rows={10} className="font-mono text-xs" /></div>
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