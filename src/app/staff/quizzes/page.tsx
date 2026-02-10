'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, HelpCircle, Clock, ChevronRight, PlusCircle, Loader2, Users, Search, Trash2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, get, remove } from 'firebase/database';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

type Quiz = {
    id: string;
    title: string;
    description: string;
    courseIds?: string[];
    intakeIds?: string[];
    programmeIds?: string[];
    timestamp: number;
    sections?: any[];
};

export default function StaffQuizzesPage() {
    const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [submissions, setSubmissions] = React.useState<Record<string, number>>({});
    
    // Create Dialog State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [intakes, setIntakes] = React.useState<{id: string, name: string}[]>([]);
    const [programmes, setProgrammes] = React.useState<{id: string, name: string}[]>([]);
    const [selectedIntakes, setSelectedIntakes] = React.useState<string[]>([]);
    const [selectedProgrammes, setSelectedProgrammes] = React.useState<string[]>([]);

    const { toast } = useToast();
    const router = useRouter();

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    React.useEffect(() => {
        const fetchMeta = async () => {
            const [iSnap, pSnap] = await Promise.all([get(ref(db, 'intakes')), get(ref(db, 'programmes'))]);
            if(iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, d]:[string, any]) => ({ id, name: d.name })));
            if(pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, d]:[string, any]) => ({ id, name: d.name })));
        };
        fetchMeta();

        const unsubQuizzes = onValue(ref(db, 'quizzes'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setQuizzes(Object.entries(data).map(([id, d]: [string, any]) => ({ id, ...d })).sort((a,b) => b.timestamp - a.timestamp));
            } else {
                setQuizzes([]);
            }
            setLoading(false);
        });

        const unsubSubs = onValue(ref(db, 'quizSubmissions'), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const counts: Record<string, number> = {};
                Object.keys(data).forEach(qId => {
                    counts[qId] = Object.keys(data[qId]).length;
                });
                setSubmissions(counts);
            }
        });

        return () => { unsubQuizzes(); unsubSubs(); };
    }, []);

    const handleCreateQuiz = () => {
        if (selectedIntakes.length === 0 || selectedProgrammes.length === 0) {
            toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select target intakes and programmes.' });
            return;
        }
        const query = new URLSearchParams({
            intakeIds: selectedIntakes.join(','),
            programmeIds: selectedProgrammes.join(',')
        }).toString();
        router.push(`/admin/quizzes/builder?${query}`);
    };

    const handleDeleteQuiz = async (id: string) => {
        if (!confirm("Are you sure? This will delete the quiz and all results.")) return;
        try {
            await remove(ref(db, `quizzes/${id}`));
            await remove(ref(db, `quizSubmissions/${id}`));
            toast({ title: 'Quiz Deleted' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        }
    };

    const toggleSelection = (id: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
        setList(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const filteredQuizzes = quizzes.filter(q => q.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">Quizzes & Exams</CardTitle>
                        <CardDescription>Manage your online assessments and track student results.</CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Create Quiz</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>New Quiz Target Audience</DialogTitle><DialogDescription>Select who should be able to see and take this quiz.</DialogDescription></DialogHeader>
                            <div className="grid md:grid-cols-2 gap-6 py-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">Intakes</Label>
                                    <ScrollArea className="h-64 border rounded-md p-2">
                                        {intakes.map(i => (
                                            <div key={i.id} className="flex items-center space-x-2 py-1">
                                                <Checkbox id={`int-${i.id}`} checked={selectedIntakes.includes(i.id)} onCheckedChange={() => toggleSelection(i.id, selectedIntakes, setSelectedIntakes)} />
                                                <Label htmlFor={`int-${i.id}`} className="text-sm font-normal">{i.name}</Label>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">Programmes</Label>
                                    <ScrollArea className="h-64 border rounded-md p-2">
                                        {programmes.map(p => (
                                            <div key={p.id} className="flex items-center space-x-2 py-1">
                                                <Checkbox id={`prog-${p.id}`} checked={selectedProgrammes.includes(p.id)} onCheckedChange={() => toggleSelection(p.id, selectedProgrammes, setSelectedProgrammes)} />
                                                <Label htmlFor={`prog-${p.id}`} className="text-sm font-normal">{p.name}</Label>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={handleCreateQuiz}>Proceed to Builder</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search quizzes..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredQuizzes.map(quiz => (
                        <Card key={quiz.id} className="flex flex-col shadow-md">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg line-clamp-1">{quiz.title}</CardTitle>
                                        <CardDescription className="line-clamp-2 mt-1">{quiz.description}</CardDescription>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDeleteQuiz(quiz.id)}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5"/> {quiz.sections?.reduce((acc, s) => acc + (s.questions?.length || 0), 0) || 0} Qs</div>
                                    <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5"/> {submissions[quiz.id] || 0} Submissions</div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {quiz.programmeIds?.map(pid => (
                                        <Badge key={pid} variant="outline" className="text-[10px]">{programmes.find(p=>p.id===pid)?.name}</Badge>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="mt-auto border-t bg-muted/30 p-4">
                                <Button asChild className="w-full shadow-sm" variant="outline">
                                    <Link href={`/admin/quizzes/builder/${quiz.id}`}>
                                        Manage & Edit <ChevronRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
