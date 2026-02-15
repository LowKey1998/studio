'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Save, Loader2, RefreshCw, Table as TableIcon, Settings2, Info, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { ref, onValue, update, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchInvoicesFromQuickbooks } from '@/ai/flows/sync-to-quickbooks';
import { fetchAccountsFromQuickbooks } from '@/ai/flows/fetch-qb-accounts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

type QBIntegrationSettings = {
    enabled: boolean;
    syncInvoices: boolean;
    syncExpenses: boolean;
    syncPayroll: boolean;
    clientId?: string;
    clientSecret?: string;
    realmId?: string;
    connected?: boolean;
    mappings?: Record<string, string>; // mapping logical category to QB account ID
};

const mappingCategories = [
    { key: 'tuition', label: 'Tuition Revenue' },
    { key: 'mandatoryFees', label: 'Mandatory Fees' },
    { key: 'optionalFees', label: 'Optional Fees' },
    { key: 'expenses', label: 'Default Expense Account' },
    { key: 'bank', label: 'Settlement Bank Account' }
];

export default function QuickBooksPage() {
    const { user, userProfile } = useAuth();
    const [settings, setSettings] = React.useState<QBIntegrationSettings>({ 
        enabled: false, 
        syncInvoices: false, 
        syncExpenses: false, 
        syncPayroll: false, 
        connected: false,
        mappings: {}
    });
    const [loading, setLoading] = React.useState(true);
    const [fetchingInvoices, setFetchingInvoices] = React.useState(false);
    const [fetchingAccounts, setFetchingAccounts] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [qbInvoices, setQbInvoices] = React.useState<any[]>([]);
    const [qbAccounts, setQbAccounts] = React.useState<any[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        if (!user) return;
        const integrationRef = ref(db, 'settings/integrations/quickbooks');
        const unsub = onValue(integrationRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSettings({
                    ...data,
                    mappings: data.mappings || {}
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const handleToggle = (field: keyof QBIntegrationSettings, checked: boolean) => {
        setSettings(prev => ({...prev, [field]: checked}));
    };

    const handleMappingChange = (categoryKey: string, accountId: string) => {
        setSettings(prev => ({
            ...prev,
            mappings: {
                ...(prev.mappings || {}),
                [categoryKey]: accountId
            }
        }));
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

    const handleFetchInvoices = async () => {
        setFetchingInvoices(true);
        try {
            const invoices = await fetchInvoicesFromQuickbooks();
            setQbInvoices(invoices);
            toast({ title: 'Invoices Fetched', description: `Retrieved ${invoices.length} recent invoices from QuickBooks.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
        } finally {
            setFetchingInvoices(false);
        }
    };

    const handleFetchAccounts = async () => {
        setFetchingAccounts(true);
        try {
            const accounts = await fetchAccountsFromQuickbooks();
            setQbAccounts(accounts);
            toast({ title: 'Connection Tested', description: `Successfully retrieved ${accounts.length} accounts from Chart of Accounts.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Test Failed', description: error.message });
        } finally {
            setFetchingAccounts(false);
        }
    };
    
    const isConnected = !!settings.connected;

    if (loading) {
        return <div className="space-y-6"><Skeleton className="h-48 w-full"/><Skeleton className="h-96 w-full"/></div>;
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2"><Settings2 className="text-primary"/> QuickBooks Integration Center</CardTitle>
                        <CardDescription>Configure account mappings and test data synchronization.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleFetchAccounts} disabled={fetchingAccounts || !isConnected}>
                            {fetchingAccounts ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                            Test Data Connection
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Configuration
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Chart of Accounts Mapping</CardTitle>
                            <CardDescription>Map logical system categories to your actual QuickBooks accounts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {!isConnected ? (
                                <Alert className="bg-muted/50 border-dashed border-2">
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>Connect to Map Accounts</AlertTitle>
                                    <AlertDescription>
                                        You must successfully connect your QuickBooks account before you can map the Chart of Accounts.
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <div className="grid gap-6">
                                    {mappingCategories.map((cat) => (
                                        <div key={cat.key} className="grid sm:grid-cols-3 items-center gap-4">
                                            <Label className="font-bold">{cat.label}</Label>
                                            <div className="sm:col-span-2">
                                                <Select 
                                                    value={settings.mappings?.[cat.key] || ''} 
                                                    onValueChange={(val) => handleMappingChange(cat.key, val)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a QuickBooks account..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {qbAccounts.length > 0 ? qbAccounts.map(acc => (
                                                            <SelectItem key={acc.Id} value={acc.Id}>{acc.Name} ({acc.AccountType})</SelectItem>
                                                        )) : (
                                                            <div className="p-2 text-xs text-muted-foreground text-center">
                                                                Click "Test Data Connection" to load accounts.
                                                            </div>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Real-time Data Audit</CardTitle>
                                <CardDescription>Most recent invoices retrieved from the connected QuickBooks instance.</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleFetchInvoices} disabled={fetchingInvoices || !isConnected}>
                                {fetchingInvoices ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                Sync List
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {qbInvoices.length > 0 ? (
                                <div className="rounded-md border bg-card">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Invoice #</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead className="text-right">Amount (ZMW)</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {qbInvoices.map((inv) => (
                                                <TableRow key={inv.Id}>
                                                    <TableCell className="font-mono text-xs">{inv.DocNumber}</TableCell>
                                                    <TableCell className="text-xs font-bold">{inv.CustomerRef.name}</TableCell>
                                                    <TableCell className="text-right font-semibold">ZMW {inv.TotalAmt.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={inv.Balance === 0 ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
                                                            {inv.Balance === 0 ? 'Fully Paid' : 'Pending'}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                                    <TableIcon className="h-12 w-12 opacity-20 mb-4" />
                                    <p className="text-sm font-medium">No audit data fetched. Click "Sync List" to verify connectivity.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-primary/20">
                        <CardHeader className="bg-primary/5 pb-4 border-b">
                            <CardTitle className="text-base flex items-center gap-2"><LinkIcon className="h-4 w-4"/> Connectivity Status</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="flex items-center gap-4">
                                    <Image src="https://placehold.co/60x60.png" width={40} height={40} alt="Portal" className="rounded shadow-sm"/>
                                    <Separator orientation="vertical" className="h-8"/>
                                    <Image src="https://placehold.co/60x60.png" width={40} height={40} alt="QB" className="rounded shadow-sm"/>
                                </div>
                                
                                {isConnected ? (
                                    <div className="space-y-1">
                                        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1.5 h-7 px-3">
                                            <CheckCircle2 className="h-3 w-3" /> Live Connection
                                        </Badge>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest pt-2">Connected to Realm</p>
                                        <code className="text-xs bg-muted p-1 rounded font-mono">{settings.realmId}</code>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <Badge variant="secondary" className="gap-1.5 h-7 px-3">Disconnected</Badge>
                                        <Button asChild className="w-full h-12 shadow-md">
                                            <a href="/api/quickbooks/auth">Establish Bridge</a>
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Automation Rules</h4>
                                <div className={`space-y-3 transition-all ${isConnected ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                    <div className="flex items-center justify-between p-2 rounded border bg-card">
                                        <Label htmlFor="sw-enabled" className="text-xs font-bold">Active Integration</Label>
                                        <Switch id="sw-enabled" checked={settings.enabled} onCheckedChange={(val) => handleToggle('enabled', val)} />
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded border bg-card">
                                        <Label htmlFor="sw-inv" className="text-xs font-bold">Sync Invoices</Label>
                                        <Checkbox id="sw-inv" checked={settings.syncInvoices} onCheckedChange={(val) => handleToggle('syncInvoices', !!val)} />
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded border bg-card">
                                        <Label htmlFor="sw-exp" className="text-xs font-bold">Sync Expenses</Label>
                                        <Checkbox id="sw-exp" checked={settings.syncExpenses} onCheckedChange={(val) => handleToggle('syncExpenses', !!val)} />
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded border bg-card">
                                        <Label htmlFor="sw-pay" className="text-xs font-bold">Sync Payroll</Label>
                                        <Checkbox id="sw-pay" checked={settings.syncPayroll} onCheckedChange={(val) => handleToggle('syncPayroll', !!val)} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
