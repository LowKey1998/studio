'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileQuestion, HelpCircle, Clock, ChevronRight, Info, CalendarDays, Search } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import Link from 'next/link';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type Quiz = {
    id: string;
    title: string;
    description: string;
    endTime?: string;
    sections: any[];
    courseIds: string[];
    intakeIds: string[];
    programmeIds: string[];
    semesterIds?: string[];
};

type Course = {
    id: string;
    name: string;
    code: string;
};

type UserProfile = {
    intakeId: string;
    programmeId: string;
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
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [academicStanding, setAcademicStanding] = React.useState<string>('');
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const { toast } = useToast();

  React.useEffect(() => {
    onAuthStateChanged(auth, (user) => {
        if(user) {
            setCurrentUser(user);
            get(ref(db, `users/${user.uid}`)).then(snap => {
                if(snap.exists()) setUserProfile(snap.val());
            })
        }
        else setLoading(false);
    });
  }, []);

  const fetchQuizzesData = React.useCallback(async () => {
    if(!currentUser || !userProfile) return;
    
    setLoading(true);
    try {
        // Fetch all necessary data in parallel
        const [
            coursesSnap,
            quizzesSnap,
            submissionsSnap,
            calendarSnap,
            semestersSnap,
            intakesSnap,
            regsSnap
        ] = await Promise.all([
            get(ref(db, 'courses')),
            get(ref(db, 'quizzes')),
            get(ref(db, `quizSubmissions`)),
            get(ref(db, 'settings/academicCalendar')),
            get(ref(db, 'semesters')),
            get(ref(db, 'intakes')),
            get(ref(db, `registrations/${currentUser.uid}`))
        ]);

        const allCourses = coursesSnap.exists() ? coursesSnap.val() : {};
        const allQuizzes = quizzesSnap.exists() ? quizzesSnap.val() : {};
        const allSubmissions = submissionsSnap.exists() ? submissionsSnap.val() : {};
        const calSettings = calendarSnap.val() || {};
        const allSemesters = semestersSnap.val() || {};
        const allIntakes = intakesSnap.val() || {};
        const allRegs = regsSnap.val() || {};

        // 1. Calculate Standing
        const intakeName = allIntakes[userProfile.intakeId]?.name;
        const intakeStartStr = intakeName ? parseIntakeDate(intakeName) : null;
        let currentSemesterId: string | null = null;

        if (intakeStartStr && calSettings) {
            const state = calculateAcademicState(
                intakeStartStr,
                new Date(),
                calSettings.standardCycles,
                Object.values(calSettings.anomalies || {})
            );
            setAcademicStanding(`Year ${state.year}, Sem ${state.semester}`);

            const matched = Object.entries(allSemesters).find(([_, s]: [string, any]) => 
                s.intakeId === userProfile.intakeId && 
                s.year === state.year && 
                s.semesterInYear === state.semester
            );
            currentSemesterId = matched ? matched[0] : null;
        }

        if (!currentSemesterId) {
            setQuizzes([]);
            setLoading(false);
            return;
        }

        // 2. Identify Enrolled Courses for current standing
        const currentReg = allRegs[currentSemesterId];
        const enrolledCourseIds = new Set<string>();
        if (currentReg && (currentReg.status === 'Completed' || currentReg.status === 'Pending Payment')) {
            const coursesArr = Array.isArray(currentReg.courses) ? currentReg.courses : Object.keys(currentReg.courses || {});
            coursesArr.forEach((cid: string) => enrolledCourseIds.add(cid));
        }

        // 3. Filter Quizzes
        const relevantQuizzes: (Quiz & { submission?: Submission, course?: Course })[] = [];
        for (const quizId in allQuizzes) {
            const quiz = allQuizzes[quizId];

            const matchesAudience = 
                quiz.programmeIds?.includes(userProfile.programmeId) &&
                quiz.intakeIds?.includes(userProfile.intakeId);

            if (matchesAudience) {
                // If quiz is specifically for certain courses, check if student is currently enrolled in any of them
                let matchesEnrollment = true;
                if (quiz.courseIds && quiz.courseIds.length > 0) {
                    matchesEnrollment = quiz.courseIds.some((cid: string) => enrolledCourseIds.has(cid));
                }

                // If quiz is specifically for certain semesters, check if it's the current one
                let matchesSemester = true;
                if (quiz.semesterIds && quiz.semesterIds.length > 0) {
                    matchesSemester = quiz.semesterIds.includes(currentSemesterId);
                }

                if (matchesEnrollment && matchesSemester) {
                    const submission = allSubmissions[quizId]?.[currentUser.uid];
                    relevantQuizzes.push({
                        ...quiz,
                        id: quizId,
                        submission: submission,
                        course: quiz.courseIds ? allCourses[quiz.courseIds[0]] : undefined
                    });
                }
            }
        }
        
        setQuizzes(relevantQuizzes);
    } catch (error) {
        console.error("Failed to fetch quizzes:", error);
    } finally {
        setLoading(false);
    }
  }, [currentUser, userProfile]);
  
  React.useEffect(() => {
    if (currentUser && userProfile) {
        fetchQuizzesData();
    }
  }, [currentUser, userProfile, fetchQuizzesData]);

  const filteredQuizzes = quizzes.filter(q => q.title.toLowerCase().includes(searchTerm.toLowerCase()));

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
       <Card className="shadow-lg border-0 bg-primary/5">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <CardTitle className="font-headline text-2xl">Quizzes & Exams</CardTitle>
                    <CardDescription>Select an assessment from your current academic standing to begin.</CardDescription>
                </div>
                {academicStanding && (
                    <Badge variant="secondary" className="w-fit gap-2 h-10 px-4 text-sm font-bold border-primary/20 bg-primary/5">
                        <CalendarDays className="h-4 w-4" />
                        Standing: {academicStanding}
                    </Badge>
                )}
            </div>
          </CardHeader>
      </Card>
      
      <div className="flex gap-4">
          <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search quizzes..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
      </div>

      {filteredQuizzes.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredQuizzes.map((quiz) => {
                const totalQuestions = quiz.sections?.reduce((acc, section) => acc + (section.questions?.length || 0), 0) || 0;
                const isCompleted = quiz.submission?.status === 'completed';

                return (
                <Card key={quiz.id} className="flex flex-col justify-between shadow-lg transition-all duration-300 hover:shadow-xl border-t-2 border-t-primary/10">
                    <CardHeader>
                    <CardTitle className="font-headline text-lg">{quiz.title}</CardTitle>
                    <CardDescription className="line-clamp-1">{quiz.course?.name || 'General Assessment'} ({quiz.course?.code || ''})</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{quiz.description}</p>
                        <div className="flex justify-around text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-primary" />
                                <span>{totalQuestions} Questions</span>
                            </div>
                            {quiz.endTime && (
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    <span>Ends: {format(parseISO(quiz.endTime), 'HH:mm')}</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between items-center bg-muted/50 px-6 py-4">
                    {isCompleted ? (
                        <div className="font-semibold">
                            <p className="text-[10px] uppercase font-black text-muted-foreground">Score</p>
                            <p className="text-lg font-black text-primary">{quiz.submission?.score !== undefined ? `${quiz.submission.score} / ${quiz.submission.totalQuestions}` : 'Awaiting Grade'}</p>
                        </div>
                    ) : (
                        <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">Available</p>
                    )}
                    <Button asChild disabled={isCompleted && quiz.submission?.score === undefined} className="shadow-md">
                            <Link href={`/student/quizzes/${quiz.id}`}>
                                {isCompleted ? 'View Results' : 'Start Assessment'}
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
                )
            })}
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-muted/10">
            <CardContent className="pt-16 pb-16 flex flex-col items-center text-center">
                <FileQuestion className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                <h3 className="text-lg font-bold">No Active Assessments</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                    There are no quizzes or exams available for your current Year/Semester standing.
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
