
'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Clock, AlertTriangle, ChevronRight, ChevronLeft, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import { ref, get, set, onValue, serverTimestamp, update } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Confetti from 'react-confetti';
import { differenceInSeconds, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

type Question = {
    id: string;
    text: string;
    type: 'multiple-choice' | 'short-answer';
    options?: { id: string; text: string; }[];
    correctAnswer?: string;
};

type Quiz = {
    title: string;
    startTime?: string;
    endTime?: string;
    shuffleQuestions: boolean;
    isMultipleChoiceOnly: boolean;
    questionsPerPage: number;
    sections: { title: string; questions: Question[] }[];
};

type Answers = Record<string, string>; // questionId -> answer (optionId or text)
type Flagged = Record<string, boolean>; // questionId -> true

type Submission = {
    status: 'in-progress' | 'completed';
    answers: Answers;
    flagged: Flagged;
    questionOrder: Question[];
    score?: number;
    totalQuestions?: number;
}

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
    const [flagged, setFlagged] = React.useState<Flagged>({});
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [showResults, setShowResults] = React.useState(false);
    const [finalScore, setFinalScore] = React.useState(0);
    const { toast } = useToast();

    const [timeLeft, setTimeLeft] = React.useState<number | null>(null);
    const [currentPage, setCurrentPage] = React.useState(0);

    React.useEffect(() => {
        onAuthStateChanged(auth, (user) => {
            if(user) setCurrentUser(user);
            else router.push('/login');
        });
    }, [router]);

    React.useEffect(() => {
        if (!quizId || !currentUser) return;
        const fetchQuizAndSubmission = async () => {
            setLoading(true);
            try {
                const quizRef = ref(db, `quizzes/${quizId}`);
                const submissionRef = ref(db, `quizSubmissions/${quizId}/${currentUser.uid}`);
                
                const [quizSnapshot, submissionSnapshot] = await Promise.all([get(quizRef), get(submissionRef)]);

                if (quizSnapshot.exists()) {
                    const quizData: Quiz = quizSnapshot.val();
                    setQuiz(quizData);

                    if (submissionSnapshot.exists()) {
                        const submissionData: Submission = submissionSnapshot.val();
                         if (submissionData.status === 'completed') {
                            if (submissionData.score !== undefined) {
                                setFinalScore(submissionData.score);
                                setAllQuestions(submissionData.questionOrder || []);
                                setShowResults(true);
                            } else {
                                toast({ title: "Quiz Already Submitted", description: "This quiz is awaiting manual grading." });
                                router.push('/student/quizzes');
                            }
                            setLoading(false);
                            return;
                        }
                        setAllQuestions(submissionData.questionOrder || []);
                        setAnswers(submissionData.answers || {});
                        setFlagged(submissionData.flagged || {});

                    } else {
                        let questions = quizData.sections.flatMap((s: any) => s.questions || []);
                        if (quizData.shuffleQuestions) {
                            questions = shuffleArray(questions);
                        }
                        setAllQuestions(questions);
                        setAnswers({});
                        setFlagged({});
                        await set(submissionRef, { 
                            answers: {},
                            flagged: {},
                            status: 'in-progress',
                            questionOrder: questions
                        });
                    }
                    
                    if (quizData.endTime) {
                         const remaining = differenceInSeconds(parseISO(quizData.endTime), new Date());
                         setTimeLeft(remaining > 0 ? remaining : 0);
                    } else {
                        setTimeLeft(null);
                    }

                }
            } catch (error: any) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load quiz.' });
            } finally {
                setLoading(false);
            }
        };
        fetchQuizAndSubmission();
    }, [quizId, currentUser, router, toast]);

    const handleSubmit = React.useCallback(async (isAutoSubmit = false) => {
        if(!currentUser || submitting) return;
        setSubmitting(true);
        const submissionRef = ref(db, `quizSubmissions/${quizId}/${currentUser.uid}`);
        
        try {
            const submissionData: any = { status: 'completed', submittedAt: new Date().toISOString() };
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
            await update(submissionRef, submissionData);
            if (isAutoSubmit) {
                toast({ variant: "destructive", title: "Time's Up!", description: "Your quiz has been automatically submitted." });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setSubmitting(false);
        }
    }, [allQuestions, answers, currentUser, quiz?.isMultipleChoiceOnly, quizId, router, submitting, toast]);

    React.useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || submitting || showResults) {
            if(timeLeft !== null && timeLeft <= 0 && !submitting) handleSubmit(true);
            return;
        }
        const intervalId = setInterval(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);
        return () => clearInterval(intervalId);
    }, [timeLeft, submitting, showResults, handleSubmit]);

    const handleAnswerChange = (questionId: string, answer: string) => {
        const newAnswers = { ...answers, [questionId]: answer };
        setAnswers(newAnswers);
        if(currentUser){
            const answerRef = ref(db, `quizSubmissions/${quizId}/${currentUser.uid}/answers/${questionId}`);
            set(answerRef, answer);
        }
    };
    
    const handleFlagQuestion = (questionId: string) => {
        const newFlagged = { ...flagged };
        if (newFlagged[questionId]) {
            delete newFlagged[questionId];
        } else {
            newFlagged[questionId] = true;
        }
        setFlagged(newFlagged);
         if(currentUser){
            const flaggedRef = ref(db, `quizSubmissions/${quizId}/${currentUser.uid}/flagged`);
            set(flaggedRef, newFlagged);
        }
    }

    const questionsPerPage = quiz?.questionsPerPage || allQuestions.length;
    const totalPages = questionsPerPage > 0 ? Math.ceil(allQuestions.length / questionsPerPage) : 1;
    const currentQuestions = questionsPerPage > 0 ? allQuestions.slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage) : allQuestions;
    
    if (loading) return <Skeleton className="h-96 w-full" />;

    const quizNotStarted = quiz?.startTime && differenceInSeconds(parseISO(quiz.startTime), new Date()) > 0;
    const quizEnded = quiz?.endTime && differenceInSeconds(parseISO(quiz.endTime), new Date()) <= 0 && !showResults;

    if(quizNotStarted || quizEnded) {
        return (
             <Card className="max-w-2xl mx-auto text-center">
                <CardHeader>
                    <CardTitle>{quiz?.title}</CardTitle>
                    <CardDescription>This quiz is not currently available.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>{quizEnded ? "The deadline for this quiz has passed." : `It will become available on ${quiz?.startTime && parseISO(quiz.startTime).toLocaleString()}.`}</p>
                </CardContent>
             </Card>
        )
    }
    
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
    
    const formatTimeLeft = () => {
        if (timeLeft === null) return '...';
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader className="flex flex-row justify-between items-center sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 border-b">
                <CardTitle className="text-xl md:text-2xl">{quiz?.title}</CardTitle>
                {timeLeft !== null && (
                    <div className={cn("flex items-center gap-2 font-bold p-2 rounded-md", timeLeft <= 60 && 'text-destructive animate-pulse')}>
                        <Clock className="h-5 w-5" />
                        <span>{formatTimeLeft()}</span>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-8 p-4 md:p-6">
                {currentQuestions.map((question, index) => {
                    const questionNumber = currentPage * questionsPerPage + index + 1;
                    return (
                        <div key={question.id} className="p-4 border-t">
                            <div className="flex justify-between items-start">
                                <Label className="font-bold text-base mb-4 block">Question {questionNumber}: {question.text}</Label>
                                <Button variant={flagged[question.id] ? "destructive" : "outline"} size="sm" onClick={() => handleFlagQuestion(question.id)}>
                                    <Flag className="h-4 w-4 mr-2"/>
                                    Flag for Review
                                </Button>
                            </div>
                            <div className="mt-4">
                                {question.type === 'multiple-choice' ? (
                                    <RadioGroup onValueChange={(value) => handleAnswerChange(question.id, value)} value={answers[question.id]}>
                                        {(question.options || []).map(option => (
                                            <div key={option.id} className="flex items-center space-x-2">
                                                <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                                                <Label htmlFor={`${question.id}-${option.id}`}>{option.text}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                ) : (
                                    <Textarea placeholder="Type your answer here..." onChange={(e) => handleAnswerChange(question.id, e.target.value)} value={answers[question.id] || ''} />
                                )}
                            </div>
                        </div>
                    )
                })}
            </CardContent>
            <CardFooter className="justify-between p-4 border-t">
                <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>
                    <ChevronLeft className="mr-2 h-4 w-4"/> Previous
                </Button>

                <span className="text-sm text-muted-foreground">Page {currentPage + 1} of {totalPages}</span>

                {currentPage < totalPages - 1 ? (
                     <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)}>
                        Next <ChevronRight className="ml-2 h-4 w-4"/>
                    </Button>
                ) : (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={submitting}>Submit Quiz</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-2xl">
                            <AlertDialogHeader><AlertDialogTitle>Confirm Submission</AlertDialogTitle><AlertDialogDescription>Review your answers below. You can click on a question number to jump to it.</AlertDialogDescription></AlertDialogHeader>
                            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 py-4">
                                {allQuestions.map((q, i) => {
                                    const isAnswered = !!answers[q.id]?.trim();
                                    const isFlagged = !!flagged[q.id];
                                    return (
                                        <Button
                                            key={q.id}
                                            variant={isFlagged ? 'destructive' : isAnswered ? 'default' : 'outline'}
                                            size="icon"
                                            onClick={() => {
                                                const pageIndex = Math.floor(i / questionsPerPage);
                                                setCurrentPage(pageIndex);
                                                const cancel = document.querySelector('[aria-label="Cancel"]');
                                                if(cancel instanceof HTMLElement) cancel.click();
                                            }}
                                        >
                                            {i + 1}
                                        </Button>
                                    )
                                })}
                            </div>
                             <div className="flex justify-center gap-4 text-sm">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-primary"/> Answered</span>
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-destructive"/> Flagged</span>
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border"/> Unanswered</span>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Review Answers</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleSubmit()}>Yes, Submit Quiz</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </CardFooter>
        </Card>
    );
}

    