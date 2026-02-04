
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function StaffSelfRegistrationPage() {
    // Form state
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [department, setDepartment] = React.useState('');
    const [bio, setBio] = React.useState('');
    const [dob, setDob] = React.useState('');
    const [gender, setGender] = React.useState('');
    const [nationalId, setNationalId] = React.useState('');
    const [passport, setPassport] = React.useState('');
    const [address, setAddress] = React.useState('');
    const [previousEmployer, setPreviousEmployer] = React.useState('');
    const [qualifications, setQualifications] = React.useState('');

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
                dob,
                gender,
                nationalId,
                passport,
                address,
                bio,
                previousEmployer,
                qualifications,
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
            <div className="max-w-3xl w-full space-y-8">
                <div className="text-center"><Logo /></div>
                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl font-headline text-center">Staff Self-Registration</CardTitle>
                        <CardDescription className="text-center">Please provide your professional and personal details to apply for an account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <Accordion type="multiple" defaultValue={['basic', 'identity', 'background']} className="w-full">
                                <AccordionItem value="basic">
                                    <AccordionTrigger className="text-lg font-semibold">Basic Information</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label htmlFor="name">Full Name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} required /></div>
                                            <div className="space-y-1"><Label htmlFor="email">Email Address</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                                            <div className="space-y-1"><Label htmlFor="phone">Phone Number</Label><Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
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
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="identity">
                                    <AccordionTrigger className="text-lg font-semibold">Identity & Address</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Gender</Label>
                                                <Select onValueChange={setGender} value={gender}>
                                                    <SelectTrigger><SelectValue placeholder="Select gender"/></SelectTrigger>
                                                    <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1"><Label>National ID (NRC)</Label><Input value={nationalId} onChange={e => setNationalId(e.target.value)} /></div>
                                            <div className="space-y-1"><Label>Passport Number (Optional)</Label><Input value={passport} onChange={e => setPassport(e.target.value)} /></div>
                                        </div>
                                        <div className="space-y-1"><Label>Residential Address</Label><Textarea value={address} onChange={e => setAddress(e.target.value)} rows={3}/></div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="background">
                                    <AccordionTrigger className="text-lg font-semibold">Background & Experience</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        <div className="space-y-1"><Label>Previous Employer / School</Label><Input value={previousEmployer} onChange={e => setPreviousEmployer(e.target.value)} /></div>
                                        <div className="space-y-1"><Label>Qualifications</Label><Textarea placeholder="List your key academic and professional qualifications" value={qualifications} onChange={e => setQualifications(e.target.value)} /></div>
                                        <div className="space-y-1"><Label htmlFor="bio">Professional Summary / Bio</Label><Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us briefly about your experience..." rows={4} /></div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                            <Button type="submit" className="w-full mt-8" disabled={submitting}>
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
