'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { db, auth } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, parseISO, isAfter, isBefore, isWithinInterval, startOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Calendar, Clock, Stethoscope, Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Placement = {
    id: string;
    studentId: string;
    studentName: string;
    location: string;
    startDate: string;
    endDate: string;
};

export default function StudentPlacementsPage() {
    const [placements, setPlacements] = React.useState<Placement[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        const placementsRef = ref(db, 'clinicals/placements');
        const unsub = onValue(placementsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(r => r.studentId === currentUser.uid);
                // Sort by start date (descending, so latest/future is at top)
                setPlacements(list.sort((a,b) => b.startDate.localeCompare(a.startDate)));
            } else {
                setPlacements([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    const getStatus = (startStr: string, endStr: string) => {
        const now = startOfDay(new Date());
        const start = startOfDay(parseISO(startStr));
        const end = startOfDay(parseISO(endStr));

        if (isBefore(now, start)) {
            return { label: 'Upcoming', color: 'bg-blue-500 text-white hover:bg-blue-600' };
        } else if (isAfter(now, end)) {
            return { label: 'Completed', color: 'bg-muted text-muted-foreground' };
        } else {
            return { label: 'Active Now', color: 'bg-green-600 text-white hover:bg-green-700 animate-pulse' };
        }
    };

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-64 w-full"/></div>;

    const activeOrUpcoming = placements.filter(p => {
        const status = getStatus(p.startDate, p.endDate).label;
        return status === 'Active Now' || status === 'Upcoming';
    });

    const pastPlacements = placements.filter(p => {
        const status = getStatus(p.startDate, p.endDate).label;
        return status === 'Completed';
    });

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg shadow-md">
                            <MapPin className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-2xl">Community Placements</CardTitle>
                            <CardDescription>View your official community health service and partner hospital placements.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                    <Clock className="h-5 w-5 text-primary" /> Current & Upcoming Placements
                </h3>
                {activeOrUpcoming.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2">
                        {activeOrUpcoming.map(p => {
                            const status = getStatus(p.startDate, p.endDate);
                            return (
                                <Card key={p.id} className={cn("border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow duration-300", status.label === 'Active Now' && "ring-2 ring-primary bg-primary/5")}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start gap-4">
                                            <CardTitle className="text-xl font-black">{p.location}</CardTitle>
                                            <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5", status.color)}>
                                                {status.label}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-2">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            {format(parseISO(p.startDate), 'PPP')} — {format(parseISO(p.endDate), 'PPP')}
                                        </div>
                                        <div className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>
                                                Please report to the clinical supervisor at the site on the start date. Bring your clinical ID and handbook.
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Alert className="border-dashed">
                        <Info className="h-4 w-4" />
                        <AlertTitle>No Active Placements</AlertTitle>
                        <AlertDescription>You do not have any community health center placements scheduled at this time.</AlertDescription>
                    </Alert>
                )}
            </div>

            {pastPlacements.length > 0 && (
                <div className="space-y-4 pt-6">
                    <h3 className="text-lg font-bold flex items-center gap-2 px-1 opacity-60">
                        <Calendar className="h-5 w-5" /> Placement History
                    </h3>
                    <div className="rounded-xl border overflow-hidden bg-background">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Location</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pastPlacements.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-bold">{p.location}</TableCell>
                                        <TableCell className="text-sm">{format(parseISO(p.startDate), 'PPP')}</TableCell>
                                        <TableCell className="text-sm">{format(parseISO(p.endDate), 'PPP')}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary" className="opacity-75 font-bold">Completed</Badge>
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
