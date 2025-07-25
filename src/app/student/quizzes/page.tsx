
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, PlayCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';

interface Quiz {
  id: string;
  title: string;
  courseId: string;
  timeLimit: number;
  description: string;
}

interface Course {
    id: string;
    title: string;
}

interface EnrichedQuiz extends Quiz {
    courseTitle: string;
}

const QuizSkeleton = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
        <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
        <TableCell><Skeleton className="h-10 w-28" /></TableCell>
    </TableRow>
)

export default function StudentQuizzesPage() {
    const [quizzes, setQuizzes] = useState<EnrichedQuiz[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const quizzesRef = ref(db, 'quizzes');
        const coursesRef = ref(db, 'courses');

        let coursesData: { [key: string]: Course } = {};

        const coursesListener = onValue(coursesRef, (snapshot) => {
            coursesData = snapshot.val() || {};
            // Rerun the quizzes listener if it already ran to enrich the data
            if(!loading) {
                onValue(quizzesRef, (quizSnapshot) => {
                    const quizzesData = quizSnapshot.val();
                    if (quizzesData && coursesData) {
                        const enrichedList = Object.keys(quizzesData).map(key => {
                            const quiz = { id: key, ...quizzesData[key]};
                            return {
                                ...quiz,
                                courseTitle: coursesData[quiz.courseId]?.title || 'Unknown Course'
                            }
                        });
                        setQuizzes(enrichedList);
                    } else {
                        setQuizzes([]);
                    }
                    setLoading(false);
                }, { onlyOnce: true });
            }
        });

        const quizzesListener = onValue(quizzesRef, (snapshot) => {
            const quizzesData = snapshot.val();
            if (quizzesData && Object.keys(coursesData).length > 0) {
                 const enrichedList = Object.keys(quizzesData).map(key => {
                    const quiz = { id: key, ...quizzesData[key]};
                    return {
                        ...quiz,
                        courseTitle: coursesData[quiz.courseId]?.title || 'Unknown Course'
                    }
                });
                setQuizzes(enrichedList);
            } else if (!quizzesData) {
                 setQuizzes([]);
            }
            setLoading(false);
        });

        return () => {
            off(quizzesRef, 'value', quizzesListener);
            off(coursesRef, 'value', coursesListener);
        };
    }, [loading]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Quizzes</CardTitle>
          <CardDescription>Here is a list of your available quizzes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Time Limit</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <QuizSkeleton key={i} />)
              ) : quizzes.length > 0 ? (
                quizzes
                 .map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-medium">{quiz.title}</TableCell>
                      <TableCell>{quiz.courseTitle}</TableCell>
                      <TableCell>
                          <Badge variant="secondary">
                            {quiz.timeLimit} minutes
                          </Badge>
                      </TableCell>
                      <TableCell>
                        <Button>
                           <PlayCircle className="mr-2 h-4 w-4" />
                            Start Quiz
                        </Button>
                      </TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No quizzes found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
