
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, HelpCircle, Clock, ChevronRight, Info } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Quiz = {
    id: string;
    title: string;
    description: string;
    timeLimit: number;
    sections: any[];
    courseId: string;
    semesterId: string;
};

type Course = {
    id: string;
    name: string;
    code: string;
};

type Semester = {
    id: string;
    name: string;
    status: 'Open' | 'Closed' | 'Archived';
}

type Submission = {
    score?: number;
    totalQuestions?: number;
    status: 'completed' | 'in-progress';
};

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = React.useState<(Quiz & { submission?: Submission, course?: Course })[]>([]);
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
    
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all necessary data in parallel
            const [
                coursesSnap,
                semestersSnap,
                registrationsSnap,
                quizzesSnap,
                submissionsSnap
            ] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'semesters')),
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'quizzes')),
                get(ref(db, `quizSubmissions`))
            ]);

            const allCourses = coursesSnap.exists() ? coursesSnap.val() : {};
            const allSemesters = semestersSnap.exists() ? semestersSnap.val() : {};
            const allQuizzes = quizzesSnap.exists() ? quizzesSnap.val() : {};
            const allSubmissions = submissionsSnap.exists() ? submissionsSnap.val() : {};
            
            const enrolledCourseIds = new Set<string>();
            if (registrationsSnap.exists()) {
                const registrations = registrationsSnap.val();
                for (const semesterId in registrations) {
                    const registration = registrations[semesterId];
                    const semesterDetails = allSemesters[semesterId];
                    if (registration.status === 'Completed' && semesterDetails && semesterDetails.status !== 'Archived') {
                        registration.courses.forEach((courseId: string) => enrolledCourseIds.add(courseId));
                    }
                }
            }

            const relevantQuizzes: (Quiz & { submission?: Submission, course?: Course })[] = [];
            for (const quizId in allQuizzes) {
                const quiz = allQuizzes[quizId];
                if (enrolledCourseIds.has(quiz.courseId)) {
                    const submission = allSubmissions[quizId]?.[currentUser.uid];
                    relevantQuizzes.push({
                        ...quiz,
                        id: quizId,
                        submission: submission,
                        course: allCourses[quiz.courseId]
                    });
                }
            }
            
            setQuizzes(relevantQuizzes);
        } catch (error) {
            console.error("Failed to fetch quizzes:", error);
        } finally {
            setLoading(false);
        }
    };
    
    fetchData();

  }, [currentUser]);

  if (loading) {
      return (
          <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
            </Card>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
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
      
      {quizzes.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => {
                const totalQuestions = quiz.sections.reduce((acc, section) => acc + section.questions.length, 0);
                const isCompleted = quiz.submission?.status === 'completed';

                return (
                <Card key={quiz.id} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl">
                    <CardHeader>
                    <CardTitle className="font-headline">{quiz.title}</CardTitle>
                    <CardDescription>{quiz.course?.name || 'Unknown Course'} ({quiz.course?.code || ''})</CardDescription>
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
                        <p className="text-lg text-primary">{quiz.submission?.score !== undefined ? `${quiz.submission.score} / ${quiz.submission.totalQuestions}` : 'Awaiting Grading'}</p>
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
      ) : (
        <Card>
            <CardContent className="pt-6">
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Quizzes Available</AlertTitle>
                    <AlertDescription>
                        There are no quizzes available for your enrolled courses at this time.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
