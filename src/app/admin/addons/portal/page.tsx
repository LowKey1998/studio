'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Briefcase, Newspaper, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function JobPortalPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Parent &amp; Applicant Portal</CardTitle>
                <CardDescription>This section has been moved to its own dedicated portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Functionality for parents and new applicants can now be accessed via the main login page or the public landing page.</p>
                     <Button asChild className="mt-4">
                        <Link href="/login">Go to Login Page</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
