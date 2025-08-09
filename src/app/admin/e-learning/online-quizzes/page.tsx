
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, FileQuestion, Trash2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, remove } from 'firebase/database';
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
} from "@/components/ui/alert-dialog"

type Quiz = {
    id: string;
    title: string;
    description: string;
    courseId: string;
};

export default function OnlineQuizzesPage() {
    const [quizzes, setQuizzes] = React.useState<Quiz[]>([]);
    const [loading, setLoading] = React.useState(true);
    const router = useRouter();
    const { toast } = useToast();
    
    React.useEffect(() => {
        const quizzesRef = ref(db, 'quizzes');
        const unsub = onValue(quizzesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setQuizzes(Object.keys(data).map(id => ({ id, ...data[id] })));
            } else {
                setQuizzes([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleDelete = async (quizId: string) => {
        try {
            await remove(ref(db, `quizzes/${quizId}`));
            await remove(ref(db, `quizSubmissions/${quizId}`)); // Also remove submissions
            toast({ title: "Quiz Deleted", description: "The quiz and all its submissions have been removed." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Online Quizzes</CardTitle>
                    <CardDescription>Create, manage, and review online quizzes for student assessment.</CardDescription>
                </div>
                <Button onClick={() => router.push('/admin/quizzes/builder')}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Create Quiz
                </Button>
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

