
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

type Quiz = {
    id: string;
    title: string;
    description: string;
    courseId: string;
    semesterId: string;
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

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
};


export default function OnlineQuizzesPage() {
    const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [semesters, setSemesters] = React.useState<Semester[]>([]);
    const [loading, setLoading] = React.useState(true);
    const router = useRouter();
    const { toast } = useToast();
    
    // Create Dialog State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const [createSelectedSemester, setCreateSelectedSemester] = React.useState('');
    const [createSelectedProgramme, setCreateSelectedProgramme] = React.useState('');
    const [createSelectedCourse, setCreateSelectedCourse] = React.useState('');

    // Filter State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [programmeFilter, setProgrammeFilter] = React.useState('all');
    const [semesterFilter, setSemesterFilter] = React.useState('all');

    
    React.useEffect(() => {
        const quizzesRef = ref(db, 'quizzes');
        const coursesRef = ref(db, 'courses');
        const programmesRef = ref(db, 'programmes');
        const semestersRef = ref(db, 'semesters');

        const unsubQuizzes = onValue(quizzesRef, (snapshot) => {
            setQuizzes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
            setLoading(false);
        });

        const unsubCourses = onValue(coursesRef, (snapshot) => {
            setCourses(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });

        const unsubProgrammes = onValue(programmesRef, (snapshot) => {
            setProgrammes(snapshot.exists() ? Object.keys(snapshot.val()).map(id => ({ id, ...snapshot.val()[id] })) : []);
        });
        
        const unsubSemesters = onValue(semestersRef, (snapshot) => {
            const list: Semester[] = snapshot.exists() ? Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })) : [];
            setSemesters(list.filter(s => s.status !== 'Archived').sort((a,b) => b.name.localeCompare(a.name)));
        });

        return () => {
            unsubQuizzes();
            unsubCourses();
            unsubProgrammes();
            unsubSemesters();
        }
    }, []);
    
    const handleProceedToBuilder = () => {
        if (!createSelectedCourse) {
            toast({ variant: 'destructive', title: 'Please select a course.' });
            return;
        }
        setIsCreateDialogOpen(false);
        router.push(`/admin/quizzes/builder?courseId=${createSelectedCourse}&semesterId=${createSelectedSemester}`);
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
    
    const createDialogFilteredCourses = React.useMemo(() => {
        if (!createSelectedProgramme) return [];
        const programme = programmes.find(p => p.id === createSelectedProgramme);
        if (!programme || !programme.courseIds) return [];
        const courseIds = Object.keys(programme.courseIds);
        return courses.filter(c => courseIds.includes(c.id));
    }, [createSelectedProgramme, programmes, courses]);

    const filteredQuizzes = React.useMemo(() => {
        const programmeCourseIds = new Set<string>();
        if (programmeFilter !== 'all') {
            const programme = programmes.find(p => p.id === programmeFilter);
            if (programme?.courseIds) {
                Object.keys(programme.courseIds).forEach(id => programmeCourseIds.add(id));
            }
        }

        return quizzes.filter(quiz => {
            const searchMatch = !searchTerm || quiz.title.toLowerCase().includes(searchTerm.toLowerCase());
            const semesterMatch = semesterFilter === 'all' || quiz.semesterId === semesterFilter;
            const programmeMatch = programmeFilter === 'all' || programmeCourseIds.has(quiz.courseId);

            return searchMatch && semesterMatch && programmeMatch;
        });
    }, [quizzes, searchTerm, programmeFilter, semesterFilter, programmes]);

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
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Select Course</DialogTitle>
                            <DialogDescription>Choose the semester, programme, and course this quiz will belong to.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <div className="space-y-1">
                                <Label htmlFor="semester-select">Semester</Label>
                                <Select value={createSelectedSemester} onValueChange={setCreateSelectedSemester}>
                                    <SelectTrigger id="semester-select"><SelectValue placeholder="Select a semester..." /></SelectTrigger>
                                    <SelectContent>{semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="programme-select">Programme</Label>
                                <Select value={createSelectedProgramme} onValueChange={setCreateSelectedProgramme} disabled={!createSelectedSemester}>
                                    <SelectTrigger id="programme-select"><SelectValue placeholder="Select a programme..." /></SelectTrigger>
                                    <SelectContent>{programmes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="course-select">Course</Label>
                                <Select value={createSelectedCourse} onValueChange={setCreateSelectedCourse} disabled={!createSelectedProgramme}>
                                    <SelectTrigger id="course-select"><SelectValue placeholder="Select a course..." /></SelectTrigger>
                                    <SelectContent>{createDialogFilteredCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
                                </Select>
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
                     <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                        <SelectTrigger className="md:w-[250px]"><SelectValue placeholder="Filter by semester..." /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Semesters</SelectItem>{semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                {loading ? (
                    <Skeleton className="h-48" />
                ) : filteredQuizzes.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredQuizzes.map(quiz => {
                            const course = courses.find(c => c.id === quiz.courseId);
                            const semester = semesters.find(s => s.id === quiz.semesterId);
                            return (
                            <Card key={quiz.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><FileQuestion className="h-5 w-5 text-primary" /> {quiz.title}</CardTitle>
                                    <CardDescription>
                                        <div className="font-semibold">{course ? `${course.name} (${course.code})` : 'Unknown Course'}</div>
                                        <div>{semester ? semester.name : 'Unknown Semester'}</div>
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
