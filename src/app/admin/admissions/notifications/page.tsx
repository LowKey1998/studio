
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function NotificationsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>SMS/Email Notifications</CardTitle>
                        <CardDescription>Send bulk or individual communications to applicants and leads.</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500">Premium</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Textarea placeholder="Compose your message..." disabled/>
                <Button disabled><Mail className="mr-2 h-4"/>Send Message</Button>
            </CardContent>
        </Card>
    );
}
