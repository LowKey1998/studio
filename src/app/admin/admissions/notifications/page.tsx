
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

export default function NotificationsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>SMS/Email Notifications</CardTitle>
                <CardDescription>Send bulk or individual communications to applicants and leads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea placeholder="Compose your message..."/>
                <Button><Mail className="mr-2 h-4"/>Send Message</Button>
            </CardContent>
        </Card>
    );
}
