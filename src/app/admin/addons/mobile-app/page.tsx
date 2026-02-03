
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Smartphone, Bell, MessageSquare, BookOpen, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { createNotification } from '@/lib/firebase';

export default function MobileAppPage() {
    const [title, setTitle] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const { toast } = useToast();

    const handleBroadcastPush = async () => {
        if (!title || !message) return;
        setSending(true);
        try {
            const usersSnap = await get(ref(db, 'users'));
            if(usersSnap.exists()) {
                const uids = Object.keys(usersSnap.val());
                const promises = uids.map(uid => createNotification(uid, `${title}: ${message}`, '/student/dashboard', 'info'));
                await Promise.all(promises);
                toast({ title: 'Push Notification Broadcasted' });
                setTitle(''); setMessage('');
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'Broadcast Failed' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Mobile App Push Notifications</CardTitle>
                    <CardDescription>Broadcast important updates directly to students' and staff members' mobile devices.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label>Notification Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Campus Closed Due to Weather"/>
                    </div>
                    <div className="space-y-1">
                        <Label>Message Body</Label>
                        <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Enter details here..."/>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleBroadcastPush} disabled={sending}>
                        {sending ? <Loader2 className="mr-2 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                        Broadcast Push Notification
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
