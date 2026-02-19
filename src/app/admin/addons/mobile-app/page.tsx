'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Smartphone, Bell, MessageSquare, BookOpen, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createBroadcastNotification } from '@/lib/firebase';

export default function MobileAppPage() {
    const [title, setTitle] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const { toast } = useToast();

    const handleBroadcastPush = async () => {
        if (!title || !message) {
            toast({ variant: 'destructive', title: 'Fields Required', description: 'Please enter both a title and a message.' });
            return;
        }
        
        setSending(true);
        try {
            // Send to the 'broadcast' topic
            const result = await createBroadcastNotification(`${title}: ${message}`, '/student/dashboard');
            
            if (result.success) {
                toast({ variant: 'success', title: 'Broadcast Sent', description: 'The push notification has been sent to all registered devices via the broadcast topic.' });
                setTitle(''); 
                setMessage('');
            } else {
                throw new Error(result.error);
            }
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Broadcast Failed', description: e.message || 'Check connection settings.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Mobile App Push Notifications</CardTitle>
                    <CardDescription>Broadcast important updates directly to students' and staff members' mobile devices using the global broadcast topic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label>Notification Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Campus Closed Due to Weather"/>
                    </div>
                    <div className="space-y-1">
                        <Label>Message Body</Label>
                        <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Enter details here..." rows={5}/>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleBroadcastPush} disabled={sending} className="w-full sm:w-auto">
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Broadcast to All Devices
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
