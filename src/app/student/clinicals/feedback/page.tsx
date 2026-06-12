'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ClipboardList, Star, Send, Loader2, Info, BookOpen, Clock, CheckCircle } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, get, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

type FeedbackFormTemplate = {
    id: string;
    title: string;
    description: string;
};

type FeedbackSubmission = {
    id: string;
    formId: string;
    formTitle: string;
    studentId: string;
    studentName: string;
    location: string;
    rating: number;
    feedbackText: string;
    timestamp: number;
};

export default function StudentFeedbackFormsPage() {
    const [templates, setTemplates] = React.useState<FeedbackFormTemplate[]>([]);
    const [submissions, setSubmissions] = React.useState<FeedbackSubmission[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<any>(null);

    // Submission Form State
    const [selectedTemplate, setSelectedTemplate] = React.useState<FeedbackFormTemplate | null>(null);
    const [location, setLocation] = React.useState('');
    const [rating, setRating] = React.useState<number>(5);
    const [feedbackText, setFeedbackText] = React.useState('');

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
                get(ref(db, `users/${user.uid}`)).then(snap => {
                    if (snap.exists()) setUserProfile(snap.val());
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        
        const templatesRef = ref(db, 'clinicals/feedbackForms');
        const submissionsRef = ref(db, 'clinicals/feedbackSubmissions');

        const unsubTemplates = onValue(templatesRef, (snap) => {
            setTemplates(snap.exists() ? Object.entries(snap.val()).map(([id, d]: [string, any]) => ({ id, ...d })) : []);
        });

        const unsubSubmissions = onValue(submissionsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(s => s.studentId === currentUser.uid);
                setSubmissions(list.sort((a,b) => b.timestamp - a.timestamp));
            } else {
                setSubmissions([]);
            }
            setLoading(false);
        });

        return () => { unsubTemplates(); unsubSubmissions(); };
    }, [currentUser]);

    const handleSubmitFeedback = async () => {
        if (!selectedTemplate || !location || !feedbackText || !currentUser || !userProfile) {
            toast({ variant: 'destructive', title: 'Please complete all required fields.' });
            return;
        }
        setSubmitting(true);
        try {
            const newSubRef = push(ref(db, 'clinicals/feedbackSubmissions'));
            await set(newSubRef, {
                formId: selectedTemplate.id,
                formTitle: selectedTemplate.title,
                studentId: currentUser.uid,
                studentName: userProfile.name || currentUser.displayName || 'Student',
                studentEmail: currentUser.email,
                location: location.trim(),
                rating: Number(rating),
                feedbackText: feedbackText.trim(),
                timestamp: serverTimestamp()
            });
            toast({ title: 'Feedback Submitted', description: 'Thank you for providing your feedback.' });
            setSelectedTemplate(null);
            setLocation(''); setRating(5); setFeedbackText('');
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Submission failed', description: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md">
                            <ClipboardList className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Clinical Feedback Portal</CardTitle>
                            <CardDescription>Submit performance reflections, preceptor surveys, and hospital training environment reviews.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                        <BookOpen className="h-5 w-5 text-primary" /> Evaluation Form Templates
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {templates.map(temp => (
                            <Card key={temp.id} className="flex flex-col justify-between hover:shadow-md transition-shadow duration-300">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold leading-snug">{temp.title}</CardTitle>
                                    <CardDescription className="text-xs line-clamp-2 leading-relaxed">
                                        {temp.description || 'Provide feedback for your recent ward rotation setting.'}
                                    </CardDescription>
                                </CardHeader>
                                <CardFooter className="pt-2">
                                    <Button size="sm" onClick={() => setSelectedTemplate(temp)} className="w-full">
                                        Fill Out Form
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                        {templates.length === 0 && (
                            <div className="col-span-full py-10 text-center border-2 border-dashed rounded-xl bg-muted/5">
                                <Info className="mx-auto h-10 w-10 opacity-20 mb-2" />
                                <p className="text-xs text-muted-foreground">No clinical evaluation feedback templates have been set up by admin.</p>
                            </div>
                        )}
                    </div>

                    {submissions.length > 0 && (
                        <div className="space-y-4 pt-6">
                            <h3 className="text-lg font-bold flex items-center gap-2 px-1 opacity-60">
                                <Clock className="h-5 w-5" /> Your Submissions History
                            </h3>
                            <div className="space-y-4">
                                {submissions.map(sub => (
                                    <Card key={sub.id} className="shadow-sm">
                                        <CardHeader className="py-3 border-b bg-muted/15">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-sm text-foreground">{sub.formTitle}</span>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        Hospital / Location: <strong className="text-foreground">{sub.location}</strong>
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <div className="flex items-center text-amber-500 gap-0.5 mr-2">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <Star key={i} className={`h-3.5 w-3.5 ${i < sub.rating ? 'fill-amber-500' : 'opacity-20'}`} />
                                                        ))}
                                                    </div>
                                                    <Badge variant="outline" className="h-5 text-[8px] bg-background">
                                                        Submitted {format(sub.timestamp ? new Date(sub.timestamp) : new Date(), 'dd MMM yyyy')}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-3">
                                            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">"{sub.feedbackText}"</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="md:col-span-1">
                    <Card className="sticky top-6 border border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold flex items-center gap-1">
                                <Info className="h-5 w-5 text-primary" /> Guidelines
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-4 leading-relaxed text-foreground/80">
                            <p>
                                standard administrative procedures require students to submit post-rotation feedback within **48 hours** of concluding a ward placement.
                            </p>
                            <div className="space-y-2">
                                <p className="font-bold">Acknowledge Benchmarks:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>Provide objective assessment of learning conditions.</li>
                                    <li>Flag any preceptor attendance or safety irregularities.</li>
                                    <li>Reflect on critical skills practiced.</li>
                                </ul>
                            </div>
                            <p className="text-muted-foreground italic bg-background/50 p-2.5 rounded-lg border">
                                Feedback reports are reviewed by Quality Assurance coordinators to optimize hospital partnerships.
                              </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Submission dialog */}
            <Dialog open={!!selectedTemplate} onOpenChange={open => !open && setSelectedTemplate(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Submit: {selectedTemplate?.title}</DialogTitle>
                        <DialogDescription>
                            {selectedTemplate?.description}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Hospital / Clinic Site</Label>
                                <Input placeholder="e.g., General Hospital Ward A" value={location} onChange={e => setLocation(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label>Training Environment Rating</Label>
                                <div className="flex items-center gap-1.5 h-10">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <button 
                                            key={i} 
                                            type="button" 
                                            onClick={() => setRating(i + 1)}
                                            className="text-amber-500 hover:scale-110 transition-transform"
                                        >
                                            <Star className={`h-6 w-6 ${i < rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground opacity-40'}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Evaluative Feedback & Reflections</Label>
                            <Textarea 
                                placeholder="State primary case exposures, quality of hands-on mentoring, and resource facilities..." 
                                className="min-h-[150px] text-xs" 
                                value={feedbackText} 
                                onChange={e => setFeedbackText(e.target.value)} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button onClick={handleSubmitFeedback} disabled={submitting || !location || !feedbackText}>
                            {submitting ? <Loader2 className="animate-spin mr-1.5 h-4 w-4" /> : <Send className="mr-1.5 h-4 w-4" />}
                            Submit Evaluation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
