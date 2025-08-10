'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link } from 'lucide-react';
import Image from 'next/image';

export default function QuickBooksPage() {
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
                        <Link className="h-12 w-12 text-muted-foreground" />
                        <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="QuickBooks Logo" data-ai-hint="quickbooks logo"/>
                    </div>
                </div>
                 <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Streamline Your Financial Workflow</h3>
                    <p className="text-muted-foreground max-w-2xl mx-auto">Enable the QuickBooks integration to automatically sync student invoices, payments, and expense records from Edutrack360 to your QuickBooks Online account. Reduce manual data entry, minimize errors, and get a real-time view of your institution's financial health.</p>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Configure QuickBooks Integration</Button>
                </div>
            </CardContent>
        </Card>
    );
}
