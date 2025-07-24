
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
import { Loader2, BookUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, set, push } from 'firebase/database';
import { Textarea } from '@/components/ui/textarea';

const addBookSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  author: z.string().min(1, 'Author is required.'),
  copies: z.coerce.number().min(0, 'Copies must be a non-negative number.'),
  description: z.string().optional(),
});

type AddBookFormValues = z.infer<typeof addBookSchema>;

export default function LibraryManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddBookFormValues>({
    resolver: zodResolver(addBookSchema),
    defaultValues: {
      title: '',
      author: '',
      copies: 0,
      description: '',
    },
  });

  const onSubmit = async (data: AddBookFormValues) => {
    setIsLoading(true);

    try {
      const booksRef = ref(db, 'library/books');
      const newBookRef = push(booksRef); // Generate a unique ID
      
      await set(newBookRef, {
        title: data.title,
        author: data.author,
        copiesAvailable: data.copies,
        description: data.description || '',
        imageUrl: 'https://placehold.co/150x200.png', // Placeholder image
      });

      toast({
        title: 'Book Added Successfully',
        description: `"${data.title}" has been added to the library catalog.`,
      });
      form.reset();

    } catch (error: any) {
      console.error("Failed to add book:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Add Book',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Library Management</CardTitle>
        <CardDescription>Add new books to the library catalog.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Book Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Clean Code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="author"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Author</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Robert C. Martin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="copies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Copies</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
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
                    <Textarea placeholder="A brief summary of the book..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookUp className="mr-2 h-4 w-4" />}
              Add Book to Catalog
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
