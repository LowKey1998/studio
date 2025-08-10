'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, FileQuestion, Trash2 } from "lucide-react";
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

type Quiz = {
    id: string;
    title: string;
    description: string;
    courseId: string;
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


export default function OnlineQuizzesPage() {
    const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [programmes, setProgrammes] = React.useState<Programme[]>([]);
    const [selectedProgramme, setSelectedProgramme] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
    const router = useRouter();
    const { toast } = useToast();
    
    React.useEffect(() => {
        const quizzesRef = ref(db, 'quizzes');
        const coursesRef = ref(db, 'courses');
        const programmesRef = ref(db, 'programmes');

        const unsubQuizzes = onValue(quizzesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setQuizzes(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setQuizzes([]);
            }
            setLoading(false);
        });

        const unsubCourses = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setCourses(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setCourses([]);
            }
        });

        const unsubProgrammes = onValue(programmesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setProgrammes(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setProgrammes([]);
            }
        });

        return () => {
            unsubQuizzes();
            unsubCourses();
            unsubProgrammes();
        }
    }, []);
    
    const handleProceedToBuilder = () => {
        if (!selectedCourse) {
            toast({ variant: 'destructive', title: 'Please select a course.' });
            return;
        }
        setIsCreateDialogOpen(false);
        router.push(`/admin/quizzes/builder?courseId=${selectedCourse}`);
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
    
    const filteredCourses = React.useMemo(() => {
        if (!selectedProgramme) return [];
        const programme = programmes.find(p => p.id === selectedProgramme);
        if (!programme || !programme.courseIds) return [];
        const courseIds = Object.keys(programme.courseIds);
        return courses.filter(c => courseIds.includes(c.id));
    }, [selectedProgramme, programmes, courses]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
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
                            <DialogDescription>Choose the course this quiz will belong to.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <div className="space-y-1">
                                <Label htmlFor="programme-select">Programme</Label>
                                <Select value={selectedProgramme} onValueChange={setSelectedProgramme}>
                                    <SelectTrigger id="programme-select">
                                        <SelectValue placeholder="Select a programme..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {programmes.map(programme => (
                                            <SelectItem key={programme.id} value={programme.id}>
                                                {programme.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="course-select">Course</Label>
                                <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={!selectedProgramme}>
                                    <SelectTrigger id="course-select">
                                        <SelectValue placeholder="Select a course..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredCourses.map(course => (
                                            <SelectItem key={course.id} value={course.id}>
                                                {course.name} ({course.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
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
                {loading ? (
                    <Skeleton className="h-48" />
                ) : quizzes.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {quizzes.map(quiz => (
                            <Card key={quiz.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><FileQuestion className="h-5 w-5 text-primary" /> {quiz.title}</CardTitle>
                                    <CardDescription>{quiz.description}</CardDescription>
                                </CardHeader>
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
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">No quizzes have been created yet.</p>
                )}
            </CardContent>
        </Card>
    );
}
