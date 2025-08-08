
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';

type BankSettings = {
    apiKey: string;
    apiSecret: string;
};

export default function BankIntegrationPage() {
    const [settings, setSettings] = React.useState<BankSettings>({ apiKey: '', apiSecret: ''});
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchSettings = async () => {
            const settingsRef = ref(db, 'settings/bankIntegration');
            const snapshot = await get(settingsRef);
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await set(ref(db, 'settings/bankIntegration'), settings);
            toast({ title: 'Settings Saved', description: 'Bank integration settings have been updated.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bank API Integration</CardTitle>
                <CardDescription>Manage the integration with bank APIs to automate transaction fetching and streamline reconciliation processes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <Label htmlFor="api-key">API Key</Label>
                    <Input id="api-key" type="password" placeholder="Enter your bank's API key" value={settings.apiKey} onChange={e => setSettings({...settings, apiKey: e.target.value})}/>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="api-secret">API Secret</Label>
                    <Input id="api-secret" type="password" placeholder="Enter your bank's API secret" value={settings.apiSecret} onChange={e => setSettings({...settings, apiSecret: e.target.value})}/>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Save Configuration</Button>
            </CardFooter>
        </Card>
    );
}
