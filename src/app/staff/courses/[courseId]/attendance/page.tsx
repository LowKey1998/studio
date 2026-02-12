'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, CalendarIcon, Loader2, Save, Users, CheckCircle, XCircle, Clock, Search } from "lucide-react";
import { db, auth, createNotification } from '@/lib/firebase';
import { ref, get, set, onValue } from 'firebase/database';
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
import { Input } from '@/components/ui/input';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerId: string;
    lecturerIds?: string[];
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
    const [studentSearch, setStudentSearch] = React.useState('');
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
                        if (reg.courses?.includes(courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                            enrolledStudentUids.push(userId);
                            break;
                        }
                    }
                }
            }

            const studentList: Student[] = enrolledStudentUids.map(uid => ({
                uid,
                id: allUsers[uid]?.id || 'N/A',
                name: allUsers[uid]?.name || 'Unknown',
            })).sort((a, b) => a.name.localeCompare(b.name));
            setStudents(studentList);

        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: "Error", description: "Could not fetch data." });
        } finally {
            setLoading(false);
        }
    }, [courseId, toast]);

    const fetchAttendanceForDate = React.useCallback(async (date: Date) => {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const attendanceRef = ref(db, `attendance/${courseId}/${formattedDate}`);
        const snapshot = await get(attendanceRef);
        if (snapshot.exists()) {
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
    }, [students, selectedDate, fetchAttendanceForDate]);


    const handleSaveAttendance = async () => {
        setSaving(true);
        try {
            const formattedDate = format(selectedDate, 'yyyy-MM-dd');
            const attendanceRef = ref(db, `attendance/${courseId}/${formattedDate}`);
            await set(attendanceRef, attendance);

            const promises = Object.entries(attendance).map(([uid, status]) => {
                if (status === 'Absent' || status === 'Late') {
                    return createNotification(
                        uid,
                        `Attendance Alert: Marked as ${status} for ${course?.name} on ${format(selectedDate, 'PPP')}.`,
                        `/student/courses/${courseId}/attendance`
                    );
                }
                return Promise.resolve();
            });
            await Promise.all(promises);

            toast({ title: "Attendance Saved", description: `Roster for ${format(selectedDate, 'PPP')} updated.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Save Failed" });
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

    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
        s.id.toLowerCase().includes(studentSearch.toLowerCase())
    );

    if(loading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  return (
       <Card>
          <CardHeader>
            <CardTitle>Mark Attendance</CardTitle>
            <CardDescription>Enter daily attendance for your class.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button variant={'outline'} className={cn( 'w-full sm:w-[280px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground' )}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d)=>d && setSelectedDate(d)} disabled={(date) => date > new Date()} initialFocus /></PopoverContent>
                </Popover>

                <div className="flex items-center gap-4 text-sm font-medium rounded-lg bg-muted p-2">
                    <div className="flex items-center text-green-600 gap-1"><CheckCircle className="h-4 w-4" />Present: {stats.present}</div>
                    <div className="flex items-center text-red-600 gap-1"><XCircle className="h-4 w-4" />Absent: {stats.absent}</div>
                    <div className="flex items-center text-orange-500 gap-1"><Clock className="h-4 w-4" />Late: {stats.late}</div>
                </div>
              </div>

              <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filter students by name or ID..." className="pl-8" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>

               {filteredStudents.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                 <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[120px]">Student ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.map((student) => (
                             <TableRow key={student.uid}>
                                <TableCell className="font-mono text-xs">{student.id}</TableCell>
                                <TableCell className="font-semibold text-sm">{student.name}</TableCell>
                                <TableCell className="text-right">
                                    <RadioGroup 
                                        value={attendance[student.uid] || 'Present'} 
                                        onValueChange={(value) => setAttendance(p => ({...p, [student.uid]: value as any}))}
                                        className="flex justify-end gap-2 sm:gap-4"
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <RadioGroupItem value="Present" id={`p-${student.uid}`} className="sr-only" />
                                            <Label htmlFor={`p-${student.uid}`} className={cn("px-3 py-1 rounded text-[10px] font-bold border cursor-pointer", attendance[student.uid] === 'Present' ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>PRESENT</Label>
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <RadioGroupItem value="Absent" id={`a-${student.uid}`} className="sr-only" />
                                            <Label htmlFor={`a-${student.uid}`} className={cn("px-3 py-1 rounded text-[10px] font-bold border cursor-pointer", attendance[student.uid] === 'Absent' ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background")}>ABSENT</Label>
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <RadioGroupItem value="Late" id={`l-${student.uid}`} className="sr-only" />
                                            <Label htmlFor={`l-${student.uid}`} className={cn("px-3 py-1 rounded text-[10px] font-bold border cursor-pointer", attendance[student.uid] === 'Late' ? "bg-orange-500 text-white border-orange-500" : "bg-background")}>LATE</Label>
                                        </div>
                                    </RadioGroup>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </div>
               ) : (
                    <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Users className="mx-auto h-12 w-12 opacity-20" />
                        <p className="mt-4">No students found matching your criteria.</p>
                    </div>
               )}
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6">
                <Button onClick={handleSaveAttendance} disabled={saving || students.length === 0}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Daily Attendance
                </Button>
          </CardFooter>
      </Card>
  );
}
