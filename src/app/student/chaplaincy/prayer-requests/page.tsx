
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, push, serverTimestamp, query, orderByChild, equalTo, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { Check, Heart, PlusCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';


type PrayerRequest = {
    id: string;
    requestFor: string;
    isAnonymous: boolean;
    details: string;
    submittedAt: number;
    prayedFor?: boolean;
    studentId?: string;
    studentName?: string;
};

export default function StudentPrayerRequestsPage() {
    const [myRequests, setMyRequests] = React.useState<PrayerRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formLoading, setFormLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<{name: string} | null>(null);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [requestFor, setRequestFor] = React.useState('');
    const [details, setDetails] = React.useState('');
    const [isAnonymous, setIsAnonymous] = React.useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                const userSnap = await get(userRef);
                if (userSnap.exists()) setUserData(userSnap.val());

                const requestsQuery = query(ref(db, 'prayerRequests'), orderByChild('studentId'), equalTo(user.uid));
                onValue(requestsQuery, (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        setMyRequests(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.submittedAt - a.submittedAt));
                    } else {
                        setMyRequests([]);
                    }
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setRequestFor('');
        setDetails('');
        setIsAnonymous(false);
    };

    const handleSumbitRequest = async () => {
        if (!requestFor.trim() || !details.trim()) {
            toast({ variant: 'destructive', title: 'Please fill out all fields.' });
            return;
        }

        if (!isAnonymous && (!currentUser || !userData)) {
            toast({ variant: 'destructive', title: 'You must be logged in to submit a non-anonymous request.' });
            return;
        }

        setFormLoading(true);
        try {
            const newRequestRef = push(ref(db, 'prayerRequests'));
            await set(newRequestRef, {
                requestFor,
                details,
                isAnonymous,
                studentId: isAnonymous ? null : currentUser!.uid,
                studentName: isAnonymous ? 'Anonymous' : userData!.name,
                submittedAt: serverTimestamp(),
                prayedFor: false
            });
            toast({ title: 'Prayer Request Submitted', description: 'Your request has been sent confidentially.' });
            resetForm();
            setIsDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: e.message });
        } finally {
            setFormLoading(false);
        }
    };


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Heart/> My Prayer Requests</CardTitle>
                    <CardDescription>A confidential space to submit and view your prayer requests.</CardDescription>
                </div>
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4"/>New Request</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Submit a Prayer Request</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1">
                                <Label htmlFor="for">I am requesting prayer for...</Label>
                                <Input id="for" value={requestFor} onChange={e => setRequestFor(e.target.value)} placeholder="e.g., Myself, A Family Member, A Situation" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="details">Details</Label>
                                <Textarea id="details" value={details} onChange={e => setDetails(e.target.value)} placeholder="Share as much or as little as you're comfortable with." rows={5}/>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={c => setIsAnonymous(!!c)} />
                                <Label htmlFor="anonymous">Submit Anonymously</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" onClick={resetForm}>Cancel</Button></DialogClose>
                            <Button onClick={handleSumbitRequest} disabled={formLoading}>{formLoading && <Loader2 className="mr-2"/>}Submit Request</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                        Array.from({length: 2}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
                    ) : myRequests.length > 0 ? (
                        myRequests.map(req => (
                            <Card key={req.id}>
                                <CardHeader className="flex flex-row justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">Request for {req.requestFor}</CardTitle>
                                        <CardDescription>{formatDistanceToNow(new Date(req.submittedAt), { addSuffix: true })}</CardDescription>
                                    </div>
                                    {req.prayedFor ? (
                                        <Badge variant="default"><Check className="mr-1 h-4 w-4"/> Prayed For</Badge>
                                    ) : (
                                        <Badge variant="secondary">Pending</Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="whitespace-pre-wrap">{req.details}</p>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-16">You have not submitted any prayer requests yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
