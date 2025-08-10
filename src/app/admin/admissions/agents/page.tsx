
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Briefcase, PlusCircle } from 'lucide-react';

export default function AgentManagementPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Agent Management</CardTitle>
                    <CardDescription>Manage third-party admissions agents and track their performance.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4"/>Add Agent</Button>
            </CardHeader>
            <CardContent>
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Agent performance and details will be displayed here.</p>
                </div>
            </CardContent>
        </Card>
    );
}
