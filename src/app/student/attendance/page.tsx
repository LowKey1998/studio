
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AttendanceRecord {
  id: string; // date
  status: 'present' | 'absent' | 'late';
  courseId: string;
  courseTitle: string;
}

interface Course {
  id: string;
  title: string;
}

const AttendanceSkeleton = () => (
    <TableRow>
        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
        <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
        <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
    </TableRow>
)

export default function StudentAttendancePage() {
    const { user, loading: authLoading } = useAuth();
    const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
    const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading || !user) {
            if (!authLoading) setLoading(false);
            return;
        }

        const fetchStudentData = async () => {
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
            const studentData = studentEntry[1];
            
            if (!studentData.enrolledCourses) {
                setLoading(false);
                return;
            }

            const courseIds = Object.keys(studentData.enrolledCourses);
            const coursesRef = ref(db, 'courses');
            const coursesSnapshot = await get(coursesRef);
            const allCourses = coursesSnapshot.val() || {};
            
            const studentCourses = courseIds.map(id => ({ id, ...allCourses[id] }));
            setEnrolledCourses(studentCourses);

            const attendanceRef = ref(db, 'attendance');
            onValue(attendanceRef, (snapshot) => {
                const attendanceData = snapshot.val() || {};
                const records: AttendanceRecord[] = [];

                studentCourses.forEach(course => {
                    if (attendanceData[course.id]) {
                        Object.entries(attendanceData[course.id]).forEach(([date, dateRecords]: [string, any]) => {
                             if(dateRecords[studentId]) {
                                records.push({
                                    id: `${course.id}-${date}`,
                                    date: date,
                                    status: dateRecords[studentId].status,
                                    courseId: course.id,
                                    courseTitle: course.title,
                                });
                             }
                        });
                    }
                });
                
                const sortedRecords = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setAllAttendance(sortedRecords);
                setFilteredAttendance(sortedRecords);
                setLoading(false);
            });
        };

        fetchStudentData();

    }, [user, authLoading]);

    useEffect(() => {
        if (selectedCourse === 'all') {
            setFilteredAttendance(allAttendance);
        } else {
            setFilteredAttendance(allAttendance.filter(rec => rec.courseId === selectedCourse));
        }
    }, [selectedCourse, allAttendance]);

    const getStatusBadgeVariant = (status: string) => {
        switch(status) {
            case 'present': return 'default';
            case 'late': return 'secondary';
            case 'absent': return 'destructive';
            default: return 'outline';
        }
    }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Attendance</CardTitle>
              <CardDescription>A record of your attendance for all enrolled courses.</CardDescription>
            </div>
             <div className="w-full max-w-xs">
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by course..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Courses</SelectItem>
                        {enrolledCourses.map(course => (
                            <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <AttendanceSkeleton key={i} />)
              ) : filteredAttendance.length > 0 ? (
                filteredAttendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{format(new Date(record.date), 'PPP')}</TableCell>
                      <TableCell>{record.courseTitle}</TableCell>
                      <TableCell>
                          <Badge variant={getStatusBadgeVariant(record.status)} className="capitalize">{record.status}</Badge>
                      </TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    No attendance records found.
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
