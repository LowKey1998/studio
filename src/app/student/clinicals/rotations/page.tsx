'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { db, auth } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Clock, Stethoscope, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type Rotation = {
    id: string;
    studentId: string;
    ward: string;
    date: string;
};

export default function StudentRotationsPage() {
    const [rotations, setRotations] = React.useState<Rotation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        const rotationsRef = ref(db, 'clinicalRotations');
        const unsub = onValue(rotationsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(r => r.studentId === currentUser.uid);
                setRotations(list.sort((a,b) => a.date.localeCompare(b.date)));
            } else {
                setRotations([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-32 w-full"/></div>;

    const upcoming = rotations.filter(r => isAfter(parseISO(r.date), new Date()) || isSameDay(parseISO(r.date), new Date()));
    const history = rotations.filter(r => isBefore(parseISO(r.date), new Date()) && !isSameDay(parseISO(r.date), new Date()));

    const isSameDay = (d1: Date, d2: Date) => format(d1, 'yyyy-MM-dd') === format(d2, 'yyyy-MM-dd');

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md">
                            <Stethoscope className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Ward Rotations</CardTitle>
                            <CardDescription>Your official schedule for clinical practice and ward placements.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1"><Clock className="h-5 w-5 text-primary"/> Upcoming Rotations</h3>
                {upcoming.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {upcoming.map(r => (
                            <Card key={r.id} className={cn("border-l-4 border-l-primary shadow-sm", isSameDay(parseISO(r.date), new Date()) && "ring-2 ring-primary bg-primary/5")}>
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-xl font-black">{r.ward}</CardTitle>
                                        {isSameDay(parseISO(r.date), new Date()) && <Badge className="animate-pulse bg-red-600">Active Today</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Calendar className="h-4 w-4 text-primary" />
                                        {format(parseISO(r.date), 'PPPP')}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        Institutional Campus / Partner Hospital
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Alert className="border-dashed">
                        <Info className="h-4 w-4" />
                        <AlertTitle>No Upcoming Assignments</AlertTitle>
                        <AlertDescription>You do not have any ward rotations scheduled for the coming weeks.</AlertDescription>
                    </Alert>
                )}
            </div>

            {history.length > 0 && (
                <div className="space-y-4 pt-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 px-1 opacity-60"><Calendar className="h-5 w-5"/> Rotation History</h3>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Date</TableHead>
                                    <TableHead>Ward / Unit</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell className="text-sm font-medium">{format(parseISO(r.date), 'PPP')}</TableCell>
                                        <TableCell className="font-bold">{r.ward}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary" className="opacity-60">Completed</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}
