
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

export default function LeadScoringPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Lead Scoring</CardTitle>
                <CardDescription>Set up rules to automatically score leads based on their information and actions.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">Automated lead scoring rules will be configured here.</p>
                </div>
            </CardContent>
        </Card>
    );
}
