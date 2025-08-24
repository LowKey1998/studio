
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Mail, MessageSquare, Send, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { sendSms } from '@/ai/flows/send-sms-flow';

type User = {
    uid: string;
    name: string;
    email: string;
    phoneNumber?: string;
};

export default function NotificationsPage() {
    const [loading, setLoading] = React.useState(true);
    const [sending, setSending] = React.useState(false);
    const [allUsers, setAllUsers] = React.useState<User[]>([]);
    
    // Form State
    const [activeTab, setActiveTab] = React.useState('email');
    const [recipientType, setRecipientType] = React.useState('all');
    const [singleRecipient, setSingleRecipient] = React.useState('');
    const [subject, setSubject] = React.useState('');
    const [body, setBody] = React.useState('');
    
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchUsers = async () => {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                setAllUsers(Object.keys(data).map(uid => ({ uid, ...data[uid] })));
            }
            setLoading(false);
        };
        fetchUsers();
    }, []);
    
    const resetForm = () => {
        setRecipientType('all');
        setSingleRecipient('');
        setSubject('');
        setBody('');
    };

    const handleSend = async () => {
        setSending(true);
        try {
            let recipients: string[] = [];
            if (recipientType === 'all') {
                recipients = activeTab === 'email' 
                    ? allUsers.map(u => u.email).filter(Boolean)
                    : allUsers.map(u => u.phoneNumber).filter(Boolean) as string[];
            } else {
                const user = allUsers.find(u => u.uid === singleRecipient);
                if (user) {
                     recipients = [activeTab === 'email' ? user.email : user.phoneNumber || ''].filter(Boolean);
                }
            }

            if (recipients.length === 0) {
                toast({ variant: 'destructive', title: 'No recipients found.'});
                return;
            }

            if (activeTab === 'email') {
                const result = await sendEmail({ to: recipients, subject, body });
                toast({ title: 'Email Sent', description: result.result });
            } else {
                const result = await sendSms({ to: recipients, body });
                toast({ title: 'SMS Sent', description: result.result });
            }
            
            resetForm();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send', description: error.message });
        } finally {
            setSending(false);
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>SMS/Email Notifications</CardTitle>
                <CardDescription>Send bulk or individual communications to applicants and leads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="email"><Mail className="mr-2 h-4"/>Email</TabsTrigger>
                        <TabsTrigger value="sms"><MessageSquare className="mr-2 h-4"/>SMS</TabsTrigger>
                    </TabsList>
                    <div className="pt-4 space-y-4">
                        <div className="space-y-1">
                            <Label>Recipients</Label>
                             <Select value={recipientType} onValueChange={setRecipientType}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users (Students & Staff)</SelectItem>
                                    <SelectItem value="single">Single User</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {recipientType === 'single' && (
                             <div className="space-y-1">
                                <Label>Select User</Label>
                                <Select value={singleRecipient} onValueChange={setSingleRecipient}>
                                    <SelectTrigger><SelectValue placeholder="Select a user..."/></SelectTrigger>
                                    <SelectContent>
                                        {allUsers.map(u => <SelectItem key={u.uid} value={u.uid}>{u.name} ({activeTab === 'email' ? u.email : u.phoneNumber})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {activeTab === 'email' && (
                             <div className="space-y-1">
                                <Label htmlFor="subject">Subject</Label>
                                <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} />
                            </div>
                        )}

                         <div className="space-y-1">
                            <Label htmlFor="body">Message Body</Label>
                            <Textarea id="body" value={body} onChange={e => setBody(e.target.value)} rows={10} />
                        </div>
                    </div>
                </Tabs>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleSend} disabled={sending || loading}>
                    {sending ? <Loader2 className="mr-2 animate-spin"/> : <Send className="mr-2 h-4"/>}
                    Send Message
                </Button>
            </CardFooter>
        </Card>
    );
}
