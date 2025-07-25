
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
  FormDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PenSquare, CalendarIcon } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, set, push, onValue, off } from 'firebase/database';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const addAssignmentSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  courseId: z.string({ required_error: 'Please select a course.' }),
  dueDate: z.date({
    required_error: "A due date is required.",
  }),
  description: z.string().optional(),
});

type AddAssignmentFormValues = z.infer<typeof addAssignmentSchema>;

interface Course {
    id: string;
    title: string;
}

export default function AssignmentManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  const form = useForm<AddAssignmentFormValues>({
    resolver: zodResolver(addAssignmentSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  useEffect(() => {
    const coursesRef = ref(db, 'courses');
    const listener = onValue(coursesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const courseList = Object.keys(data).map(key => ({
                id: key,
                title: data[key].title
            }));
            setCourses(courseList);
        }
    });
    return () => off(coursesRef, 'value', listener);
  }, []);

  const onSubmit = async (data: AddAssignmentFormValues) => {
    setIsLoading(true);

    try {
      const assignmentsRef = ref(db, 'assignments');
      const newAssignmentRef = push(assignmentsRef); 
      
      await set(newAssignmentRef, {
        ...data,
        dueDate: format(data.dueDate, 'yyyy-MM-dd'), // Store date as a string
      });

      toast({
        title: 'Assignment Added Successfully',
        description: `"${data.title}" has been added.`,
      });
      form.reset();

    } catch (error: any) {
      console.error("Failed to add assignment:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Add Assignment',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment Management</CardTitle>
        <CardDescription>Create and publish new assignments for your courses.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignment Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Problem Set 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courses.length > 0 ? (
                        courses.map(course => (
                            <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>Loading courses...</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0,0,0,0)) 
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Details about the assignment..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenSquare className="mr-2 h-4 w-4" />}
              Create Assignment
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
