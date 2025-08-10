'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Briefcase, Clock, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, storage } from '@/lib/firebase';
import { ref, get, set, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useParams, useRouter } from 'next/navigation';
import Logo from '@/components/logo';

type Vacancy = {
    id: string;
    title: string;
    description: string;
    department: string;
    type: 'Full-time' | 'Part-time' | 'Contract';
    datePosted: string;
};

export default function VacancyApplicationPage() {
    const params = useParams();
    const router = useRouter();
    const vacancyId = params.vacancyId as string;
    const [vacancy, setVacancy] = React.useState<Vacancy | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);

    // Form state
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [resume, setResume] = React.useState<File | null>(null);
    
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchVacancy = async () => {
            if (!vacancyId) return;
            setLoading(true);
            try {
                const snapshot = await get(ref(db, `vacancies/${vacancyId}`));
                if (snapshot.exists()) {
                    setVacancy(snapshot.val());
                } else {
                    toast({ variant: 'destructive', title: 'Vacancy not found.' });
                }
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Failed to load vacancy details.' });
            } finally {
                setLoading(false);
            }
        };
        fetchVacancy();
    }, [vacancyId, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email || !phone || !resume) {
            toast({ variant: 'destructive', title: "All fields are required" });
            return;
        }
        setSubmitting(true);
        try {
            // Upload resume to storage
            const resumeStorageRef = storageRef(storage, `resumes/${vacancyId}/${Date.now()}_${resume.name}`);
            const snapshot = await uploadBytes(resumeStorageRef, resume);
            const resumeUrl = await getDownloadURL(snapshot.ref);

            // Save application to database
            const applicantsRef = ref(db, `vacancies/${vacancyId}/applicants`);
            const newApplicantRef = push(applicantsRef);
            await set(newApplicantRef, {
                id: newApplicantRef.key,
                name,
                email,
                phone,
                resumeUrl,
                dateApplied: new Date().toISOString(),
                status: 'Received',
            });
            
            toast({ variant: 'success', title: "Application Submitted!", description: "Thank you for your interest. We will be in touch." });
            router.push('/vacancies');

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Submission Failed", description: "An error occurred. Please try again." });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-muted/40">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center">
                    <Logo />
                </div>
            </header>
            <main className="container py-12">
                {loading ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <Skeleton className="h-12 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-96 w-full" />
                    </div>
                ) : vacancy ? (
                     <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <div className="md:col-span-2 space-y-6">
                            <div className="space-y-2">
                                <h1 className="font-headline text-3xl md:text-4xl font-bold">{vacancy.title}</h1>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-muted-foreground">
                                    <div className="flex items-center gap-2"><Briefcase className="h-4 w-4"/> {vacancy.department}</div>
                                    <div className="flex items-center gap-2"><Clock className="h-4 w-4"/> {vacancy.type}</div>
                                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4"/> Lusaka, Zambia</div>
                                </div>
                            </div>
                            <Card>
                                <CardHeader><CardTitle>Job Description</CardTitle></CardHeader>
                                <CardContent><p className="whitespace-pre-wrap">{vacancy.description}</p></CardContent>
                            </Card>
                        </div>
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle>Apply Now</CardTitle><CardDescription>Fill out the form to submit your application.</CardDescription></CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div className="space-y-1"><Label htmlFor="name">Full Name</Label><Input id="name" value={name} onChange={e=>setName(e.target.value)} required/></div>
                                        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
                                        <div className="space-y-1"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required/></div>
                                        <div className="space-y-1"><Label htmlFor="resume">Resume (PDF)</Label><Input id="resume" type="file" accept=".pdf" onChange={e => setResume(e.target.files?.[0] || null)} required/></div>
                                        <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 animate-spin"/> : "Submit Application"}</Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <p>Vacancy not found.</p>
                )}
            </main>
        </div>
    );
}
