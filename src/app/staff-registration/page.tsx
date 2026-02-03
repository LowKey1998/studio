
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, push, set, get } from 'firebase/database';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import Logo from '@/components/logo';

export default function StaffSelfRegistrationPage() {
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [bio, setBio] = React.useState('');
    const [departments, setDepartments] = React.useState<{id: string, name: string}[]>([]);
    
    const [submitting, setSubmitting] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        get(ref(db, 'settings/departments')).then(snap => {
            if(snap.exists()) setDepartments(Object.keys(snap.val()).map(id => ({id, ...snap.val()[id]})));
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !department) {
            toast({ variant: 'destructive', title: 'Please fill in all required fields.' });
            return;
        }
        setSubmitting(true);
        try {
            await push(ref(db, 'staffApplications'), {
                name,
                email,
                phone,
                department,
                bio,
                status: 'Pending',
                appliedAt: new Date().toISOString()
            });
            setSubmitted(true);
            toast({ variant: 'success', title: 'Application Submitted!', description: 'HR will review your details and contact you shortly.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4 bg-muted/40">
                <Card className="max-w-md w-full text-center">
                    <CardHeader>
                        <div className="flex justify-center mb-4"><CheckCircle2 className="h-16 w-16 text-green-500" /></div>
                        <CardTitle className="text-2xl">Application Received</CardTitle>
                        <CardDescription>
                            Thank you for submitting your details. The HR department will review your application and send your login credentials once approved.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button className="w-full" variant="outline" onClick={() => window.location.href = '/landing'}>Return to Homepage</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-muted/40">
            <div className="max-w-xl w-full space-y-8">
                <div className="text-center"><Logo /></div>
                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline">Staff Self-Registration</CardTitle>
                        <CardDescription>Enter your professional details to apply for a staff portal account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="dept">Target Department</Label>
                                    <Select value={department} onValueChange={setDepartment} required>
                                        <SelectTrigger id="dept"><SelectValue placeholder="Select department" /></SelectTrigger>
                                        <SelectContent>
                                            {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bio">Professional Summary / Bio</Label>
                                <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about your role and experience..." rows={5} />
                            </div>
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Submit Application
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
