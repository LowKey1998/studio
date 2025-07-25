
"use client";

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Course {
    id: string;
    title: string;
    instructor: string;
}

interface Student {
    id: string;
    email: string;
    name: string;
}

const StudentSkeleton = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
    </TableRow>
);


export default function StudentRosterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [instructorName, setInstructorName] = useState('');

  // Fetch current user's display name to filter courses
  useEffect(() => {
    if(user?.displayName) {
        setInstructorName(user.displayName);
    }
  }, [user]);

  // Fetch courses taught by the current staff member
  useEffect(() => {
    if (!instructorName) return;
    const coursesRef = ref(db, 'courses');
    const listener = onValue(coursesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const courseList = Object.keys(data)
                .map(key => ({ id: key, ...data[key] }))
                .filter(course => course.instructor === instructorName);
            setCourses(courseList);
        }
    });
    return () => off(coursesRef, 'value', listener);
  }, [instructorName]);


  // Fetch enrolled students when a course is selected
  useEffect(() => {
    const fetchStudents = async () => {
        if (!selectedCourseId) {
            setStudents([]);
            return;
        }
        setIsLoading(true);
        try {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            const allUsers = snapshot.val();
            if (allUsers) {
                const enrolledStudents = Object.entries(allUsers)
                    .filter(([, userData]: [string, any]) => 
                        userData.role === 'student' && userData.enrolledCourses && userData.enrolledCourses[selectedCourseId]
                    )
                    .map(([studentId, userData]: [string, any]) => ({
                        id: studentId,
                        email: userData.email,
                        name: `Student ${studentId}`, // Placeholder, would ideally be fetched from a profile
                    }));
                setStudents(enrolledStudents);
            }
        } catch(error) {
            console.error("Failed to fetch students", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch enrolled students.' });
        } finally {
            setIsLoading(false);
        }
    }
    fetchStudents();
  }, [selectedCourseId, toast]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Roster</CardTitle>
        <CardDescription>View the list of students enrolled in your courses.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-md">
            <Select onValueChange={setSelectedCourseId} value={selectedCourseId}>
                <SelectTrigger>
                <SelectValue placeholder="Select one of your courses" />
                </SelectTrigger>
                <SelectContent>
                {courses.length > 0 ? (
                    courses.map(course => (
                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                    ))
                ) : (
                    <SelectItem value="loading" disabled>Loading your courses...</SelectItem>
                )}
                </SelectContent>
            </Select>
        </div>
        
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <StudentSkeleton key={i} />)
              ) : students.length > 0 ? (
                students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.id}</TableCell>
                      <TableCell>{student.email}</TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="h-24 text-center">
                    {selectedCourseId ? "No students are enrolled in this course." : "Please select a course to see the roster."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

      </CardContent>
    </Card>
  );
}
