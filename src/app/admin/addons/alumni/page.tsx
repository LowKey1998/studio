'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users2, PartyPopper, Handshake } from 'lucide-react';

export default function AlumniPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl">EduConnect360-Alumni</CardTitle>
                <CardDescription>Engage and manage your alumni network with a dedicated portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                    <h3 className="text-xl font-semibold mb-2">Coming Soon!</h3>
                    <p className="text-muted-foreground">This powerful add-on will unlock a new suite of tools to connect with your graduates.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Users2 className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Alumni Directory</h4>
                        <p className="text-sm text-muted-foreground">A searchable directory of all past students, allowing them to connect with each other and the institution.</p>
                    </div>
                     <div className="space-y-2">
                        <PartyPopper className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Event Management</h4>
                        <p className="text-sm text-muted-foreground">Organize reunions, networking events, and workshops specifically for your alumni community.</p>
                    </div>
                     <div className="space-y-2">
                        <Handshake className="h-8 w-8 text-primary" />
                        <h4 className="font-semibold">Fundraising & Donations</h4>
                        <p className="text-sm text-muted-foreground">Run fundraising campaigns and accept donations directly from your alumni to support new initiatives.</p>
                    </div>
                </div>
                <div className="text-center pt-6">
                    <Button disabled>Activate Alumni Module</Button>
                </div>
            </CardContent>
        </Card>
    );
}
