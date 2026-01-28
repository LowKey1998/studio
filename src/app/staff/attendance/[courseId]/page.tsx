
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, CalendarIcon, Loader2, Save, Users, CheckCircle, XCircle, Clock } from "lucide-react";
import { db, auth } from '@/lib/firebase';
import { ref, get, set, child } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { format, isSameDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useParams } from 'next/navigation';

type Course = {
    id: string;
    name: string;
    code: string;
}

type Student = {
    uid: string;
    id: string; // STU-001
    name: string;
}

type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused Absence";
type AttendanceRecord = Record<string, AttendanceStatus>;


export default function MarkAttendancePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [course, setCourse] = React.useState<Course | null>(null);
    const [students, setStudents] = React.useState<Student[]>([]);
    const [attendance, setAttendance] = React.useState<AttendanceRecord>({});
    const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchCourseAndStudents = React.useCallback(async () => {
        setLoading(true);
        try {
            const courseRef = ref(db, `courses/${courseId}`);
            const courseSnapshot = await get(courseRef);
            if (!courseSnapshot.exists()) throw new Error("Course not found");
            const courseData = courseSnapshot.val();
            if (currentUser && courseData.lecturerId !== currentUser.uid) throw new Error("Access denied");
            setCourse({ id: courseId, ...courseData });

            const allUsersSnapshot = await get(ref(db, 'users'));
            const allUsers = allUsersSnapshot.val();
            
            const registrationsSnapshot = await get(ref(db, 'registrations'));
            const enrolledStudentUids: string[] = [];
            if(registrationsSnapshot.exists()){
                const allRegistrations = registrationsSnapshot.val();
                for (const userId in allRegistrations) {
                    for (const semester in allRegistrations[userId]) {
                        const reg = allRegistrations[userId][semester];
                        if (reg.courses.includes(courseId) && reg.status === 'Completed') {
                            enrolledStudentUids.push(userId);
                        }
                    }
                }
            }

            const studentList: Student[] = enrolledStudentUids.map(uid => ({
                uid,
                id: allUsers[uid].id,
                name: allUsers[uid].name,
            })).sort((a, b) => a.name.localeCompare(b.name));
            setStudents(studentList);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not fetch course and student data." });
        } finally {
            setLoading(false);
        }
    }, [courseId, toast, currentUser]);

    const fetchAttendanceForDate = React.useCallback(async (date: Date) => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const attendanceRef = ref(db, `attendance/${courseId}/${formattedDate}`);
        const snapshot = await get(attendanceRef);
        
        const hasBeenSubmitted = snapshot.exists();
        setIsSubmitted(hasBeenSubmitted);

        if (hasBeenSubmitted) {
            setAttendance(snapshot.val());
        } else {
            const initialAttendance: AttendanceRecord = {};
            students.forEach(student => {
                initialAttendance[student.uid] = 'Present';
            });
            setAttendance(initialAttendance);
        }
    }, [courseId, students]);

    React.useEffect(() => {
        if(currentUser) {
           fetchCourseAndStudents();
        }
    }, [currentUser, fetchCourseAndStudents]);
    
    React.useEffect(() => {
        if (students.length > 0) {
            fetchAttendanceForDate(selectedDate);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [students, selectedDate]);


    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setSelectedDate(date);
        }
    };

    const handleStatusChange = (studentUid: string, status: AttendanceStatus) => {
        setAttendance(prev => ({
            ...prev,
            [studentUid]: status,
        }));
    };
    
    const handleSaveAttendance = async () => {
        setSaving(true);
        try {
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
            const attendanceRef = ref(db, `attendance/${courseId}/${formattedDate}`);
            await set(attendanceRef, attendance);
            toast({ title: "Attendance Saved", description: `Attendance for ${format(selectedDate, 'PPP')} has been successfully recorded.` });
            setIsSubmitted(true);
        } catch (error: any) {
            console.error("Error saving attendance:", error);
            toast({ variant: 'destructive', title: "Save Failed", description: error.message || "Could not save attendance." });
        } finally {
            setSaving(false);
        }
    };
    
    const stats = React.useMemo(() => {
        const values = Object.values(attendance);
        return {
            present: values.filter(s => s === 'Present').length,
            absent: values.filter(s => s === 'Absent').length,
            late: values.filter(s => s === 'Late').length
        }
    }, [attendance]);


    if(loading) {
        return (
             <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <Card className="shadow-lg">
                    <CardHeader>
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-1/3 mt-2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if(!course) {
        return (
            <div className="space-y-6">
                 <Button variant="outline" asChild>
                    <Link href="/staff/courses"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Courses</Link>
                </Button>
                 <Card><CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>Course not found or you do not have permission to view this page.</AlertDescription>
                    </Alert>
                 </CardContent></Card>
            </div>
        )
    }

  return (
       <Card>
          <CardHeader>
            <CardTitle>Mark Attendance</CardTitle>
            <CardDescription>Select a date and mark attendance for this course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={'outline'}
                        className={cn( 'w-full sm:w-[280px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground' )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} disabled={(date) => date > new Date()} initialFocus />
                    </PopoverContent>
                </Popover>

                <div className="flex items-center gap-4 text-sm font-medium rounded-lg bg-muted p-2">
                    <div className="flex items-center text-green-600 gap-1"><CheckCircle className="h-4 w-4" />Present: {stats.present}</div>
                    <div className="flex items-center text-red-600 gap-1"><XCircle className="h-4 w-4" />Absent: {stats.absent}</div>
                    <div className="flex items-center text-orange-500 gap-1"><Clock className="h-4 w-4" />Late: {stats.late}</div>
                </div>
              </div>
                {isSubmitted && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                        <Info className="h-4 w-4 text-blue-700" />
                        <AlertTitle className="text-blue-900">Attendance Submitted</AlertTitle>
                        <AlertDescription className="text-blue-700">
                            The attendance for this date has already been submitted and is now read-only. Please contact an administrator if you need to make changes.
                        </AlertDescription>
                    </Alert>
                )}
               {students.length > 0 ? (
                <div className="border rounded-md">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Student ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map((student) => (
                             <TableRow key={student.uid}>
                                <TableCell className="font-medium">{student.id}</TableCell>
                                <TableCell>{student.name}</TableCell>
                                <TableCell className="text-right">
                                    <RadioGroup
                                        value={attendance[student.uid] || 'Present'}
                                        onValueChange={(value) => handleStatusChange(student.uid, value as AttendanceStatus)}
                                        className="flex justify-end gap-4"
                                        disabled={isSubmitted}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Present" id={`present-${student.uid}`} />
                                            <Label htmlFor={`present-${student.uid}`}>Present</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Absent" id={`absent-${student.uid}`} />
                                            <Label htmlFor={`absent-${student.uid}`}>Absent</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Late" id={`late-${student.uid}`} />
                                            <Label htmlFor={`late-${student.uid}`}>Late</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Excused Absence" id={`excused-${student.uid}`} />
                                            <Label htmlFor={`excused-${student.uid}`}>Excused</Label>
                                        </div>
                                    </RadioGroup>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
               ) : (
                    <div className="py-16 text-center text-muted-foreground">
                        <Users className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Students Enrolled</h3>
                        <p className="mt-2 text-sm">There are no students currently enrolled in this course.</p>
                    </div>
               )}
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6">
                <Button onClick={handleSaveAttendance} disabled={saving || loading || students.length === 0 || isSubmitted}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitted ? 'Attendance Submitted' : 'Save Attendance'}
                </Button>
          </CardFooter>
      </Card>
  );
}
