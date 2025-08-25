
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save } from 'lucide-react';

type PortalSettings = {
    enablePortal: boolean;
    showExamResults: boolean;
    showAttendance: boolean;
    showFeeBalance: boolean;
};

export default function ParentPortalSettingsPage() {
    const [settings, setSettings] = React.useState<PortalSettings>({
        enablePortal: false,
        showExamResults: true,
        showAttendance: true,
        showFeeBalance: true,
    });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const settingsRef = ref(db, 'settings/parentPortal');
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                setSettings(snapshot.val());
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleToggle = (key: keyof PortalSettings, value: boolean) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await update(ref(db, 'settings/parentPortal'), settings);
            toast({ title: 'Settings Saved', description: 'Parent Portal settings have been updated.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Parent Portal Settings</CardTitle>
                <CardDescription>Control what information is visible to parents and guardians in their portal.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-6">
                        {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-10 w-full"/>)}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Enable Parent Portal</Label>
                                <p className="text-sm text-muted-foreground">Globally turn the parent portal on or off.</p>
                            </div>
                            <Switch checked={settings.enablePortal} onCheckedChange={(val) => handleToggle('enablePortal', val)} />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label>Show Exam Results</Label>
                                <p className="text-sm text-muted-foreground">Allow parents to view their child's detailed exam results.</p>
                            </div>
                            <Switch checked={settings.showExamResults} onCheckedChange={(val) => handleToggle('showExamResults', val)} />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label>Show Attendance Records</Label>
                                <p className="text-sm text-muted-foreground">Allow parents to see their child's attendance summary.</p>
                            </div>
                            <Switch checked={settings.showAttendance} onCheckedChange={(val) => handleToggle('showAttendance', val)} />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label>Show Fee Balance</Label>
                                <p className="text-sm text-muted-foreground">Display the current fee balance in the parent portal.</p>
                            </div>
                            <Switch checked={settings.showFeeBalance} onCheckedChange={(val) => handleToggle('showFeeBalance', val)} />
                        </div>
                    </div>
                )}
            </CardContent>
             <CardFooter>
                 <Button onClick={handleSave} disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save Settings
                </Button>
            </CardFooter>
        </Card>
    );
}
