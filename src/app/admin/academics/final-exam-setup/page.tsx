'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Percent, Save } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';

type ExamPolicy = {
    weight: number;
    duration: number; // in minutes
    notes: string;
};

export default function FinalExamSetupPage() {
    const [policy, setPolicy] = React.useState<ExamPolicy>({ weight: 60, duration: 180, notes: '' });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const policyRef = ref(db, 'settings/finalExamPolicy');
        const unsubscribe = onValue(policyRef, (snapshot) => {
            if (snapshot.exists()) {
                setPolicy(snapshot.val());
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleInputChange = (field: keyof ExamPolicy, value: string | number) => {
        setPolicy(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await set(ref(db, 'settings/finalExamPolicy'), {
                ...policy,
                weight: Number(policy.weight),
                duration: Number(policy.duration),
            });
            toast({ title: "Settings Saved", description: "Final exam policy has been updated." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Final Exam Setup</CardTitle>
                <CardDescription>Configure the default settings and parameters for final examinations across the institution.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : (
                    <div className="space-y-6 max-w-lg">
                        <div className="space-y-2">
                            <Label htmlFor="weight">Final Exam Weight</Label>
                            <div className="relative">
                                <Input
                                    id="weight"
                                    type="number"
                                    value={policy.weight}
                                    onChange={(e) => handleInputChange('weight', e.target.value)}
                                    className="pr-8"
                                />
                                <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">The default percentage this exam contributes to the final course grade.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="duration">Default Duration (minutes)</Label>
                            <Input
                                id="duration"
                                type="number"
                                value={policy.duration}
                                onChange={(e) => handleInputChange('duration', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Policy Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Enter any general notes or policies regarding final exams..."
                                value={policy.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                rows={5}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button onClick={handleSave} disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Policy
                </Button>
            </CardFooter>
        </Card>
    );
}
