'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { sendEmail } from '@/ai/flows/send-email-flow';
import { sendSms } from '@/ai/flows/send-sms-flow';
import { Loader2, Send } from 'lucide-react';

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); 
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '260' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    cleaned = '260' + cleaned;
  }
  return cleaned;
};

export default function EmergencyAlertsPage() {
    const [subject, setSubject] = React.useState('URGENT: Campus Alert');
    const [message, setMessage] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const { toast } = useToast();

    const handleSendAlert = async () => {
        if (!message.trim()) {
            toast({ variant: 'destructive', title: 'Message is empty.' });
            return;
        }
        if (!window.confirm("Are you sure you want to send this emergency alert to ALL parents/guardians?")) {
            return;
        }

        setSending(true);
        try {
            const usersSnap = await get(ref(db, 'users'));
            if (!usersSnap.exists()) {
                toast({ variant: 'destructive', title: 'No users found.'});
                return;
            }

            const users = usersSnap.val();
            const parentEmails: string[] = [];
            const parentPhones: string[] = [];
            const parentUserIds: string[] = [];

            for (const uid in users) {
                const user = users[uid];
                if (user.role === 'Student' && user.guardian?.contact) {
                    const contact = user.guardian.contact;
                    if (contact.includes('@')) {
                        parentEmails.push(contact);
                    } else {
                        // Normalize phone number for international SMS (E.164)
                        const cleaned = normalizePhone(contact);
                        if (cleaned.length >= 9) {
                            parentPhones.push('+' + cleaned);
                        }
                    }
                    parentUserIds.push(uid); // Log against the student's ID
                }
            }

            let emailResult = 'No emails to send.';
            let smsResult = 'No phone numbers to send to.';
            
            if (parentEmails.length > 0) {
                const res = await sendEmail({ to: parentEmails, subject, body: message, log: true, userIds: parentUserIds });
                emailResult = res.result;
            }
            if (parentPhones.length > 0) {
                 const res = await sendSms({ to: parentPhones, body: message, log: true, userIds: parentUserIds });
                 smsResult = res.result;
            }
            
            toast({ title: "Alerts Sent", description: `Email: ${emailResult} | SMS: ${smsResult}` });
            setMessage('');
            
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send Alert', description: error.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Emergency Alert System</CardTitle>
                <CardDescription>Broadcast an urgent message to all parents/guardians via SMS and Email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-1">
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" value={message} onChange={e => setMessage(e.target.value)} rows={8} />
                </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSendAlert} disabled={sending} variant="destructive">
                    {sending ? <Loader2 className="mr-2 animate-spin"/> : <Send className="mr-2 h-4"/>}
                    Broadcast Alert to All Parents
                </Button>
            </CardFooter>
        </Card>
    );
}