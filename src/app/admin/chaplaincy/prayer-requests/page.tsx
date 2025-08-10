
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, onValue, update } from 'firebase/database';
import { formatDistanceToNow } from 'date-fns';
import { Check, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type PrayerRequest = {
    id: string;
    requestFor: string;
    isAnonymous: boolean;
    details: string;
    submittedAt: number;
    prayedFor?: boolean;
    studentName?: string; // Added to show who submitted it
};

export default function PrayerRequestsPage() {
    const [requests, setRequests] = React.useState<PrayerRequest[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const requestsRef = ref(db, 'prayerRequests');
        const unsubscribe = onValue(requestsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setRequests(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.submittedAt - a.submittedAt));
            } else {
                setRequests([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleMarkPrayedFor = (id: string) => {
        update(ref(db, `prayerRequests/${id}`), { prayedFor: true });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Heart/> Prayer Requests</CardTitle>
                <CardDescription>A feed of prayer requests from the community.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                        Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
                    ) : requests.length > 0 ? (
                        requests.map(req => (
                            <Card key={req.id}>
                                <CardHeader className="flex flex-row justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">Request for {req.requestFor}</CardTitle>
                                        <CardDescription>
                                            Submitted by: {req.isAnonymous ? 'Anonymous' : req.studentName || 'Unknown Student'}
                                            <span className="mx-2">&middot;</span>
                                            {formatDistanceToNow(new Date(req.submittedAt), { addSuffix: true })}
                                        </CardDescription>
                                    </div>
                                    {req.prayedFor ? (
                                        <Badge variant="default"><Check className="mr-1 h-4 w-4"/> Prayed For</Badge>
                                    ) : (
                                        <Button size="sm" onClick={() => handleMarkPrayedFor(req.id)}>Mark as Prayed For</Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <p className="whitespace-pre-wrap">{req.details}</p>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-16">No prayer requests have been submitted yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
