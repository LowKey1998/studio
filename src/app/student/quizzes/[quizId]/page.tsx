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
    linkedComponentId?: string;
    courseIds?: string[];
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
        if(!currentUser || !quiz || submitting) return;
        setSubmitting(true);
        const submissionRef = ref(db, `quizSubmissions/${quizId}/${currentUser.uid}`);
        
        try {
            const submissionData: any = { status: 'completed', submittedAt: new Date().toISOString() };
            let calculatedScore = 0;

            if (quiz.isMultipleChoiceOnly) {
                allQuestions.forEach(q => {
                    if (q.type === 'multiple-choice' && answers[q.id] === q.correctAnswer) {
                        calculatedScore++;
                    }
                });
                submissionData.score = calculatedScore;
                submissionData.totalQuestions = allQuestions.length;
                setFinalScore(calculatedScore);
                setShowResults(true);

                // --- Sync with Assessment Record if linked ---
                if (quiz.linkedComponentId && quiz.courseIds?.[0]) {
                    const courseId = quiz.courseIds[0];
                    const percentageScore = Math.round((calculatedScore / allQuestions.length) * 100);
                    
                    // Identify active semester for the student
                    const regsSnap = await get(ref(db, `registrations/${currentUser.uid}`));
                    const allRegs = regsSnap.val() || {};
                    let activeSemId = null;
                    
                    for (const semId in allRegs) {
                        if (allRegs[semId].courses?.includes(courseId)) {
                            activeSemId = semId;
                            break;
                        }
                    }

                    if (activeSemId) {
                        await update(ref(db, `assessments/${activeSemId}/${courseId}/${currentUser.uid}/${quiz.linkedComponentId}`), {
                            score: percentageScore,
                            feedback: `Automatically graded from Online Exam: ${quiz.title}`,
                            updatedAt: serverTimestamp()
                        });
                    }
                }
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
    }, [allQuestions, answers, currentUser, quiz, quizId, router, submitting, toast]);

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
                <Card className="max-w-2xl mx-auto shadow-2xl border-t-4 border-t-primary">
                    <CardHeader className="text-center">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-headline">Quiz Completed!</CardTitle>
                        <CardDescription>Your automated score has been recorded.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <div className="p-8 rounded-xl bg-muted/30 border-2 border-dashed">
                            <p className="text-6xl font-black text-primary">{finalScore} / {allQuestions.length}</p>
                            <p className="text-xl font-bold text-muted-foreground mt-2">{((finalScore / allQuestions.length) * 100).toFixed(0)}%</p>
                        </div>
                        {quiz?.linkedComponentId && (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700 text-xs font-bold uppercase">This result has been synchronized with your academic gradebook.</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full font-bold h-12" onClick={() => router.push('/student/quizzes')}>Return to Assessments</Button>
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
        <Card className="max-w-4xl mx-auto shadow-xl">
            <CardHeader className="flex flex-row justify-between items-center sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 border-b">
                <CardTitle className="text-xl md:text-2xl font-headline">{quiz?.title}</CardTitle>
                {timeLeft !== null && (
                    <div className={cn("flex items-center gap-2 font-black p-2 px-4 rounded-full border shadow-sm", timeLeft <= 60 ? 'text-destructive bg-destructive/10 animate-pulse border-destructive/20' : 'bg-primary/5 text-primary border-primary/10')}>
                        <Clock className="h-5 w-5" />
                        <span className="font-mono">{formatTimeLeft()}</span>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-8 p-4 md:p-8">
                {currentQuestions.map((question, index) => {
                    const questionNumber = currentPage * questionsPerPage + index + 1;
                    const isFlagged = !!flagged[question.id];
                    return (
                        <div key={question.id} className={cn("p-6 border rounded-2xl transition-all", isFlagged ? "bg-red-50/30 border-red-200" : "bg-card")}>
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <Badge variant="outline" className="font-black uppercase text-[10px] tracking-widest opacity-60">Question {questionNumber}</Badge>
                                    <Label className="font-bold text-lg leading-relaxed block">{question.text}</Label>
                                </div>
                                <Button 
                                    variant={isFlagged ? "destructive" : "outline"} 
                                    size="sm" 
                                    onClick={() => handleFlagQuestion(question.id)}
                                    className="h-8 text-[10px] font-black uppercase"
                                >
                                    <Flag className="h-3 w-3 mr-1.5"/>
                                    {isFlagged ? 'Flagged' : 'Flag'}
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {question.type === 'multiple-choice' ? (
                                    <RadioGroup onValueChange={(value) => handleAnswerChange(question.id, value)} value={answers[question.id]} className="grid gap-3">
                                        {(question.options || []).map(option => (
                                            <div key={option.id} className={cn(
                                                "flex items-center space-x-3 p-4 rounded-xl border transition-all cursor-pointer hover:bg-muted/50",
                                                answers[question.id] === option.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                                            )}>
                                                <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                                                <Label htmlFor={`${question.id}-${option.id}`} className="flex-1 cursor-pointer font-medium text-sm leading-snug">{option.text}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                ) : (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-black opacity-60">Your Answer</Label>
                                        <Textarea placeholder="Type your full answer here..." onChange={(e) => handleAnswerChange(question.id, e.target.value)} value={answers[question.id] || ''} className="min-h-[120px]" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </CardContent>
            <CardFooter className="justify-between p-6 border-t bg-muted/5">
                <Button variant="outline" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>
                    <ChevronLeft className="mr-2 h-4 w-4"/> Previous
                </Button>

                <div className="flex flex-col items-center">
                    <span className="text-xs font-black uppercase text-muted-foreground tracking-tighter opacity-60 mb-1">Navigation</span>
                    <div className="flex items-center gap-1.5">
                        {Array.from({length: totalPages}).map((_, i) => (
                            <div key={i} className={cn("h-1.5 rounded-full transition-all", i === currentPage ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
                        ))}
                    </div>
                </div>

                {currentPage < totalPages - 1 ? (
                     <Button variant="outline" onClick={() => setCurrentPage(p => p + 1)}>
                        Next <ChevronRight className="ml-2 h-4 w-4"/>
                    </Button>
                ) : (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={submitting} className="font-bold shadow-lg px-8">Submit Finished Exam</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline text-2xl">Ready to Submit?</AlertDialogTitle>
                                <AlertDialogDescription>Review your completion status below. You can click any number to jump back to that question.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 py-6">
                                {allQuestions.map((q, i) => {
                                    const isAnswered = !!answers[q.id]?.trim();
                                    const isFlagged = !!flagged[q.id];
                                    return (
                                        <Button
                                            key={q.id}
                                            variant={isFlagged ? 'destructive' : isAnswered ? 'default' : 'outline'}
                                            size="icon"
                                            className={cn("h-10 w-10 text-[10px] font-black", !isAnswered && !isFlagged && "border-dashed opacity-40")}
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
                             <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest border-t pt-4">
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary"/> Answered</span>
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-destructive"/> Flagged</span>
                                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-dashed opacity-40"/> Unanswered</span>
                            </div>
                            <AlertDialogFooter className="mt-6">
                                <AlertDialogCancel className="font-bold">Return to Review</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleSubmit()} className="bg-primary hover:bg-primary/90 font-bold shadow-md">Yes, Finalize Submission</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </CardFooter>
        </Card>
    );
}
