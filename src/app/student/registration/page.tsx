
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

interface Course {
  id: string;
  title: string;
  code: string;
  instructor: string;
}

const RegistrationSkeleton = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
        <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
        <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
    </TableRow>
)

export default function StudentRegistrationPage() {
    const { user, loading: authLoading } = useAuth();
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        };

        const fetchEnrolledCourses = async () => {
            // First, find the student's custom ID
            const usersRef = ref(db, 'users');
            const usersSnapshot = await get(usersRef);
            if (!usersSnapshot.exists()) {
                setLoading(false);
                return;
            }
            const users = usersSnapshot.val();
            const studentEntry = Object.entries(users).find(([, u]: [string, any]) => u.uid === user.uid);
            
            if (!studentEntry) {
                 setLoading(false);
                 return;
            }
            const studentId = studentEntry[0];

            // Now listen for enrolled courses
            const enrolledRef = ref(db, `users/${studentId}/enrolledCourses`);
            const coursesRef = ref(db, 'courses');

            onValue(enrolledRef, async (enrolledSnapshot) => {
                const enrolledData = enrolledSnapshot.val();
                if (enrolledData) {
                    const courseIds = Object.keys(enrolledData);
                    const coursesSnapshot = await get(coursesRef);
                    const allCourses = coursesSnapshot.val();
                    if(allCourses) {
                        const studentCourses = courseIds.map(id => ({
                            id,
                            ...allCourses[id]
                        }));
                        setEnrolledCourses(studentCourses);
                    }
                } else {
                    setEnrolledCourses([]);
                }
                setLoading(false);
            });
        };

        fetchEnrolledCourses();

    }, [user, authLoading]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Registered Courses</CardTitle>
          <CardDescription>This is a list of all the courses you are currently enrolled in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Title</TableHead>
                <TableHead>Course Code</TableHead>
                <TableHead>Instructor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <RegistrationSkeleton key={i} />)
              ) : enrolledCourses.length > 0 ? (
                enrolledCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.title}</TableCell>
                      <TableCell><Badge variant="secondary">{course.code}</Badge></TableCell>
                      <TableCell>Prof. {course.instructor}</TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    You are not enrolled in any courses.
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
