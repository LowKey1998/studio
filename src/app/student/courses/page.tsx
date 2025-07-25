
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookOpen, Search, Check, Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, off, set, get } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Course {
  id: string;
  title: string;
  code: string;
  instructor: string;
  description: string;
}

const CourseCardSkeleton = () => (
    <Card className="flex flex-col">
        <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/4" />
        </CardHeader>
        <CardContent className="flex-grow">
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-5/6" />
        </CardContent>
        <CardFooter className="flex justify-between items-center">
             <Skeleton className="h-5 w-24" />
             <Skeleton className="h-10 w-28" />
        </CardFooter>
    </Card>
);

export default function CoursesPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [courses, setCourses] = useState<Course[]>([]);
    const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [studentId, setStudentId] = useState<string | null>(null);
    const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
    const [registeringCourseId, setRegisteringCourseId] = useState<string | null>(null);

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
                    }
                }
            }
        };
        if (!authLoading) {
            fetchStudentId();
        }
    }, [user, authLoading]);

    useEffect(() => {
        if (!studentId) return;

        const enrolledRef = ref(db, `users/${studentId}/enrolledCourses`);
        const listener = onValue(enrolledRef, (snapshot) => {
            const data = snapshot.val();
            setEnrolledCourses(data ? Object.keys(data) : []);
        });

        return () => off(enrolledRef, 'value', listener);
    }, [studentId]);

    useEffect(() => {
        const coursesRef = ref(db, 'courses');

        const listener = onValue(coursesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const courseList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setCourses(courseList);
                setFilteredCourses(courseList);
            } else {
                setCourses([]);
                setFilteredCourses([]);
            }
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        return () => {
            off(coursesRef, 'value', listener);
        };
    }, []);

    useEffect(() => {
        const results = courses.filter(course =>
            course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            course.instructor.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredCourses(results);
    }, [searchTerm, courses]);

    const handleRegister = async (courseId: string) => {
        if (!studentId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not identify student.' });
            return;
        }
        setRegisteringCourseId(courseId);
        try {
            const enrollmentRef = ref(db, `users/${studentId}/enrolledCourses/${courseId}`);
            await set(enrollmentRef, true);
            toast({ title: 'Success', description: 'Successfully registered for the course!' });
        } catch (error) {
            console.error("Registration failed:", error);
            toast({ variant: 'destructive', title: 'Registration Failed', description: 'Could not register for the course.' });
        } finally {
            setRegisteringCourseId(null);
        }
    };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Course Catalog</CardTitle>
          <CardDescription>Browse available courses and enroll for the upcoming semester.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search by course title, code, or instructor..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {loading ? (
                Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)
            ) : filteredCourses.length > 0 ? (
                filteredCourses.map((course) => {
                    const isEnrolled = enrolledCourses.includes(course.id);
                    const isRegistering = registeringCourseId === course.id;
                    return (
                        <Card key={course.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle>{course.title}</CardTitle>
                                <CardDescription>
                                    <Badge variant="secondary">{course.code}</Badge>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                               <p className="text-sm text-muted-foreground">{course.description}</p>
                            </CardContent>
                            <CardFooter className="flex justify-between items-center mt-4">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Prof. {course.instructor}
                                </p>
                                <Button onClick={() => handleRegister(course.id)} disabled={isEnrolled || isRegistering}>
                                    {isRegistering ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : isEnrolled ? (
                                        <Check className="mr-2 h-4 w-4" />
                                    ) : (
                                        <BookOpen className="mr-2 h-4 w-4" />
                                    )}
                                    {isEnrolled ? 'Enrolled' : 'Register'}
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })
            ) : (
                <div className="col-span-full text-center py-10">
                    <p className="text-muted-foreground">No courses found. The course catalog is currently empty.</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

