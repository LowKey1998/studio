
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Send, PlusCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export default function AutomatedFollowUpsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border-2 border-orange-500 rounded-lg p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                    <h4 className="font-bold text-orange-800">Coming Soon: Workflow Builder</h4>
                    <p className="text-orange-700 text-sm">
                        The automated sequence builder is under development. Soon you will be able to define custom email and SMS nurture paths for new leads.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Automated Follow-Ups</CardTitle>
                            <CardDescription>Set up automated email and SMS sequences to nurture leads and applicants.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-center p-8 border rounded-lg bg-muted/50">
                        <h3 className="text-xl font-semibold mb-2">Create Communication Workflows</h3>
                        <p className="text-muted-foreground">This section will allow for creating automated communication workflows.</p>
                        <Button className="mt-4" disabled><PlusCircle className="mr-2 h-4 w-4"/>New Workflow</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
