'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Smartphone, Bell, MessageSquare, BookOpen, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendBroadcastNotification } from '@/app/actions/notifications';

export default function MobileAppPage() {
    const [title, setTitle] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const { toast } = useToast();

    const handleBroadcastPush = async () => {
        if (!title.trim() || !message.trim()) {
            toast({ variant: 'destructive', title: 'Fields Required', description: 'Please enter both a title and a message.' });
            return;
        }
        
        setSending(true);
        try {
            // Directly call the server action to ensure correct proxying and promise resolution
            const result = await sendBroadcastNotification(`${title}: ${message}`, '/student/dashboard');
            
            if (result.success) {
                toast({ 
                    variant: 'success', 
                    title: 'Broadcast Sent', 
                    description: 'The push notification has been sent to all registered devices via the broadcast topic.' 
                });
                setTitle(''); 
                setMessage('');
            } else {
                throw new Error(result.error || 'Server rejected the broadcast request.');
            }
        } catch (e: any) {
            console.error('Broadcast Error:', e);
            toast({ 
                variant: 'destructive', 
                title: 'Broadcast Failed', 
                description: e.message || 'Check your internet connection and try again.' 
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-primary/10">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                        <Smartphone className="h-6 w-6 text-primary" />
                        Mobile App Push Notifications
                    </CardTitle>
                    <CardDescription>Broadcast important updates directly to students' and staff members' mobile devices using the global broadcast topic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <div className="space-y-1">
                        <Label htmlFor="notif-title">Notification Title</Label>
                        <Input 
                            id="notif-title"
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            placeholder="e.g., Campus Closed Due to Weather"
                            disabled={sending}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="notif-body">Message Body</Label>
                        <Textarea 
                            id="notif-body"
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            placeholder="Enter the detailed message here..." 
                            rows={5}
                            disabled={sending}
                        />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t p-6">
                    <Button 
                        onClick={handleBroadcastPush} 
                        disabled={sending} 
                        className="w-full sm:w-auto font-bold shadow-md"
                    >
                        {sending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Processing Broadcast...</>
                        ) : (
                            <><Send className="mr-2 h-4 w-4"/> Broadcast to All Devices</>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}