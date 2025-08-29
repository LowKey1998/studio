
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, FileQuestion, Trash2, Search } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

type Quiz = {
    id: string;
    title: string;
    description: string;
    courseId?: string; // Legacy, to be phased out
    semesterId?: string; // Legacy, to be phased out
    // For multiple associations
    intakeIds?: string[];
    programmeIds?: string[];
};

type Course = {
    id: string;
    name: string;
    code: string;
};

type Programme = {
    id: string;
    name: string;
    courseIds?: Record<string, boolean>;
};

type Intake = {
    id: string;
    name: string;
};


export default function OnlineQuizzesPage() {
    const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [intakes, setIntakes] = React.useState<Intake[]>([]);
    const [loading, setLoading] = React.useState(true);
    const router = useRouter();
    const { toast } = useToast();
    
    // Create Dialog State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [createSelectedIntakes, setCreateSelectedIntakes] = React.useState<string[]>([]);
    const [createSelectedProgrammes, setCreateSelectedProgrammes] = React.useState<string[]>([]);

    // Filter State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [intakeFilter, setIntakeFilter] = React.useState('all');

    
    React.useEffect(() => {
        const quizzesRef = ref(db, 'quizzes');
        const programmesRef = ref(db, 'programmes');
        const intakesRef = ref(db, 'intakes');

        const unsubQuizzes = onValue(quizzesRef, (snapshot) => {
            setQuizzes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });

        const unsubProgrammes = onValue(programmesRef, (snapshot) => {
            setProgrammes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });
        
        const unsubIntakes = onValue(intakesRef, (snapshot) => {
            setIntakes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });

        return () => {
            unsubQuizzes();
            unsubProgrammes();
            unsubIntakes();
        }
    }, []);
    
    const handleProceedToBuilder = () => {
        if (createSelectedProgrammes.length === 0 || createSelectedIntakes.length === 0) {
            toast({ variant: 'destructive', title: 'Please select at least one programme and intake.' });
            return;
        }
        setIsCreateDialogOpen(false);
        const query = new URLSearchParams({
            programmeIds: createSelectedProgrammes.join(','),
            intakeIds: createSelectedIntakes.join(',')
        }).toString();
        router.push(`/admin/quizzes/builder?${query}`);
    };

    const handleDelete = async (quizId: string) => {
        try {
            await remove(ref(db, `quizzes/${quizId}`));
            await remove(ref(db, `quizSubmissions/${quizId}`)); // Also remove submissions
            toast({ title: "Quiz Deleted", description: "The quiz and all its submissions have been removed." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        }
    };

    const filteredQuizzes = React.useMemo(() => {
        return quizzes.filter(quiz => {
            const searchMatch = !searchTerm || quiz.title.toLowerCase().includes(searchTerm.toLowerCase());
            
            const intakeMatch = intakeFilter === 'all' || 
                (quiz.intakeIds && quiz.intakeIds.includes(intakeFilter));
            
            const programmeMatch = programmeFilter === 'all' ||
                (quiz.programmeIds && quiz.programmeIds.includes(programmeFilter));

            return searchMatch && intakeMatch && programmeMatch;
        });
    }, [quizzes, searchTerm, programmeFilter, intakeFilter]);
    
    const handleCheckboxChange = (id: string, state: string[], setState: React.Dispatch<React.SetStateAction<string[]>>) => {
        setState(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    }

    return (
        <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Online Quizzes</CardTitle>
                    <CardDescription>Create, manage, and review online quizzes for student assessment.</CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4"/> Create Quiz</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Select Target Audience</DialogTitle>
                            <DialogDescription>Choose which intakes and programmes this quiz will be for.</DialogDescription>
                        </DialogHeader>
                        <div className="grid md:grid-cols-2 gap-4 py-4">
                             <div className="space-y-2 border p-2 rounded-md">
                                <Label className="font-semibold">Intakes</Label>
                                <ScrollArea className="h-64">
                                {intakes.map(i => <div key={i.id} className="flex items-center gap-2"><Checkbox id={`intake-${i.id}`} checked={createSelectedIntakes.includes(i.id)} onCheckedChange={() => handleCheckboxChange(i.id, createSelectedIntakes, setCreateSelectedIntakes)}/><Label htmlFor={`intake-${i.id}`}>{i.name}</Label></div>)}
                                </ScrollArea>
                            </div>
                             <div className="space-y-2 border p-2 rounded-md">
                                <Label className="font-semibold">Programmes</Label>
                                <ScrollArea className="h-64">
                                {programmes.map(p => <div key={p.id} className="flex items-center gap-2"><Checkbox id={`prog-${p.id}`} checked={createSelectedProgrammes.includes(p.id)} onCheckedChange={() => handleCheckboxChange(p.id, createSelectedProgrammes, setCreateSelectedProgrammes)}/><Label htmlFor={`prog-${p.id}`}>{p.name}</Label></div>)}
                                </ScrollArea>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleProceedToBuilder}>Proceed to Builder</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search quiz title..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
                        <SelectTrigger className="md:w-[250px]"><SelectValue placeholder="Filter by programme..." /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Programmes</SelectItem>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                     <Select value={intakeFilter} onValueChange={setIntakeFilter}>
                        <SelectTrigger className="md:w-[250px]"><SelectValue placeholder="Filter by intake..." /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Intakes</SelectItem>{intakes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                {loading ? (
                    <Skeleton className="h-48" />
                ) : filteredQuizzes.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredQuizzes.map(quiz => {
                            return (
                            <Card key={quiz.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><FileQuestion className="h-5 w-5 text-primary" /> {quiz.title}</CardTitle>
                                    <CardDescription>
                                        <p>Intakes: {quiz.intakeIds?.map(id => intakes.find(i=>i.id===id)?.name).join(', ') || 'N/A'}</p>
                                        <p>Programmes: {quiz.programmeIds?.map(id => programmes.find(p=>p.id===id)?.name).join(', ') || 'N/A'}</p>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                     <p className="text-sm text-muted-foreground line-clamp-2">{quiz.description}</p>
                                </CardContent>
                                <CardFooter className="flex justify-between">
                                    <Button variant="outline" onClick={() => router.push(`/admin/quizzes/builder/${quiz.id}`)}>Edit</Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete the quiz and all student submissions for it. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(quiz.id)}>Yes, delete it</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardFooter>
                            </Card>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">No quizzes found for the current filters.</p>
                )}
            </CardContent>
        </Card>
    );
}
