'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Building, GitMerge, Users } from 'lucide-react';

export default function MultiCampusPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Multi-Campus Management</CardTitle>
                <CardDescription>Unify operations and data across all your campus locations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">Scale your institution with centralized control over multiple campuses.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Building className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Campus-Specific Data</h4>
                        <p className="text-sm text-muted-foreground">Manage courses, students, and staff for each location independently while maintaining a central overview.</p>
                    </div>
                     <div className="space-y-2">
                        <GitMerge className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Consolidated Reporting</h4>
                        <p className="text-sm text-muted-foreground">Generate financial, enrollment, and academic reports for individual campuses or for the entire institution.</p>
                    </div>
                     <div className="space-y-2">
                        <Users className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Role-Based Access</h4>
                        <p className="text-sm text-muted-foreground">Assign administrators and staff to specific campuses, limiting their access to relevant data and functions.</p>
                    </div>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Activate Multi-Campus Module</Button>
                </div>
            </CardContent>
        </Card>
    );
}
