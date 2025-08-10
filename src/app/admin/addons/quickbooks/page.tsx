'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';

export default function QuickBooksPage() {
    const { user, userProfile } = useAuth();
    const [isEnabled, setIsEnabled] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        if (!user) return;
        const integrationRef = ref(db, 'settings/integrations/quickbooks');
        const unsub = onValue(integrationRef, (snapshot) => {
            if (snapshot.exists()) {
                setIsEnabled(snapshot.val().enabled);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    const handleToggle = async (checked: boolean) => {
        if (!user) return;
        try {
            await update(ref(db, 'settings/integrations/quickbooks'), { enabled: checked });
            setIsEnabled(checked);
            toast({ title: `QuickBooks Integration ${checked ? 'Enabled' : 'Disabled'}` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed' });
        }
    };
    
    const canManage = userProfile?.role === 'Admin';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">QuickBooks Integration</CardTitle>
                <CardDescription>Automate your accounting by syncing financial data with QuickBooks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex justify-center p-8 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-8">
                         <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="Edutrack360 Logo" data-ai-hint="edutrack360 logo"/>
                        <LinkIcon className="h-12 w-12 text-muted-foreground" />
                        <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="QuickBooks Logo" data-ai-hint="quickbooks logo"/>
                    </div>
                </div>
                 <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Streamline Your Financial Workflow</h3>
                    <p className="text-muted-foreground max-w-2xl mx-auto">Enable the QuickBooks integration to automatically sync student invoices, payments, and expense records from Edutrack360 to your QuickBooks Online account. Reduce manual data entry, minimize errors, and get a real-time view of your institution's financial health.</p>
                </div>
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 {loading ? <Skeleton className="h-8 w-48" /> : canManage ? (
                     <div className="flex items-center space-x-2">
                        <Switch id="quickbooks-enabled" checked={isEnabled} onCheckedChange={handleToggle} />
                        <Label htmlFor="quickbooks-enabled">{isEnabled ? 'Integration is Active' : 'Integration is Inactive'}</Label>
                    </div>
                 ) : <p className="text-sm text-muted-foreground">Contact an administrator to manage this integration.</p>}

                <Button disabled={!isEnabled}>
                    <Link href="/admin/settings#integrations">
                       Configure Integration
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
