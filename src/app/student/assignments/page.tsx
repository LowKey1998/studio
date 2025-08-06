
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import { format, isPast, differenceInDays, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

interface Assignment {
  id: string;
  title: string;
  courseId: string;
  dueDate: string;
  description: string;
}

interface Course {
    id: string;
    title: string;
}

interface EnrichedAssignment extends Assignment {
    courseTitle: string;
}

const AssignmentSkeleton = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
        <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
        <TableCell><Skeleton className="h-10 w-24" /></TableCell>
    </TableRow>
)

export default function StudentAssignmentsPage() {
    const { user, loading: authLoading } = useAuth();
    const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);

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
            } else if (!authLoading) {
                setLoading(false);
            }
        };
        fetchStudentId();
    }, [user, authLoading]);

    useEffect(() => {
        if (!studentId) return;

        const enrolledRef = ref(db, `users/${studentId}/enrolledCourses`);
        const listener = onValue(enrolledRef, (snapshot) => {
            const data = snapshot.val();
            setEnrolledCourseIds(data ? Object.keys(data) : []);
        });

        return () => off(enrolledRef, 'value', listener);
    }, [studentId]);


    useEffect(() => {
        if (authLoading || enrolledCourseIds.length === 0) {
            if (!authLoading) setLoading(false);
            return;
        }

        const assignmentsRef = ref(db, 'assignments');
        const coursesRef = ref(db, 'courses');

        const listener = onValue(assignmentsRef, async (assignmentSnapshot) => {
            const assignmentsData = assignmentSnapshot.val() || {};
            
            const coursesSnapshot = await get(coursesRef);
            const coursesData = coursesSnapshot.val() || {};

            const filteredAssignments = Object.keys(assignmentsData)
                .map(key => ({ id: key, ...assignmentsData[key] }))
                .filter(assignment => enrolledCourseIds.includes(assignment.courseId));

            const enrichedList = filteredAssignments.map(assignment => ({
                ...assignment,
                courseTitle: coursesData[assignment.courseId]?.title || 'Unknown Course'
            }));
            
            setAssignments(enrichedList);
            setLoading(false);
        });

        return () => {
            off(assignmentsRef, 'value', listener);
        };
    }, [authLoading, enrolledCourseIds]);

    const getDueDateBadgeVariant = (dueDate: string) => {
        const date = parseISO(dueDate);
        if (isPast(date) && differenceInDays(new Date(), date) >= 1) return 'destructive';
        const daysUntilDue = differenceInDays(date, new Date());
        if (daysUntilDue <= 3) return 'destructive';
        if (daysUntilDue <= 7) return 'secondary';
        return 'outline';
    }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Assignments</CardTitle>
          <CardDescription>Here is a list of your upcoming and past due assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <AssignmentSkeleton key={i} />)
              ) : assignments.length > 0 ? (
                assignments
                 .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                 .map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.title}</TableCell>
                      <TableCell>{assignment.courseTitle}</TableCell>
                      <TableCell>
                          <Badge variant={getDueDateBadgeVariant(assignment.dueDate)}>
                            {format(parseISO(assignment.dueDate), 'PPP')}
                          </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                           <Eye className="mr-2 h-4 w-4" />
                            View
                        </Button>
                      </TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    You have no assignments for your enrolled courses.
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
