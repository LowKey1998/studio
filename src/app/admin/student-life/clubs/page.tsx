
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Users } from 'lucide-react';

export default function ClubsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Clubs & Associations</CardTitle>
                    <CardDescription>Manage student clubs, memberships, and activities.</CardDescription>
                </div>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Club</Button>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">No clubs created yet.</p>
            </CardContent>
        </Card>
    );
}
