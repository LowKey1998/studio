
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Star, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LeadScoringPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Lead Scoring</CardTitle>
                        <CardDescription>Set up rules to automatically score leads based on their information and actions.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Define Scoring Rules</h3>
                    <p className="text-muted-foreground">Automated lead scoring rules can be configured here.</p>
                    <Button className="mt-4"><PlusCircle className="mr-2 h-4"/>New Rule</Button>
                </div>
            </CardContent>
        </Card>
    );
}
