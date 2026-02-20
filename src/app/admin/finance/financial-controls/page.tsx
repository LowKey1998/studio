'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import { Loader2, Percent, Save, Info, LayoutGrid, ShieldAlert, Lock, Unlock, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type FinancialSettings = {
    paymentThreshold: number;
    defaulterRestrictions: {
        registration: boolean;
        results: boolean;
        library: boolean;
        exams: boolean;
        sidebar: {
            [key: string]: boolean; // Category Label -> Restricted (True means hidden)
        }
    }
};

const studentSidebarCategories = [
    "Academics",
    "eLearning",
    "Campus Life",
    "Innovation",
    "Spiritual Life"
];

export default function FinancialControlsPage() {
    const [financialSettings, setFinancialSettings] = React.useState<FinancialSettings>({
        paymentThreshold: 75,
        defaulterRestrictions: {
            registration: true,
            results: true,
            library: false,
            exams: false,
            sidebar: {
                "eLearning": true,
                "Campus Life": true,
                "Innovation": true
            }
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
                const data = snapshot.val();
                setFinancialSettings({
                    ...data,
                    defaulterRestrictions: {
                        ...data.defaulterRestrictions,
                        sidebar: data.defaulterRestrictions?.sidebar || {}
                    }
                });
            }
            setLoading(false);
        };
        fetchSettings();
    }, []);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await set(ref(db, 'settings/financialSettings'), financialSettings);
            toast({ variant: 'success', title: 'Policies Updated', description: 'Institutional financial controls are now live.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md">
                            <ShieldAlert className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Financial Compliance & Controls</CardTitle>
                            <CardDescription>Select exactly which pages and sections are locked for students who haven't met payment thresholds.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-primary"/> Portal Navigation Locks
                            </CardTitle>
                            <CardDescription>Choose which student sidebar sections are hidden when a student is flagged as a defaulter.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                {studentSidebarCategories.map((category) => {
                                    const isRestricted = !!financialSettings.defaulterRestrictions.sidebar[category];
                                    return (
                                        <div 
                                            key={category} 
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-xl border transition-all",
                                                isRestricted ? "bg-red-50/50 border-red-200" : "bg-green-50/30 border-green-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("p-2 rounded-lg", isRestricted ? "bg-red-100" : "bg-green-100")}>
                                                    {isRestricted ? <Lock className="h-4 w-4 text-red-600"/> : <Unlock className="h-4 w-4 text-green-600"/>}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="text-sm font-bold">{category} Section</span>
                                                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                                                        {isRestricted ? "Access Locked" : "Public to Student"}
                                                    </p>
                                                </div>
                                            </div>
                                            <Switch 
                                                checked={isRestricted} 
                                                onCheckedChange={() => handleSidebarRestrictionToggle(category)} 
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-primary"/> Functional Action Blocks
                            </CardTitle>
                            <CardDescription>Hard-block specific institutional processes for defaulting students.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            {[
                                { key: 'registration', label: 'Semester Registration', desc: 'Block enrolling in future terms.' },
                                { key: 'results', label: 'Result Visibility', desc: 'Hide grades and transcripts.' },
                                { key: 'library', label: 'Library Loans', desc: 'Suspend book borrowing.' },
                                { key: 'exams', label: 'Exam Participation', desc: 'Flag as ineligible on rosters.' }
                            ].map((item) => (
                                <div key={item.key} className="flex items-start justify-between p-4 rounded-xl border bg-muted/10">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-bold">{item.label}</Label>
                                        <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                                    </div>
                                    <Switch 
                                        checked={financialSettings.defaulterRestrictions[item.key as keyof typeof financialSettings.defaulterRestrictions] as boolean} 
                                        onCheckedChange={() => handleRestrictionChange(item.key as any)} 
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-2 border-primary/20 bg-primary/5">
                        <CardHeader className="pb-3 border-b border-primary/10">
                            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                                <Percent className="h-4 w-4"/> Global Parameters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="payment-threshold" className="text-sm font-bold">Payment Threshold (%)</Label>
                                <div className="relative">
                                    <Input id="payment-threshold" type="number" min="0" max="100" value={financialSettings.paymentThreshold} onChange={(e) => setFinancialSettings(p => ({...p, paymentThreshold: Number(e.target.value)}))}/>
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic leading-snug">The minimum percentage of total semester fees a student must pay to clear standing alerts and navigation locks.</p>
                            </div>
                            
                            <Separator />

                            <Alert variant="default" className="bg-white border-primary/20 py-3">
                                <Info className="h-4 w-4 text-primary" />
                                <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-primary">System Logic</AlertTitle>
                                <AlertDescription className="text-[10px] leading-relaxed">
                                    Restrictions apply automatically after the <strong>Installment Deadline</strong> plus the <strong>Grace Period</strong> (configured in Semester Setup) has passed.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                        <CardFooter className="pt-0">
                            <Button type="submit" size="lg" className="w-full shadow-lg font-bold" disabled={saving || loading}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                                Save Compliance Policy
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </form>
    );
}
