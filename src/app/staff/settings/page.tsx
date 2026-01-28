
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase';
import { ref, get, set, update, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


type PaymentMethods = {
    flutterwave: { enabled: boolean };
}

export default function StaffSettingsPage() {
    const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethods>({ flutterwave: { enabled: true } });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [isAccountant, setIsAccountant] = React.useState(false);

    const { toast } = useToast();

     React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, (snapshot) => {
                     if (snapshot.exists()) {
                        const userData = snapshot.val();
                        const userIsAccountant = userData.role === 'Staff' && userData.subRoles?.includes('Accountant');
                        setIsAccountant(userIsAccountant);
                    }
                    fetchSettings();
                });
            } else {
                setLoading(false);
            }
        });

        const fetchSettings = () => {
            const settingsRef = ref(db, 'settings');
            onValue(settingsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setPaymentMethods(data.paymentMethods || { flutterwave: { enabled: true } });
                }
                setLoading(false);
            });
        }
        return () => unsubscribe();
    }, []);

    const handlePaymentMethodToggle = (method: keyof PaymentMethods, checked: boolean) => {
        setPaymentMethods(prev => ({
            ...prev,
            [method]: { ...prev[method], enabled: checked }
        }));
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const settingsRef = ref(db, 'settings');
            
            await update(settingsRef, { 
                paymentMethods: paymentMethods
            });

            toast({
                variant: 'success',
                title: 'Settings Saved',
                description: 'Payment method settings have been updated successfully.',
            });
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setSaving(false);
        }
    };
    
    if (loading) {
        return <div className="p-6"><Skeleton className="h-64 w-full"/></div>
    }

    if (!isAccountant) {
        return (
             <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Access Denied</AlertTitle>
                        <AlertDescription>You do not have permission to modify settings. This area is restricted to accountants.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )
    }

    return (
        <form onSubmit={handleSaveChanges} className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Payment Methods</CardTitle>
                    <CardDescription>Enable or disable payment methods available to students.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                        <Label htmlFor="flutterwave-switch">Flutterwave (Mobile Money)</Label>
                        <div className="sm:col-span-2">
                            <Switch
                                id="flutterwave-switch"
                                checked={paymentMethods.flutterwave.enabled}
                                onCheckedChange={(checked) => handlePaymentMethodToggle('flutterwave', checked)}
                                disabled={saving}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {paymentMethods.flutterwave.enabled ? 'Students can pay online via Flutterwave.' : 'Online payments are currently disabled.'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <div className="flex justify-end">
                <Button type="submit" disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
}
