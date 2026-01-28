
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Save, Loader2, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type QBIntegrationSettings = {
    enabled: boolean;
    syncInvoices: boolean;
    syncExpenses: boolean;
    syncPayroll: boolean;
    clientId?: string;
    clientSecret?: string;
    realmId?: string;
    connected?: boolean;
};

export default function QuickBooksPage() {
    const { user, userProfile } = useAuth();
    const [settings, setSettings] = React.useState<QBIntegrationSettings>({ enabled: false, syncInvoices: false, syncExpenses: false, syncPayroll: false, connected: false });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (!user) return;
        const integrationRef = ref(db, 'settings/integrations/quickbooks');
        const unsub = onValue(integrationRef, (snapshot) => {
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const handleToggle = (field: keyof QBIntegrationSettings, checked: boolean) => {
        setSettings(prev => ({...prev, [field]: checked}));
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await update(ref(db, 'settings/integrations/quickbooks'), settings);
            toast({ title: `QuickBooks Integration Settings Saved` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        } finally {
            setSaving(false);
        }
    };
    
    const canManage = userProfile?.role === 'Admin';
    const isConfigured = !!settings.clientId && !!settings.clientSecret;
    const isConnected = !!settings.connected;

    if (loading) {
        return <Skeleton className="h-96 w-full"/>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">QuickBooks Integration</CardTitle>
                <CardDescription>Automate your accounting by syncing financial data with QuickBooks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex justify-center p-8 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-8">
                         <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="Edutrack360 Logo" data-ai-hint="edutrack360 logo"/>
                        <LinkIcon className="h-12 w-12 text-muted-foreground" />
                        <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="QuickBooks Logo" data-ai-hint="quickbooks logo"/>
                    </div>
                </div>
                 <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Streamline Your Financial Workflow</h3>
                    <p className="text-muted-foreground max-w-2xl mx-auto">Enable the QuickBooks integration to automatically sync student invoices, payments, and expense records from Edutrack360 to your QuickBooks Online account. Reduce manual data entry, minimize errors, and get a real-time view of your institution's financial health.</p>
                </div>
                {canManage && !isConfigured && (
                     <Alert>
                        <AlertTitle>Configuration Required</AlertTitle>
                        <AlertDescription>Please configure your QuickBooks Client ID and Secret in System Settings before you can connect.</AlertDescription>
                        <div className="mt-4">
                            <Button asChild><Link href="/admin/settings#integrations">Go to Settings</Link></Button>
                        </div>
                    </Alert>
                )}

                 {canManage && isConfigured && (
                    <div className="flex justify-center">
                        {isConnected ? (
                            <Button variant="secondary" disabled>
                                <RefreshCw className="mr-2 h-4" /> Connected to QuickBooks
                            </Button>
                        ) : (
                            <Button asChild>
                                <a href="/api/quickbooks/auth">Connect to QuickBooks</a>
                            </Button>
                        )}
                    </div>
                )}
                
                 <div className="space-y-4 pt-4 border-t">
                     <div className="flex items-center space-x-2">
                        <Switch id="quickbooks-enabled" checked={settings.enabled} onCheckedChange={(val) => handleToggle('enabled', val)} disabled={!isConnected}/>
                        <Label htmlFor="quickbooks-enabled" className="text-lg">{settings.enabled && isConnected ? 'Integration is Active' : 'Integration is Inactive'}</Label>
                    </div>
                    <div className={`space-y-4 pl-8 transition-opacity ${settings.enabled && isConnected ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <h4 className="font-semibold">Sync Options</h4>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="sync-invoices" checked={settings.syncInvoices} onCheckedChange={(val) => handleToggle('syncInvoices', !!val)} />
                            <Label htmlFor="sync-invoices">Sync Student Invoices & Payments</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Checkbox id="sync-expenses" checked={settings.syncExpenses} onCheckedChange={(val) => handleToggle('syncExpenses', !!val)} />
                            <Label htmlFor="sync-expenses">Sync Institutional Expenses</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Checkbox id="sync-payroll" checked={settings.syncPayroll} onCheckedChange={(val) => handleToggle('syncPayroll', !!val)} />
                            <Label htmlFor="sync-payroll">Sync Staff Payroll</Label>
                        </div>
                    </div>
                 </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4"/>}
                    Save Sync Options
                </Button>
            </CardFooter>
        </Card>
    );
}
