
"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarIcon, UserCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue, off, set, get } from 'firebase/database';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';

const attendanceSchema = z.object({
  courseId: z.string({ required_error: 'Please select a course.' }),
  date: z.date({ required_error: "A date is required." }),
  students: z.array(z.object({
    studentId: z.string(),
    name: z.string(),
    status: z.enum(['present', 'absent', 'late'], { required_error: "Please select a status." })
  }))
});

type AttendanceFormValues = z.infer<typeof attendanceSchema>;

interface Course {
    id: string;
    title: string;
    instructor: string;
}

interface Student {
    id: string;
    email: string;
    role: string;
    uid: string;
    displayName: string;
    enrolledCourses: { [courseId: string]: boolean };
}

export default function AttendanceManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructorName, setInstructorName] = useState('');

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "students",
  });

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


  const selectedCourseId = form.watch('courseId');

  // Fetch enrolled students when a course is selected
  useEffect(() => {
    const fetchStudents = async () => {
        if (!selectedCourseId) {
            replace([]);
            return;
        }
        setIsFetchingStudents(true);
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
                        studentId: studentId,
                        name: `Student ${studentId}`, // In a real app, you'd fetch their actual name
                        status: 'present' as 'present' | 'absent' | 'late'
                    }));
                replace(enrolledStudents);
            }
        } catch(error) {
            console.error("Failed to fetch students", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch enrolled students.' });
        } finally {
            setIsFetchingStudents(false);
        }
    }
    fetchStudents();
  }, [selectedCourseId, replace, toast]);

  const onSubmit = async (data: AttendanceFormValues) => {
    setIsLoading(true);
    const dateString = format(data.date, 'yyyy-MM-dd');

    try {
        const attendancePromises = data.students.map(student => {
            const attendanceRef = ref(db, `attendance/${data.courseId}/${dateString}/${student.studentId}`);
            return set(attendanceRef, { status: student.status });
        });

        await Promise.all(attendancePromises);

        toast({
            title: 'Attendance Saved',
            description: `Attendance for ${format(data.date, 'PPP')} has been recorded.`,
        });
        form.reset();
        replace([]);

    } catch (error: any) {
      console.error("Failed to save attendance:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Save Attendance',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Take Attendance</CardTitle>
        <CardDescription>Select a course and date to record student attendance.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="courseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select one of your courses" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            {isFetchingStudents && (
                <div className="space-y-2 pt-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            )}

            {!isFetchingStudents && fields.length > 0 && (
                 <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium">Student List</h3>
                    {fields.map((item, index) => (
                         <FormField
                            key={item.id}
                            control={form.control}
                            name={`students.${index}.status`}
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <FormLabel className="font-normal">{item.name}</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex items-center space-x-4"
                                        >
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl><RadioGroupItem value="present" /></FormControl>
                                                <FormLabel className="font-normal">Present</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl><RadioGroupItem value="absent" /></FormControl>
                                                <FormLabel className="font-normal">Absent</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl><RadioGroupItem value="late" /></FormControl>
                                                <FormLabel className="font-normal">Late</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    ))}
                </div>
            )}
             
            {!isFetchingStudents && selectedCourseId && fields.length === 0 && (
                <div className="text-center text-muted-foreground pt-4 border-t">
                    No students are enrolled in this course.
                </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || fields.length === 0}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              Submit Attendance
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
