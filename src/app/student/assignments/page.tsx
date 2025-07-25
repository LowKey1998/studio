
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { format, isPast, differenceInDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

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
    const [assignments, setAssignments] = useState<EnrichedAssignment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const assignmentsRef = ref(db, 'assignments');
        const coursesRef = ref(db, 'courses');

        let coursesData: { [key: string]: Course } = {};

        const coursesListener = onValue(coursesRef, (snapshot) => {
            coursesData = snapshot.val() || {};
             // Trigger assignments listener again if it has already run
            if(!loading) {
                const assignmentsListener = onValue(assignmentsRef, (snapshot) => {
                    const assignmentsData = snapshot.val();
                    if (assignmentsData && coursesData) {
                        const enrichedList = Object.keys(assignmentsData).map(key => {
                            const assignment = { id: key, ...assignmentsData[key]};
                            return {
                                ...assignment,
                                courseTitle: coursesData[assignment.courseId]?.title || 'Unknown Course'
                            }
                        });
                        setAssignments(enrichedList);
                    } else {
                        setAssignments([]);
                    }
                    setLoading(false);
                }, { onlyOnce: true }); // Rerun to get assignments
            }
        });

        const assignmentsListener = onValue(assignmentsRef, (snapshot) => {
            const assignmentsData = snapshot.val();
            if (assignmentsData && Object.keys(coursesData).length > 0) {
                 const enrichedList = Object.keys(assignmentsData).map(key => {
                    const assignment = { id: key, ...assignmentsData[key]};
                    return {
                        ...assignment,
                        courseTitle: coursesData[assignment.courseId]?.title || 'Unknown Course'
                    }
                });
                setAssignments(enrichedList);
            } else if (!assignmentsData) {
                 setAssignments([]);
            }
            setLoading(false);
        });

        return () => {
            off(assignmentsRef, 'value', assignmentsListener);
            off(coursesRef, 'value', coursesListener);
        };
    }, [loading]);

    const getDueDateBadgeVariant = (dueDate: string) => {
        const date = new Date(dueDate);
        if (isPast(date) && !differenceInDays(new Date(), date)) return 'destructive';
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
                            {format(new Date(assignment.dueDate), 'PPP')}
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
                    No assignments found.
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
