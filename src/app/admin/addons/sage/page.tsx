'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Link } from 'lucide-react';
import Image from 'next/image';

export default function SagePage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Sage Integration</CardTitle>
                <CardDescription>Connect Edutrack360 to your Sage accounting software for seamless data flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex justify-center p-8 border rounded-lg bg-muted/50">
                    <div className="flex items-center gap-8">
                         <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="Edutrack360 Logo" data-ai-hint="edutrack360 logo"/>
                        <Link className="h-12 w-12 text-muted-foreground" />
                        <Image src="https://placehold.co/100x100.png" width={80} height={80} alt="Sage Logo" data-ai-hint="sage logo"/>
                    </div>
                </div>
                 <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Unify Your Financial Operations</h3>
                    <p className="text-muted-foreground max-w-2xl mx-auto">Activate the Sage integration to synchronize student invoices, payments, and institutional expenses. This connection eliminates redundant data entry, improves accuracy, and ensures your financial records are always up-to-date across both platforms.</p>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Configure Sage Integration</Button>
                </div>
            </CardContent>
        </Card>
    );
}
