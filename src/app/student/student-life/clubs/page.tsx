
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users, UserPlus, UserMinus, Info, Loader2, ArrowRight } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';

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
                             <Button className="w-full" asChild>
                                <Link href={`/student/student-life/clubs/${club.id}`}>
                                    View Club <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
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
