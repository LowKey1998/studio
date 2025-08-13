
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users, UserPlus, UserMinus, Info, Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, update, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Club = {
    id: string;
    name: string;
    description: string;
    members?: Record<string, boolean>; // studentId -> true
};

export default function ClubsPage() {
    const [clubs, setClubs] = React.useState<Club[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
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
        const clubsRef = ref(db, 'clubs');
        const unsub = onValue(clubsRef, (snapshot) => {
            const data = snapshot.val() || {};
            setClubs(Object.keys(data).map(id => ({ id, ...data[id] })));
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const handleToggleMembership = async (clubId: string, isMember: boolean) => {
        if (!currentUser) return;
        setActionLoading(clubId);
        try {
            const memberRef = ref(db, `clubs/${clubId}/members/${currentUser.uid}`);
            if(isMember) {
                await set(memberRef, null); // Remove membership
                toast({ title: "You've left the club." });
            } else {
                await set(memberRef, true); // Add membership
                toast({ title: "Welcome to the club!" });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action failed', description: e.message });
        } finally {
            setActionLoading(null);
        }
    };

    const myClubs = React.useMemo(() => {
        if (!currentUser) return [];
        return clubs.filter(club => club.members?.[currentUser.uid]);
    }, [clubs, currentUser]);
    
    if (loading) {
        return (
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                 {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48"/>)}
             </div>
        )
    }

    const renderClubList = (clubList: Club[]) => {
        if (clubList.length === 0) {
            return (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4"/>
                            <AlertTitle>No Clubs Found</AlertTitle>
                            <AlertDescription>There are no clubs to display in this view.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )
        }
        return (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clubList.map(club => {
                    const isMember = currentUser ? !!club.members?.[currentUser.uid] : false;
                    return (
                    <Card key={club.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle>{club.name}</CardTitle>
                            <CardDescription>{club.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="h-4"/>{Object.keys(club.members || {}).length} Members
                            </div>
                        </CardContent>
                        <CardFooter>
                             <Button 
                                className="w-full" 
                                variant={isMember ? 'destructive' : 'default'}
                                onClick={() => handleToggleMembership(club.id, isMember)}
                                disabled={!currentUser || actionLoading === club.id}
                            >
                                {actionLoading === club.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : isMember ? <UserMinus className="mr-2 h-4 w-4"/> : <UserPlus className="mr-2 h-4 w-4"/>}
                                {isMember ? 'Leave Club' : 'Join Club'}
                            </Button>
                        </CardFooter>
                    </Card>
                 )})}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Clubs & Associations</CardTitle>
                    <CardDescription>Explore and join student clubs to get involved on campus.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all">
                        <TabsList>
                            <TabsTrigger value="all">All Clubs</TabsTrigger>
                            <TabsTrigger value="my-clubs">My Clubs</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all" className="pt-6">
                            {renderClubList(clubs)}
                        </TabsContent>
                        <TabsContent value="my-clubs" className="pt-6">
                             {renderClubList(myClubs)}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
