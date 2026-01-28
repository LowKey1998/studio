
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import { Loader2, Percent, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';

type FinancialSettings = {
    paymentThreshold: number;
    defaulterRestrictions: {
        registration: boolean;
        results: boolean;
        library: boolean;
        exams: boolean;
    }
};

export default function FinancialControlsPage() {
    const [financialSettings, setFinancialSettings] = React.useState<FinancialSettings>({
        paymentThreshold: 75,
        defaulterRestrictions: {
            registration: true,
            results: true,
            library: false,
            exams: false
        }
    });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchSettings = async () => {
            const settingsRef = ref(db, 'settings/financialSettings');
            const snapshot = await get(settingsRef);
            if (snapshot.exists()) {
                setFinancialSettings(snapshot.val());
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

    const handleRestrictionChange = (key: keyof FinancialSettings['defaulterRestrictions']) => {
        setFinancialSettings(prev => ({
            ...prev,
            defaulterRestrictions: {
                ...prev.defaulterRestrictions,
                [key]: !prev.defaulterRestrictions[key]
            }
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await set(ref(db, 'settings/financialSettings'), financialSettings);
            toast({ title: 'Success', description: 'Financial controls have been updated.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave}>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Financial Controls</CardTitle>
                    <CardDescription>Set rules for payment defaulters and system access.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <Label htmlFor="payment-threshold">Payment Threshold</Label>
                        <div className="sm:col-span-2">
                            <div className="relative max-w-xs">
                                <Input id="payment-threshold" type="number" min="0" max="100" value={financialSettings.paymentThreshold} onChange={(e) => setFinancialSettings(p => ({...p, paymentThreshold: Number(e.target.value)}))}/>
                                <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">If a student pays less than this percentage of an installment, they will be flagged as a defaulter.</p>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start">
                        <Label>Defaulter Restrictions</Label>
                        <div className="sm:col-span-2 space-y-3">
                            <div className="flex items-center space-x-2"><Switch id="restrict-registration" checked={financialSettings.defaulterRestrictions.registration} onCheckedChange={() => handleRestrictionChange('registration')} /><Label htmlFor="restrict-registration">Block New Registrations</Label></div>
                            <div className="flex items-center space-x-2"><Switch id="restrict-results" checked={financialSettings.defaulterRestrictions.results} onCheckedChange={() => handleRestrictionChange('results')} /><Label htmlFor="restrict-results">Block Access to Results</Label></div>
                            <div className="flex items-center space-x-2"><Switch id="restrict-library" checked={financialSettings.defaulterRestrictions.library} onCheckedChange={() => handleRestrictionChange('library')} /><Label htmlFor="restrict-library">Block Library Access</Label></div>
                            <div className="flex items-center space-x-2"><Switch id="restrict-exams" checked={financialSettings.defaulterRestrictions.exams} onCheckedChange={() => handleRestrictionChange('exams')} /><Label htmlFor="restrict-exams">Block Exam Participation</Label></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4"/>}
                        Save Financial Controls
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
