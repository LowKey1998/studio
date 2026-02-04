
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Star, PlusCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function LeadScoringPage() {
    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-orange-500 rounded-lg p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                    <h4 className="font-bold text-orange-800">Configuration Required</h4>
                    <p className="text-orange-700 text-sm">
                        Lead scoring requires a weighted criteria matrix. Please define your institutional scoring priorities in System Settings first.
                    </p>
                </div>
            </div>

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
                        <p className="text-muted-foreground">Automated lead scoring rules can be configured here once the core engine is activated.</p>
                        <Button className="mt-4" disabled><PlusCircle className="mr-2 h-4 w-4"/>New Rule</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
