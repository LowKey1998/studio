
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NotificationsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>SMS/Email Notifications</CardTitle>
                        <CardDescription>Send bulk or individual communications to applicants and leads.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Tabs defaultValue="email">
                    <TabsList>
                        <TabsTrigger value="email"><Mail className="mr-2 h-4"/>Email</TabsTrigger>
                        <TabsTrigger value="sms"><MessageSquare className="mr-2 h-4"/>SMS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="email" className="pt-4">
                        <Textarea placeholder="Compose your email..." rows={10}/>
                        <Button className="mt-2"><Send className="mr-2 h-4"/>Send Email</Button>
                    </TabsContent>
                     <TabsContent value="sms" className="pt-4">
                        <Textarea placeholder="Compose your SMS..." rows={5}/>
                        <Button className="mt-2"><Send className="mr-2 h-4"/>Send SMS</Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
