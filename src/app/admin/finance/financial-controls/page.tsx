'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get, set } from 'firebase/database';
import { Loader2, Percent, Save, Info, LayoutGrid, ShieldAlert, Lock, Unlock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

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
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <ShieldAlert className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Financial Defaulter Policies</CardTitle>
                            <CardDescription>Control system access and visibility for students with outstanding balances.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    <Alert className="bg-primary/5 border-primary/20">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="font-bold uppercase text-xs tracking-widest">Compliance Engine Logic</AlertTitle>
                        <AlertDescription className="text-sm space-y-2 mt-2 leading-relaxed">
                            <p>A student is flagged as a <strong>Defaulter</strong> if:</p>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                                <li>The current date is past an installment deadline plus the configured <strong>Grace Period</strong>.</li>
                                <li>The total amount paid for the current semester is below the required <strong>Threshold</strong>.</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-start">
                        <div className="space-y-1">
                            <Label htmlFor="payment-threshold" className="text-base font-bold">Global Threshold (%)</Label>
                            <p className="text-xs text-muted-foreground pr-4">The default percentage of total fees a student must pay per deadline to maintain "Good Standing".</p>
                        </div>
                        <div className="sm:col-span-2">
                            <div className="relative max-w-[120px]">
                                <Input id="payment-threshold" type="number" min="0" max="100" value={financialSettings.paymentThreshold} onChange={(e) => setFinancialSettings(p => ({...p, paymentThreshold: Number(e.target.value)}))}/>
                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-start">
                        <div className="space-y-1">
                            <Label className="text-base font-bold">Functional Access Restrictions</Label>
                            <p className="text-xs text-muted-foreground pr-4">Disable specific system actions for defaulting students.</p>
                        </div>
                        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
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
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-start">
                        <div className="space-y-1">
                            <Label className="text-base font-bold flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-primary" /> Sidebar Visibility Rules
                            </Label>
                            <p className="text-xs text-muted-foreground pr-4">Choose which sidebar sections are <strong>hidden</strong> from students in arrears. Sections not listed (e.g., Finances) are always visible.</p>
                        </div>
                        <div className="sm:col-span-2 space-y-3">
                            <div className="grid gap-3">
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
                                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                                        {isRestricted ? "Hidden from Defaulters" : "Visible to Everyone"}
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
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t pt-6 bg-muted/5">
                    <Button type="submit" size="lg" className="shadow-lg px-8 font-bold" disabled={saving || loading}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Financial Control Policies
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
