
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, TrendingDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type CourseAttendance = {
    courseId: string;
    courseName: string;
    courseCode: string;
    overallRate: number;
    totalLectures: number;
};

type StudentAttendance = {
    userId: string;
    studentId: string;
    studentName: string;
    courseId: string;
    courseName: string;
    attendanceRate: number;
};

export default function AttendanceDashboardPage() {
    const [courseRates, setCourseRates] = React.useState<CourseAttendance[]>([]);
    const [atRiskStudents, setAtRiskStudents] = React.useState<StudentAttendance[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchAttendanceData = async () => {
            setLoading(true);
            try {
                const [attendanceSnap, coursesSnap, usersSnap, regsSnap] = await Promise.all([
                    get(ref(db, 'attendance')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'users')),
                    get(ref(db, 'registrations'))
                ]);

                if (!attendanceSnap.exists() || !coursesSnap.exists() || !usersSnap.exists()) {
                    setLoading(false); return;
                }

                const attendance = attendanceSnap.val();
                const courses = coursesSnap.val();
                const users = usersSnap.val();
                const registrations = regsSnap.val() || {};
                
                // Course-level attendance
                const courseAttendanceList: CourseAttendance[] = [];
                for (const courseId in attendance) {
                    let totalPossible = 0;
                    let totalPresent = 0;
                    const lectures = Object.values(attendance[courseId]);
                    
                    lectures.forEach((lecture: any) => {
                        const studentUids = Object.keys(lecture);
                        totalPossible += studentUids.length;
                        totalPresent += studentUids.filter(uid => lecture[uid] === 'Present' || lecture[uid] === 'Late').length;
                    });
                    
                    courseAttendanceList.push({
                        courseId,
                        courseName: courses[courseId]?.name || 'Unknown',
                        courseCode: courses[courseId]?.code || 'N/A',
                        overallRate: totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0,
                        totalLectures: lectures.length,
                    });
                }
                setCourseRates(courseAttendanceList.sort((a,b) => a.overallRate - b.overallRate));

                // Student-level attendance (at risk)
                const studentRates: { [key: string]: { present: number, total: number, courses: Set<string> } } = {};
                for(const userId in users){
                    if(users[userId].role === 'Student'){
                        studentRates[userId] = { present: 0, total: 0, courses: new Set() };
                    }
                }
                
                // Populate student courses from registrations
                for (const userId in registrations) {
                    for (const semester in registrations[userId]) {
                        if (registrations[userId][semester].status === 'Completed') {
                            registrations[userId][semester].courses.forEach((cid: string) => studentRates[userId]?.courses.add(cid));
                        }
                    }
                }

                for (const courseId in attendance) {
                    Object.values(attendance[courseId]).forEach((lecture: any) => {
                        Object.keys(lecture).forEach(userId => {
                            if (studentRates[userId]?.courses.has(courseId)) {
                                studentRates[userId].total++;
                                if(lecture[userId] === 'Present' || lecture[userId] === 'Late') {
                                    studentRates[userId].present++;
                                }
                            }
                        });
                    });
                }
                
                const atRiskList: StudentAttendance[] = Object.keys(studentRates).map(userId => {
                    const rate = studentRates[userId].total > 0 ? (studentRates[userId].present / studentRates[userId].total) * 100 : 100;
                    return {
                        userId,
                        studentId: users[userId].id,
                        studentName: users[userId].name,
                        courseId: '', // Aggregated across all courses
                        courseName: 'Overall',
                        attendanceRate: rate,
                    }
                }).filter(s => s.attendanceRate < 75 && studentRates[s.userId].total > 5) // At risk if < 75% and > 5 classes marked
                  .sort((a,b) => a.attendanceRate - b.attendanceRate);

                setAtRiskStudents(atRiskList);

            } catch (error) {
                console.error("Error fetching attendance data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAttendanceData();
    }, []);

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Attendance Monitoring</CardTitle>
                    <CardDescription>View overall attendance rates and identify students at risk due to poor attendance.</CardDescription>
                </CardHeader>
            </Card>
            <Tabs defaultValue="courses">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="courses">Rates by Course</TabsTrigger>
                    <TabsTrigger value="students">At-Risk Students</TabsTrigger>
                </TabsList>
                <TabsContent value="courses">
                    <Card>
                        <CardHeader><CardTitle>Overall Attendance by Course</CardTitle></CardHeader>
                        <CardContent>
                             {loading ? <Skeleton className="h-64 w-full" /> : courseRates.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Lectures Marked</TableHead><TableHead className="w-[300px]">Attendance Rate</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {courseRates.map(course => (
                                            <TableRow key={course.courseId}>
                                                <TableCell>{course.courseName} ({course.courseCode})</TableCell>
                                                <TableCell>{course.totalLectures}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={course.overallRate} className="w-[80%]" />
                                                        <span className="text-sm font-medium">{course.overallRate.toFixed(1)}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>No Data</AlertTitle><AlertDescription>No attendance has been marked yet.</AlertDescription></Alert>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="students">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><TrendingDown/>At-Risk Students</CardTitle>
                            <CardDescription>Students with an overall attendance rate below 75% across all their courses.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {loading ? <Skeleton className="h-64 w-full" /> : atRiskStudents.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead className="w-[300px]">Overall Attendance</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {atRiskStudents.map(student => (
                                            <TableRow key={student.userId}>
                                                <TableCell>{student.studentId}</TableCell>
                                                <TableCell>{student.studentName}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={student.attendanceRate} className="w-[80%]" />
                                                        <span className="text-sm font-medium">{student.attendanceRate.toFixed(1)}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             ) : <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>All Good!</AlertTitle><AlertDescription>No students are currently flagged as being at-risk due to low attendance.</AlertDescription></Alert>}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
