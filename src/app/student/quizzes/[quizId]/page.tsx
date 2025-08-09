
'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import { ref, get, set } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Confetti from 'react-confetti';

type Question = {
    id: string;
    text: string;
    type: 'multiple-choice' | 'short-answer';
    options?: { id: string; text: string; }[];
    correctAnswer?: string;
};

type Quiz = {
    title: string;
    shuffleQuestions: boolean;
    isMultipleChoiceOnly: boolean;
    sections: { title: string; questions: Question[] }[];
};

type Answers = Record<string, string>; // questionId -> answer (optionId or text)

const shuffleArray = (array: any[]) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

export default function TakeQuizPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.quizId as string;
    const [quiz, setQuiz] = React.useState<Quiz | null>(null);
    const [allQuestions, setAllQuestions] = React.useState<Question[]>([]);
    const [answers, setAnswers] = React.useState<Answers>({});
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [showResults, setShowResults] = React.useState(false);
    const [finalScore, setFinalScore] = React.useState(0);
    const { toast } = useToast();

    React.useEffect(() => {
        onAuthStateChanged(auth, (user) => {
            if(user) setCurrentUser(user);
            else router.push('/login');
        });
    }, [router]);

    React.useEffect(() => {
        if (!quizId) return;
        const fetchQuiz = async () => {
            setLoading(true);
            const quizRef = ref(db, `quizzes/${quizId}`);
            const snapshot = await get(quizRef);
            if (snapshot.exists()) {
                const quizData = snapshot.val();
                setQuiz(quizData);
                let questions = quizData.sections.flatMap((s: any) => s.questions);
                if (quizData.shuffleQuestions) {
                    questions = shuffleArray(questions);
                }
                setAllQuestions(questions);
            }
            setLoading(false);
        };
        fetchQuiz();
    }, [quizId]);

    const handleAnswerChange = (questionId: string, answer: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleSubmit = async () => {
        if(!currentUser) return;
        setSubmitting(true);
        const submissionRef = ref(db, `quizSubmissions/${quizId}/${currentUser.uid}`);
        
        try {
            const submissionData: any = { answers, status: 'completed' };
            if (quiz?.isMultipleChoiceOnly) {
                let score = 0;
                allQuestions.forEach(q => {
                    if (q.type === 'multiple-choice' && answers[q.id] === q.correctAnswer) {
                        score++;
                    }
                });
                submissionData.score = score;
                submissionData.totalQuestions = allQuestions.length;
                setFinalScore(score);
                setShowResults(true);
            } else {
                 toast({ title: "Submission Received!", description: "Your quiz has been submitted for grading." });
                 router.push('/student/quizzes');
            }
            await set(submissionRef, submissionData);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setSubmitting(false);
        }
    };
    
    if (loading) return <Skeleton className="h-96 w-full" />;

    if(showResults){
        return (
            <div className="relative">
                <Confetti recycle={false} numberOfPieces={200} />
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>Quiz Results!</CardTitle>
                        <CardDescription>You scored...</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-6xl font-bold">{finalScore} / {allQuestions.length}</p>
                        <p className="text-2xl text-muted-foreground">{((finalScore / allQuestions.length) * 100).toFixed(0)}%</p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={() => router.push('/student/quizzes')}>Back to Quizzes</Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader><CardTitle className="text-2xl">{quiz?.title}</CardTitle></CardHeader>
            <CardContent className="space-y-8">
                {allQuestions.map((question, index) => (
                    <div key={question.id} className="p-4 border-t">
                        <Label className="font-bold text-base">Question {index + 1}: {question.text}</Label>
                        <div className="mt-4">
                            {question.type === 'multiple-choice' ? (
                                <RadioGroup onValueChange={(value) => handleAnswerChange(question.id, value)}>
                                    {(question.options || []).map(option => (
                                        <div key={option.id} className="flex items-center space-x-2">
                                            <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                                            <Label htmlFor={`${question.id}-${option.id}`}>{option.text}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            ) : (
                                <Textarea placeholder="Type your answer here..." onChange={(e) => handleAnswerChange(question.id, e.target.value)} />
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
            <CardFooter className="justify-end">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button disabled={submitting}>Submit Quiz</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Confirm Submission</AlertDialogTitle><AlertDialogDescription>Are you sure you want to submit your answers? You cannot make changes after submitting.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSubmit}>Yes, Submit</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    );
}
