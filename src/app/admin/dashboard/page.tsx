
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set, get, runTransaction } from 'firebase/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const createUserSchema = z.object({
  role: z.enum(['staff', 'student'], {
    required_error: 'Please select a role.',
  }),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export default function AdminDashboard() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ id: string; password: string } | null>(null);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: CreateUserFormValues) => {
    setIsLoading(true);
    setCreatedUser(null);

    try {
      // Step 1: Generate a new unique, incremental ID
      const counterRef = ref(db, `counters/${data.role}Id`);
      const newIdResult = await runTransaction(counterRef, (currentValue) => {
        return (currentValue || 0) + 1;
      });

      if (!newIdResult.committed) {
        throw new Error('Failed to generate a new user ID. Please try again.');
      }
      
      const newIdNumber = newIdResult.snapshot.val();
      const idPrefix = data.role === 'student' ? 'ST' : 'SF';
      const newId = `${idPrefix}${String(newIdNumber).padStart(4, '0')}`;

      // Step 2: Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      // Step 3: Store user info in Realtime Database
      const userRef = ref(db, `users/${newId}`);
      await set(userRef, {
        uid: user.uid,
        email: data.email,
        role: data.role,
      });

      setCreatedUser({ id: newId, password: data.password });
      toast({
        title: 'User Created Successfully',
        description: `User ${data.email} has been created with ID ${newId}.`,
      });
      form.reset();

    } catch (error: any) {
      console.error("User creation failed:", error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'User Creation Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>Create and manage users.</CardDescription>
        </CardHeader>
        <CardContent>
          <h2 className="mb-4 text-lg font-semibold">Create New User</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </form>
          </Form>

          {createdUser && (
            <Alert className="mt-6">
              <AlertTitle>User Created!</AlertTitle>
              <AlertDescription>
                <p>Please save these credentials securely:</p>
                <p className="font-mono text-sm"><strong>ID:</strong> {createdUser.id}</p>
                <p className="font-mono text-sm"><strong>Password:</strong> {createdUser.password}</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
