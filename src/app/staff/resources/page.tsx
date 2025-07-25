
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { ref as dbRef, set, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Textarea } from '@/components/ui/textarea';

const ACCEPTED_FILE_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

const uploadResourceSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required.'),
  file: z.any()
    .refine((files) => files?.length == 1, "File is required.")
    .refine((files) => ACCEPTED_FILE_TYPES.includes(files?.[0]?.type), ".pdf and .doc/.docx files are accepted."),
});

type UploadResourceFormValues = z.infer<typeof uploadResourceSchema>;

export default function ResourceManagementPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UploadResourceFormValues>({
    resolver: zodResolver(uploadResourceSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
    },
  });

  const onSubmit = async (data: UploadResourceFormValues) => {
    setIsLoading(true);

    try {
      const file = data.file[0] as File;

      // 1. Upload file to Firebase Storage
      const fileStorageRef = storageRef(storage, `resources/${file.name}`);
      const uploadResult = await uploadBytes(fileStorageRef, file);
      const fileUrl = await getDownloadURL(uploadResult.ref);
      
      // 2. Add resource metadata to Realtime Database
      const resourcesRef = dbRef(db, 'resources');
      const newResourceRef = push(resourcesRef);
      
      await set(newResourceRef, {
        title: data.title,
        description: data.description || '',
        category: data.category,
        fileUrl: fileUrl,
        fileType: file.type.split('/')[1].toUpperCase(),
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      });

      toast({
        title: 'Resource Uploaded Successfully',
        description: `"${data.title}" has been added to the resources.`,
      });
      form.reset();

    } catch (error: any) {
      console.error("Failed to upload resource:", error);
      toast({
        variant: 'destructive',
        title: 'Failed to Upload Resource',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const fileRef = form.register("file");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Management</CardTitle>
        <CardDescription>Upload new documents and files for students.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Academic Calendar 2024" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., General, Financial Aid" {...field} />
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
                    <Textarea placeholder="A brief summary of the resource..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                 <FormItem>
                    <FormLabel>File</FormLabel>
                    <FormControl>
                        <Input type="file" {...fileRef} />
                    </FormControl>
                     <FormDescription>
                        Upload a PDF, DOC, or DOCX file.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Upload Resource
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
