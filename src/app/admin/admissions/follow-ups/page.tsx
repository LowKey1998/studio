
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AutomatedFollowUpsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Automated Follow-Ups</CardTitle>
                        <CardDescription>Set up automated email and SMS sequences to nurture leads and applicants.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">This section will allow for creating automated communication workflows.</p>
                </div>
            </CardContent>
        </Card>
    );
}
