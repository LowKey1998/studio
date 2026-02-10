'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, TrendingDown, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";

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
    attendanceRate: number;
};

type DetailedStudentRecord = {
    date: string;
    status: string;
};

export default function AttendanceDashboardPage() {
    const [courseRates, setCourseRates] = React.useState<CourseAttendance[]>([]);
    const [atRiskStudents, setAtRiskStudents] = React.useState<StudentAttendance[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    // For Dialog
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [selectedCourse, setSelectedCourse] = React.useState<CourseAttendance | null>(null);
    const [detailedStudentData, setDetailedStudentData] = React.useState<({studentName: string, studentId: string, records: DetailedStudentRecord[]})[]>([]);

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
                        totalPresent += studentUids.filter(uid => lecture[uid] === 'Present' || lecture[uid] === 'Late' || lecture[uid] === 'Excused Absence').length;
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
                        if (registrations[userId][semester].status === 'Completed' || registrations[userId][semester].status === 'Pending Payment') {
                            registrations[userId][semester].courses.forEach((cid: string) => studentRates[userId]?.courses.add(cid));
                        }
                    }
                }

                for (const courseId in attendance) {
                    Object.values(attendance[courseId]).forEach((lecture: any) => {
                        Object.keys(lecture).forEach(userId => {
                            if (studentRates[userId]?.courses.has(courseId)) {
                                studentRates[userId].total++;
                                if(lecture[userId] === 'Present' || lecture[userId] === 'Late' || lecture[userId] === 'Excused Absence') {
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
    
    const handleCourseClick = async (course: CourseAttendance) => {
        setSelectedCourse(course);
        const [regsSnap, usersSnap, attendanceSnap] = await Promise.all([
            get(ref(db, 'registrations')),
            get(ref(db, 'users')),
            get(ref(db, `attendance/${course.courseId}`))
        ]);

        if (!regsSnap.exists() || !usersSnap.exists() || !attendanceSnap.exists()) return;
        
        const allRegs = regsSnap.val();
        const allUsers = usersSnap.val();
        const courseAttendance = attendanceSnap.val();
        
        const enrolledUids: string[] = [];
        for (const userId in allRegs) {
            for (const sem in allRegs[userId]) {
                if (allRegs[userId][sem].courses.includes(course.courseId) && (allRegs[userId][sem].status === 'Completed' || allRegs[userId][sem].status === 'Pending Payment')) {
                    enrolledUids.push(userId);
                    break;
                }
            }
        }

        const studentData = enrolledUids.map(uid => {
            const records: DetailedStudentRecord[] = [];
            for (const date in courseAttendance) {
                if (courseAttendance[date][uid]) {
                    records.push({ date, status: courseAttendance[date][uid] });
                }
            }
            return {
                studentId: allUsers[uid].id,
                studentName: allUsers[uid].name,
                records: records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            };
        }).sort((a,b) => a.studentName.localeCompare(b.studentName));
        
        setDetailedStudentData(studentData);
        setIsDetailOpen(true);
    }

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
                                    <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Lectures Marked</TableHead><TableHead className="w-[300px]">Attendance Rate</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
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
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" onClick={() => handleCourseClick(course)}>View Details</Button>
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
             <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Attendance for {selectedCourse?.courseName}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[70vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Attendance Log</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detailedStudentData.map(student => (
                                    <TableRow key={student.studentId}>
                                        <TableCell className="font-medium align-top">{student.studentName} ({student.studentId})</TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                            {student.records.map(rec => (
                                                <div key={rec.date} className="flex justify-between items-center text-xs">
                                                    <span>{format(parseISO(rec.date), 'MMM dd, yyyy')}</span>
                                                    <Badge variant={rec.status === 'Present' || rec.status === 'Excused Absence' ? 'default' : (rec.status === 'Late' ? 'secondary' : 'destructive')}>{rec.status}</Badge>
                                                </div>
                                            ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
