
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Book, Users, ClipboardList, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { List, ListItem } from '@/components/ui/list';
import Link from 'next/link';

interface Course {
  id: string;
  title: string;
  code: string;
}

const DashboardCardSkeleton = () => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-2/4" />
            <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-7 w-1/4" />
        </CardContent>
    </Card>
);

const ListSkeleton = () => (
    <div className="space-y-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
    </div>
)

export default function StaffDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [instructorName, setInstructorName] = useState('');
  const [taughtCourses, setTaughtCourses] = useState<Course[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    if(user?.displayName) {
        setInstructorName(user.displayName);
    }
  }, [user]);

  useEffect(() => {
    if (!instructorName) {
        if(!authLoading && !user) setLoading(false);
        return;
    };

    const coursesRef = ref(db, 'courses');
    const coursesListener = onValue(coursesRef, async (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const courseList: Course[] = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(course => course.instructor === instructorName);
            setTaughtCourses(courseList);

            // Calculate total unique students
            if (courseList.length > 0) {
                const courseIds = courseList.map(c => c.id);
                const usersRef = ref(db, 'users');
                const usersSnapshot = await get(usersRef);
                const allUsers = usersSnapshot.val();
                if (allUsers) {
                    const studentSet = new Set();
                    Object.entries(allUsers).forEach(([userId, userData]: [string, any]) => {
                        if (userData.role === 'student' && userData.enrolledCourses) {
                            const isEnrolled = courseIds.some(cid => userData.enrolledCourses[cid]);
                            if (isEnrolled) {
                                studentSet.add(userId);
                            }
                        }
                    });
                    setTotalStudents(studentSet.size);
                }
            } else {
                 setTotalStudents(0);
            }
        } else {
            setTaughtCourses([]);
            setTotalStudents(0);
        }
        setLoading(false);
    });

    return () => off(coursesRef, 'value', coursesListener);
  }, [instructorName, authLoading, user]);


  if (loading) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <DashboardCardSkeleton />
                <DashboardCardSkeleton />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent>
                    <ListSkeleton />
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold">Welcome, {instructorName || 'Staff Member'}!</h1>
            <p className="text-muted-foreground">Here's a summary of your current teaching responsibilities.</p>
        </div>
      
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Courses Taught
                    </CardTitle>
                    <Book className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{taughtCourses.length}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Total Students
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalStudents}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>My Courses</CardTitle>
                <CardDescription>A list of all courses you are currently instructing.</CardDescription>
            </CardHeader>
            <CardContent>
                {taughtCourses.length > 0 ? (
                    <List>
                        {taughtCourses.map(course => (
                            <ListItem key={course.id}>
                                <BookOpen className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                    <p className="font-medium">{course.title}</p>
                                    <p className="text-sm text-muted-foreground">{course.code}</p>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href="/staff/assignments">Manage</Link>
                                </Button>
                            </ListItem>
                        ))}
                    </List>
                ) : (
                    <div className="text-center text-muted-foreground py-6">
                        You are not currently assigned to any courses.
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
