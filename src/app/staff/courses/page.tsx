
"use client";

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpenCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import { Textarea } from '@/components/ui/textarea';

const addCourseSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  code: z.string().min(1, 'Course code is required.'),
  instructor: z.string().min(1, 'Instructor is required.'),
  description: z.string().optional(),
});

type AddCourseFormValues = z.infer<typeof addCourseSchema>;

export default function CourseManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddCourseFormValues>({
    resolver: zodResolver(addCourseSchema),
    defaultValues: {
      title: '',
      code: '',
      instructor: '',
      description: '',
    },
  });

  const onSubmit = async (data: AddCourseFormValues) => {
    setIsLoading(true);

    try {
      // Using course code as the unique ID
      const courseRef = ref(db, `courses/${data.code}`);
      
      await set(courseRef, {
        title: data.title,
        code: data.code,
        instructor: data.instructor,
        description: data.description || '',
      });

      toast({
        title: 'Course Added Successfully',
        description: `"${data.title}" has been added to the course catalog.`,
      });
      form.reset();

    } catch (error: any) {
      console.error("Failed to add course:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Add Course',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course Management</CardTitle>
        <CardDescription>Add new courses to the academic catalog.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Introduction to Computer Science" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., CS101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="instructor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructor Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Dr. Alan Turing" {...field} />
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
                    <Textarea placeholder="A brief summary of the course..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpenCheck className="mr-2 h-4 w-4" />}
              Add Course to Catalog
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
