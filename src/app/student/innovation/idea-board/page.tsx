'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageSquare } from "lucide-react";
import { Textarea } from '@/components/ui/textarea';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, push, set, serverTimestamp } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

type Idea = {
    id: string;
    authorId: string;
    authorName: string;
    idea: string;
    timestamp: number;
};

export default function IdeaBoardPage() {
    const [ideas, setIdeas] = React.useState<Idea[]>([]);
    const [newIdea, setNewIdea] = React.useState('');
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userData, setUserData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [posting, setPosting] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = ref(db, `users/${user.uid}`);
                onValue(userRef, (snapshot) => setUserData(snapshot.val()));
            } else {
                setLoading(false);
            }
        });
        
        const ideasRef = ref(db, 'ideas');
        const unsubscribeIdeas = onValue(ideasRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setIdeas(Object.keys(data).map(id => ({ id, ...data[id] })).sort((a,b) => b.timestamp - a.timestamp));
            }
            setLoading(false);
        });

        return () => {
            unsubscribeAuth();
            unsubscribeIdeas();
        };
    }, []);

    const handlePostIdea = async () => {
        if (!newIdea.trim() || !currentUser || !userData) return;
        setPosting(true);
        try {
            const newIdeaRef = push(ref(db, 'ideas'));
            await set(newIdeaRef, {
                authorId: currentUser.uid,
                authorName: userData.name,
                idea: newIdea,
                timestamp: serverTimestamp()
            });
            toast({ title: "Idea Posted!" });
            setNewIdea('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Startup Idea Board</CardTitle>
                    <CardDescription>A space for students and staff to post, view, and discuss new ideas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Textarea placeholder="Share a new idea..." value={newIdea} onChange={e => setNewIdea(e.target.value)} />
                        <Button onClick={handlePostIdea} disabled={posting}>
                            {posting ? <PlusCircle className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}Post Idea
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                {loading ? Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-48"/>) 
                : ideas.map(idea => (
                    <Card key={idea.id}>
                        <CardHeader>
                            <CardDescription>Posted by {idea.authorName} &middot; {formatDistanceToNow(new Date(idea.timestamp), { addSuffix: true })}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p>{idea.idea}</p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline"><MessageSquare className="mr-2 h-4 w-4"/>Discuss</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
