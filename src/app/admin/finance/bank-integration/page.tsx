
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

type BankDetails = {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchCode?: string;
    swiftCode?: string;
};

export default function BankIntegrationPage() {
    const [details, setDetails] = React.useState<BankDetails>({});
    const [saving, setSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchSettings = async () => {
            const settingsRef = ref(db, 'settings/bankDetails');
            const snapshot = await get(settingsRef);
            if (snapshot.exists()) {
                setDetails(snapshot.val());
            }
        };
        fetchSettings();
    }, []);

    const handleInputChange = (field: keyof BankDetails, value: string) => {
        setDetails(prev => ({...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await set(ref(db, 'settings/bankDetails'), details);
            toast({ title: 'Settings Saved', description: 'Bank details have been updated.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bank Details Configuration</CardTitle>
                <CardDescription>Enter the institution's bank account details to be displayed on the public website for direct deposits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
                <div className="space-y-1">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input id="bankName" placeholder="e.g., Zambia National Commercial Bank" value={details.bankName || ''} onChange={e => handleInputChange('bankName', e.target.value)}/>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="accountName">Account Name</Label>
                    <Input id="accountName" placeholder="e.g., Edutrack 360" value={details.accountName || ''} onChange={e => handleInputChange('accountName', e.target.value)}/>
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input id="accountNumber" placeholder="e.g., 0123456789123" value={details.accountNumber || ''} onChange={e => handleInputChange('accountNumber', e.target.value)}/>
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="branchCode">Branch Code</Label>
                    <Input id="branchCode" placeholder="e.g., 010203" value={details.branchCode || ''} onChange={e => handleInputChange('branchCode', e.target.value)}/>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="swiftCode">SWIFT Code (Optional)</Label>
                    <Input id="swiftCode" placeholder="e.g., ZNCOZMLU" value={details.swiftCode || ''} onChange={e => handleInputChange('swiftCode', e.target.value)}/>
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Save Configuration</Button>
            </CardFooter>
        </Card>
    );
}
