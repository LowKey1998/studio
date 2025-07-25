
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookCopy } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, set, push, onValue, off } from 'firebase/database';
import { Textarea } from '@/components/ui/textarea';

const addQuizSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  courseId: z.string({ required_error: 'Please select a course.' }),
  timeLimit: z.coerce.number().min(1, 'Time limit must be at least 1 minute.'),
  description: z.string().optional(),
});

type AddQuizFormValues = z.infer<typeof addQuizSchema>;

interface Course {
    id: string;
    title: string;
}

export default function QuizManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  const form = useForm<AddQuizFormValues>({
    resolver: zodResolver(addQuizSchema),
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

  const onSubmit = async (data: AddQuizFormValues) => {
    setIsLoading(true);

    try {
      const quizzesRef = ref(db, 'quizzes');
      const newQuizRef = push(quizzesRef); 
      
      await set(newQuizRef, {
        ...data,
      });

      toast({
        title: 'Quiz Added Successfully',
        description: `The quiz "${data.title}" has been created.`,
      });
      form.reset();

    } catch (error: any) {
      console.error("Failed to add quiz:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Add Quiz',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quiz Management</CardTitle>
        <CardDescription>Create and configure quizzes for your courses.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Chapter 1 Review" {...field} />
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
              name="timeLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Limit (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 60" {...field} />
                  </FormControl>
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
                    <Textarea placeholder="Instructions or details about the quiz..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookCopy className="mr-2 h-4 w-4" />}
              Create Quiz
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
