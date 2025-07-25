
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpenCheck, PlusCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, set, onValue, off } from 'firebase/database';
import { Textarea } from '@/components/ui/textarea';
import { List, ListItem } from '@/components/ui/list';
import { Skeleton } from '@/components/ui/skeleton';

const addCourseSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  code: z.string().min(1, 'Course code is required.'),
  instructor: z.string().min(1, 'Instructor is required.'),
  description: z.string().optional(),
});

type AddCourseFormValues = z.infer<typeof addCourseSchema>;

interface Course {
  id: string;
  title: string;
  code: string;
  instructor: string;
}

export default function CourseManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const form = useForm<AddCourseFormValues>({
    resolver: zodResolver(addCourseSchema),
    defaultValues: {
      title: '',
      code: '',
      instructor: '',
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
                ...data[key]
            }));
            setCourses(courseList);
        } else {
            setCourses([]);
        }
        setLoadingList(false);
    });

    return () => off(coursesRef, 'value', listener);
  }, []);

  const onSubmit = async (data: AddCourseFormValues) => {
    setIsLoading(true);
    try {
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
      setIsDialogOpen(false);
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Course Management</CardTitle>
            <CardDescription>Add, view, and manage courses in the academic catalog.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Course
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                 <DialogHeader>
                    <DialogTitle>Add New Course</DialogTitle>
                    <DialogDescription>
                        Fill in the details below to add a new course to the catalog.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpenCheck className="mr-2 h-4 w-4" />}
                                Add Course
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
         <h3 className="text-lg font-medium mb-4">Existing Courses</h3>
        {loadingList ? (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        ) : courses.length > 0 ? (
            <List>
                {courses.map(course => (
                    <ListItem key={course.id}>
                        <div className="flex-1">
                            <p className="font-medium">{course.title} ({course.code})</p>
                            <p className="text-sm text-muted-foreground">Instructor: {course.instructor}</p>
                        </div>
                        {/* Future actions like Edit/Delete can go here */}
                        <Button variant="outline" size="sm" disabled>Manage</Button>
                    </ListItem>
                ))}
            </List>
        ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No courses have been added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
