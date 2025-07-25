
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Book, CheckCircle, Clock, DollarSign, FileText, PenSquare, BookCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { differenceInDays } from 'date-fns';

const DashboardCardSkeleton = () => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-2/4" />
            <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-7 w-1/4" />
            <Skeleton className="h-3 w-3/4 mt-2" />
        </CardContent>
    </Card>
)

export default function StudentDashboard() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<number>(0);
  const [availableQuizzes, setAvailableQuizzes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentId = async () => {
        if (user) {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                const users = snapshot.val();
                const foundEntry = Object.entries(users).find(([, userData]: [string, any]) => userData.uid === user.uid);
                if (foundEntry) {
                    setStudentId(foundEntry[0]);
                } else {
                  setLoading(false);
                }
            } else {
              setLoading(false);
            }
        }
    };
    fetchStudentId();
  }, [user]);
  
  useEffect(() => {
    if (!studentId) return;

    const enrolledRef = ref(db, `users/${studentId}/enrolledCourses`);
    const assignmentsRef = ref(db, 'assignments');
    const quizzesRef = ref(db, 'quizzes');

    let courseIds: string[] = [];

    const enrolledListener = onValue(enrolledRef, (snapshot) => {
        const data = snapshot.val();
        courseIds = data ? Object.keys(data) : [];
        setEnrolledCourses(courseIds);

        // Fetch assignments for the enrolled courses
        onValue(assignmentsRef, (assignmentSnapshot) => {
            const assignmentsData = assignmentSnapshot.val() || {};
            const now = new Date();
            const upcoming = Object.values(assignmentsData).filter((assignment: any) => {
                const dueDate = new Date(assignment.dueDate);
                const daysUntilDue = differenceInDays(dueDate, now);
                return courseIds.includes(assignment.courseId) && daysUntilDue >= 0 && daysUntilDue <= 7;
            }).length;
            setUpcomingAssignments(upcoming);
        });

        // Fetch quizzes for the enrolled courses
        onValue(quizzesRef, (quizSnapshot) => {
            const quizzesData = quizSnapshot.val() || {};
            const available = Object.values(quizzesData).filter((quiz: any) => courseIds.includes(quiz.courseId)).length;
            setAvailableQuizzes(available);
        });
        
        setLoading(false);
    });

    return () => {
        off(enrolledRef, 'value', enrolledListener);
        off(assignmentsRef);
        off(quizzesRef);
    };

  }, [studentId]);


  if (loading) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <DashboardCardSkeleton key={i} />)}
            </div>
        </div>
    )
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, Student!</h1>
      <p className="text-muted-foreground">Here's a quick overview of your academic progress.</p>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              My Courses
            </CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enrolledCourses.length}</div>
            <p className="text-xs text-muted-foreground">
              courses enrolled this semester
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Upcoming Assignments
            </CardTitle>
            <PenSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAssignments}</div>
            <p className="text-xs text-muted-foreground">
              due within the next 7 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Available Quizzes
            </CardTitle>
            <BookCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableQuizzes}</div>
            <p className="text-xs text-muted-foreground">
              quizzes ready to be taken
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Attendance
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">95%</div>
            <p className="text-xs text-muted-foreground">
              overall attendance (mock)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Payments
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Paid</div>
            <p className="text-xs text-muted-foreground">
              Tuition is up to date (mock)
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Library Books
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              book due for return (mock)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
