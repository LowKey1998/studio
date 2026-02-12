'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import { Loader2, Percent, Save, Info, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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
        <form onSubmit={handleSave} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Financial Defaulter Policies</CardTitle>
                    <CardDescription>Configure how the system handles students with outstanding balances.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Alert className="bg-primary/5 border-primary/20">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="font-bold">How Defaulter Logic Works</AlertTitle>
                        <AlertDescription className="text-sm space-y-2">
                            <p>The system identifies a "Defaulter" based on the following criteria:</p>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                                <li><strong>Trigger:</strong> An installment deadline has passed (+ any allowed grace period).</li>
                                <li><strong>Condition:</strong> The student's total paid amount is less than the required cumulative percentage (e.g. 75%) of the total due.</li>
                            </ul>
                            <p className="font-semibold pt-2">Note: Deadlines and Grace Periods are set per-semester in <Link href="/admin/registration-management" className="text-primary underline">Registration Management</Link>.</p>
                        </AlertDescription>
                    </Alert>

                    <Separator />

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <div className="space-y-1">
                            <Label htmlFor="payment-threshold" className="text-base font-bold">Global Defaulter Threshold</Label>
                            <p className="text-xs text-muted-foreground pr-4">The default percentage a student must pay to be considered in good standing. This can be overridden per semester.</p>
                        </div>
                        <div className="sm:col-span-2">
                            <div className="relative max-w-xs">
                                <Input id="payment-threshold" type="number" min="0" max="100" value={financialSettings.paymentThreshold} onChange={(e) => setFinancialSettings(p => ({...p, paymentThreshold: Number(e.target.value)}))}/>
                                <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-start">
                        <div className="space-y-1">
                            <Label className="text-base font-bold">Academic Restrictions</Label>
                            <p className="text-xs text-muted-foreground pr-4">Enable or disable specific portal blocks for students flagged as defaulters.</p>
                        </div>
                        <div className="sm:col-span-2 space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/10">
                                <div className="space-y-0.5"><Label htmlFor="restrict-registration">Block New Registrations</Label><p className="text-[10px] text-muted-foreground">Prevents enrolling in future semesters.</p></div>
                                <Switch id="restrict-registration" checked={financialSettings.defaulterRestrictions.registration} onCheckedChange={() => handleRestrictionChange('registration')} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/10">
                                <div className="space-y-0.5"><Label htmlFor="restrict-results">Block Access to Results</Label><p className="text-[10px] text-muted-foreground">Hides current and past grades.</p></div>
                                <Switch id="restrict-results" checked={financialSettings.defaulterRestrictions.results} onCheckedChange={() => handleRestrictionChange('results')} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/10">
                                <div className="space-y-0.5"><Label htmlFor="restrict-library">Block Library Access</Label><p className="text-[10px] text-muted-foreground">Prevents checking out new books.</p></div>
                                <Switch id="restrict-library" checked={financialSettings.defaulterRestrictions.library} onCheckedChange={() => handleRestrictionChange('library')} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/10">
                                <div className="space-y-0.5"><Label htmlFor="restrict-exams">Block Exam Participation</Label><p className="text-[10px] text-muted-foreground">Flags student as ineligible on exam rosters.</p></div>
                                <Switch id="restrict-exams" checked={financialSettings.defaulterRestrictions.exams} onCheckedChange={() => handleRestrictionChange('exams')} />
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t pt-6">
                    <Button type="submit" disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Defaulter Policies
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
