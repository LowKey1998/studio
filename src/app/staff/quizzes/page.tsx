'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, HelpCircle, Clock, ChevronRight, PlusCircle, Loader2, Users, Search, Trash2, BookOpen, Layers } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, get, remove } from 'firebase/database';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

type Quiz = {
    id: string;
    title: string;
    description: string;
    courseId?: string;
    courseIds?: string[];
    intakeIds?: string[];
    programmeIds?: string[];
    linkedComponentId?: string;
    timestamp: number;
    sections?: any[];
};

type Course = { id: string; name: string; code: string; assessmentTemplateId?: string; lecturerId?: string; lecturerIds?: string[]; };
type AssessmentTemplate = { name: string; components: Record<string, { name: string; isOnlineQuiz: boolean }> };

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
    const [allCourses, setAllCourses] = React.useState<Course[]>([]);
    const [templates, setTemplates] = React.useState<Record<string, AssessmentTemplate>>({});

    const [selectedIntakes, setSelectedIntakes] = React.useState<string[]>([]);
    const [selectedProgrammes, setSelectedProgrammes] = React.useState<string[]>([]);
    const [selectedCourseId, setSelectedCourseId] = React.useState('');
    const [selectedComponentId, setSelectedComponentId] = React.useState('');

    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    React.useEffect(() => {
        const fetchMeta = async () => {
            const [iSnap, pSnap, cSnap, tSnap] = await Promise.all([
                get(ref(db, 'intakes')), 
                get(ref(db, 'programmes')),
                get(ref(db, 'courses')),
                get(ref(db, 'settings/assessmentTemplates'))
            ]);
            if(iSnap.exists()) setIntakes(Object.entries(iSnap.val()).map(([id, d]:[string, any]) => ({ id, name: d.name })));
            if(pSnap.exists()) setProgrammes(Object.entries(pSnap.val()).map(([id, d]:[string, any]) => ({ id, name: d.name })));
            if(cSnap.exists()) setAllCourses(Object.entries(cSnap.val()).map(([id, d]:[string, any]) => ({ id, ...d })));
            if(tSnap.exists()) setTemplates(tSnap.val());

            // Handle incoming courseId from "My Courses" page
            const incomingCourseId = searchParams.get('courseId');
            if (incomingCourseId) {
                setSelectedCourseId(incomingCourseId);
                setIsCreateDialogOpen(true);
            }
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
    }, [searchParams]);

    const handleCreateQuiz = () => {
        if (!selectedCourseId) {
            toast({ variant: 'destructive', title: 'Course Required', description: 'Please select a course for this quiz.' });
            return;
        }
        if (selectedIntakes.length === 0 || selectedProgrammes.length === 0) {
            toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select target cohorts.' });
            return;
        }
        
        const queryParams = new URLSearchParams({
            courseId: selectedCourseId,
            intakeIds: selectedIntakes.join(','),
            programmeIds: selectedProgrammes.join(',')
        });
        
        if (selectedComponentId) {
            queryParams.append('linkedComponentId', selectedComponentId);
        }

        setIsCreateDialogOpen(false);
        router.push(`/admin/quizzes/builder?${queryParams.toString()}`);
    };

    const handleDeleteQuiz = async (id: string) => {
        try {
            await remove(ref(db, `quizzes/${id}`));
            await remove(ref(db, `quizSubmissions/${id}`));
            toast({ title: 'Quiz Deleted' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error' });
        }
    };

    const toggleSelection = (id: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
        setList(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const myCourses = React.useMemo(() => {
        if (!currentUser) return [];
        return allCourses.filter(c => {
            const lIds = c.lecturerIds || [];
            return c.lecturerId === currentUser.uid || (Array.isArray(lIds) && lIds.includes(currentUser.uid));
        });
    }, [allCourses, currentUser]);

    const availableComponents = React.useMemo(() => {
        const course = allCourses.find(c => c.id === selectedCourseId);
        if (!course?.assessmentTemplateId || !templates[course.assessmentTemplateId]) return [];
        
        const components = templates[course.assessmentTemplateId].components;
        return Object.entries(components)
            .filter(([_, data]) => data.isOnlineQuiz)
            .map(([id, data]) => ({ id, name: data.name }));
    }, [selectedCourseId, allCourses, templates]);

    const filteredQuizzes = quizzes.filter(q => q.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="font-headline text-2xl">Quizzes & MCQ Exams</CardTitle>
                            <CardDescription>Manage curriculum-linked automated assessments.</CardDescription>
                        </div>
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/> Create Quiz</Button></DialogTrigger>
                            <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Quiz Configuration</DialogTitle>
                                    <DialogDescription>Link this quiz to a course and CA component for automatic grading.</DialogDescription>
                                </DialogHeader>
                                <div className="flex-1 overflow-y-auto pr-4 py-4 space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">1. Target Course</Label>
                                            <Select value={selectedCourseId} onValueChange={(val) => { setSelectedCourseId(val); setSelectedComponentId(''); }}>
                                                <SelectTrigger className="h-12"><SelectValue placeholder="Select from your courses..."/></SelectTrigger>
                                                <SelectContent>
                                                    {myCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.code}: {c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {selectedCourseId && (
                                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                                <Label className="text-xs font-black uppercase text-primary tracking-widest">2. Link to Assessment Record (Optional)</Label>
                                                <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                                                    <SelectTrigger className="h-12 border-primary/20 bg-primary/5">
                                                        <SelectValue placeholder={availableComponents.length > 0 ? "Fulfill a CA component..." : "No MCQ components found for this course"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">Create as standalone practice quiz</SelectItem>
                                                        <Separator className="my-1"/>
                                                        {availableComponents.map(c => <SelectItem key={c.id} value={c.id}>{c.name} (Online MCQ)</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[10px] text-muted-foreground italic pl-1">Only CA components marked as "Online MCQ" by the Admin appear here.</p>
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">3. Target Intakes</Label>
                                            <ScrollArea className="h-48 border rounded-lg p-3 bg-muted/20">
                                                {intakes.map(i => (
                                                    <div key={i.id} className="flex items-center space-x-2 py-1.5 border-b last:border-0">
                                                        <Checkbox id={`int-${i.id}`} checked={selectedIntakes.includes(i.id)} onCheckedChange={() => toggleSelection(i.id, selectedIntakes, setSelectedIntakes)} />
                                                        <Label htmlFor={`int-${i.id}`} className="text-sm font-medium cursor-pointer flex-1">{i.name}</Label>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">4. Target Programmes</Label>
                                            <ScrollArea className="h-48 border rounded-lg p-3 bg-muted/20">
                                                {programmes.map(p => (
                                                    <div key={p.id} className="flex items-center space-x-2 py-1.5 border-b last:border-0">
                                                        <Checkbox id={`prog-${p.id}`} checked={selectedProgrammes.includes(p.id)} onCheckedChange={() => toggleSelection(p.id, selectedProgrammes, setSelectedProgrammes)} />
                                                        <Label htmlFor={`prog-${p.id}`} className="text-sm font-medium cursor-pointer flex-1">{p.name}</Label>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="border-t pt-4">
                                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                    <Button onClick={handleCreateQuiz} disabled={!selectedCourseId || selectedIntakes.length === 0 || selectedProgrammes.length === 0}>
                                        Continue to Builder <ChevronRight className="ml-2 h-4 w-4"/>
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
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
                        <Card key={quiz.id} className="flex flex-col shadow-md hover:shadow-lg transition-all border-t-2 border-t-primary/10">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg line-clamp-1">{quiz.title}</CardTitle>
                                            {quiz.linkedComponentId && <Badge className="bg-blue-600 h-4 text-[8px] uppercase tracking-tighter">Fulfills CA</Badge>}
                                        </div>
                                        <CardDescription className="line-clamp-2 mt-1">{quiz.description}</CardDescription>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action will permanently delete the quiz "{quiz.title}" and all associated student submissions. This cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteQuiz(quiz.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Delete Quiz
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-muted-foreground">
                                        <div className="flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5 text-primary"/> {quiz.sections?.reduce((acc, s) => acc + (s.questions?.length || 0), 0) || 0} Questions</div>
                                        <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-primary"/> {submissions[quiz.id] || 0} Submissions</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {quiz.programmeIds?.map(pid => (
                                            <Badge key={pid} variant="outline" className="text-[10px] bg-muted/20">{programmes.find(p=>p.id===pid)?.name}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="mt-auto border-t bg-muted/10 p-4">
                                <Button asChild className="w-full shadow-sm" variant="outline">
                                    <Link href={`/admin/quizzes/builder/${quiz.id}`}>
                                        Edit Quiz Structure <ChevronRight className="ml-2 h-4 w-4" />
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
