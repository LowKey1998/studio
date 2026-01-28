
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users, UserPlus, UserMinus, Info, Loader2, Calendar, Megaphone, MessageSquare, ChevronLeft } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useParams, useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

type Club = {
    id: string;
    name: string;
    description: string;
    members?: Record<string, boolean>;
};

export default function ClubDetailPage() {
    const params = useParams();
    const router = useRouter();
    const clubId = params.clubId as string;
    const [club, setClub] = React.useState<Club | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [actionLoading, setActionLoading] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!clubId) return;
        const clubRef = ref(db, `clubs/${clubId}`);
        const unsub = onValue(clubRef, (snapshot) => {
            if (snapshot.exists()) {
                setClub({ id: snapshot.key, ...snapshot.val() });
            } else {
                toast({ variant: 'destructive', title: 'Club not found.' });
                router.push('/student/student-life/clubs');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [clubId, router, toast]);

    const handleToggleMembership = async (isMember: boolean) => {
        if (!currentUser || !club) return;
        setActionLoading(true);
        try {
            const memberRef = ref(db, `clubs/${club.id}/members/${currentUser.uid}`);
            if (isMember) {
                await set(memberRef, null);
                toast({ title: "You've left the club." });
            } else {
                await set(memberRef, true);
                toast({ title: "Welcome to the club!" });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action failed', description: e.message });
        } finally {
            setActionLoading(false);
        }
    };
    
    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!club) {
        return null;
    }

    const isMember = currentUser ? !!club.members?.[currentUser.uid] : false;
    const memberCount = Object.keys(club.members || {}).length;

    return (
        <div className="space-y-6">
            <Button variant="outline" asChild>
                <Link href="/student/student-life/clubs"><ChevronLeft className="mr-2 h-4 w-4" /> Back to All Clubs</Link>
            </Button>
            
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl md:text-3xl">{club.name}</CardTitle>
                    <CardDescription>{club.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Users className="h-4 w-4"/> {memberCount} Member(s)</div>
                </CardContent>
                 <CardFooter>
                    <Button 
                        className="w-full md:w-auto" 
                        variant={isMember ? 'destructive' : 'default'}
                        onClick={() => handleToggleMembership(isMember)}
                        disabled={!currentUser || actionLoading}
                    >
                        {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : isMember ? <UserMinus className="mr-2 h-4 w-4"/> : <UserPlus className="mr-2 h-4 w-4"/>}
                        {isMember ? 'Leave Club' : 'Join Club'}
                    </Button>
                </CardFooter>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Megaphone className="h-6 w-6 text-primary" />
                        <CardTitle className="text-lg">Announcements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No announcements yet.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Calendar className="h-6 w-6 text-primary" />
                        <CardTitle className="text-lg">Upcoming Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No upcoming events scheduled.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        <CardTitle className="text-lg">Discussions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No discussions started.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
