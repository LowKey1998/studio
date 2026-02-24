'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { db, auth } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Star, UserCheck, Clock, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

type Evaluation = {
    id: string;
    studentId: string;
    rotation: string;
    preceptor: string;
    score: number;
    date: string;
    feedback?: string;
};

export default function StudentEvaluationsPage() {
    const [evaluations, setEvaluations] = React.useState<Evaluation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;
        const evalRef = ref(db, 'clinicals/evaluations');
        const unsub = onValue(evalRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data)
                    .map(id => ({ id, ...data[id] }))
                    .filter(e => e.studentId === currentUser.uid);
                setEvaluations(list.sort((a,b) => b.date.localeCompare(a.date)));
            } else {
                setEvaluations([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    if (loading) return <div className="space-y-4"><Skeleton className="h-48 w-full"/><Skeleton className="h-48 w-full"/></div>;

    const averageScore = evaluations.length > 0 ? evaluations.reduce((acc, e) => acc + e.score, 0) / evaluations.length : 0;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary rounded-lg shadow-md">
                                <ClipboardList className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle className="font-headline text-2xl">Clinical Performance Feedback</CardTitle>
                                <CardDescription>View official evaluations and scores provided by your clinical preceptors.</CardDescription>
                            </div>
                        </div>
                        {evaluations.length > 0 && (
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Average Clinical Score</span>
                                <span className="text-3xl font-black text-primary">{averageScore.toFixed(1)}%</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                {evaluations.length > 0 ? evaluations.map(e => (
                    <Card key={e.id} className="shadow-md border-t-2 border-t-primary/20">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest">{e.rotation}</Badge>
                                    <CardTitle className="text-lg font-bold">{e.preceptor}</CardTitle>
                                    <CardDescription className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Evaluated: {format(parseISO(e.date), 'PPP')}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-black text-primary">{e.score}%</span>
                                    <span className="text-[8px] font-bold opacity-60 uppercase">Score</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase opacity-60">
                                    <span>Benchmark Performance</span>
                                    <span>{e.score}%</span>
                                </div>
                                <Progress value={e.score} className="h-1.5" />
                            </div>
                            {e.feedback && (
                                <div className="p-4 rounded-xl bg-muted/30 border italic text-sm text-muted-foreground leading-relaxed">
                                    "{e.feedback}"
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4">
                        <Star className="h-12 w-12 opacity-10" />
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold">No Evaluations Posted</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Your clinical preceptors have not yet published any official performance evaluations for your rotations.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
