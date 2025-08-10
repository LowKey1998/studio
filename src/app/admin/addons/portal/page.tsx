'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Briefcase, Newspaper, Building2 } from 'lucide-react';

export default function JobPortalPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Job & Internal Portal</CardTitle>
                <CardDescription>A centralized hub for internal communication and career opportunities.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">Streamline internal hiring and communication with this powerful add-on.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Briefcase className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Internal Job Board</h4>
                        <p className="text-sm text-muted-foreground">Post job openings exclusively for current staff and students, fostering internal growth and opportunities.</p>
                    </div>
                     <div className="space-y-2">
                        <Newspaper className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Company News & Announcements</h4>
                        <p className="text-sm text-muted-foreground">Share important updates, articles, and announcements in a private, internal-only space.</p>
                    </div>
                     <div className="space-y-2">
                        <Building2 className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Department Pages</h4>
                        <p className="text-sm text-muted-foreground">Allow departments to create their own pages to share information, documents, and updates relevant to their team.</p>
                    </div>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Activate Internal Portal</Button>
                </div>
            </CardContent>
        </Card>
    );
}
