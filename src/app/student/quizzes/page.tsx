
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, HelpCircle, Clock, ChevronRight } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';

type Quiz = {
    id: string;
    title: string;
    description: string;
    timeLimit: number;
    sections: any[];
};

type Submission = {
    score?: number;
    totalQuestions?: number;
    status: 'completed' | 'in-progress';
};

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = React.useState<(Quiz & { submission?: Submission })[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    onAuthStateChanged(auth, (user) => {
        if(user) setCurrentUser(user);
        else setLoading(false);
    });
  }, []);

  React.useEffect(() => {
    if(!currentUser) return;
    const quizzesRef = ref(db, 'quizzes');
    const onValueChange = onValue(quizzesRef, async (snapshot) => {
        setLoading(true);
        if (snapshot.exists()) {
            const data = snapshot.val();
            const quizList: Quiz[] = Object.keys(data).map(id => ({ id, ...data[id] }));
            
            const submissionsSnap = await get(ref(db, `quizSubmissions`));
            const submissionsData = submissionsSnap.exists() ? submissionsSnap.val() : {};

            const quizzesWithSubmissions = quizList.map(quiz => {
                const submission = submissionsData[quiz.id]?.[currentUser.uid];
                return { ...quiz, submission };
            });

            setQuizzes(quizzesWithSubmissions);
        } else {
            setQuizzes([]);
        }
        setLoading(false);
    });
    return () => onValueChange();
  }, [currentUser]);

  if (loading) {
      return (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      )
  }

  return (
    <div className="space-y-6">
       <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Quizzes & Exams</CardTitle>
            <CardDescription>Test your knowledge. Select a quiz to begin.</CardDescription>
          </CardHeader>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {quizzes.map((quiz) => {
            const totalQuestions = quiz.sections.reduce((acc, section) => acc + section.questions.length, 0);
            const isCompleted = quiz.submission?.status === 'completed';

            return (
              <Card key={quiz.id} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="font-headline">{quiz.title}</CardTitle>
                  <CardDescription>{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-around text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      <span>{totalQuestions} Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{quiz.timeLimit} mins</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center bg-muted/50 px-6 py-4">
                  {isCompleted ? (
                    <div className="font-semibold">
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="text-lg text-primary">{quiz.submission?.score !== undefined ? `${quiz.submission.score} / ${quiz.submission.totalQuestions}` : 'Graded'}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-muted-foreground">Not Started</p>
                  )}
                   <Button asChild disabled={isCompleted}>
                        <Link href={`/student/quizzes/${quiz.id}`}>
                            {isCompleted ? 'View Results' : 'Start Quiz'}
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardFooter>
              </Card>
            )
        })}
      </div>
    </div>
  );
}

