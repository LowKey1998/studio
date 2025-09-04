
'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ref, get, query, orderByChild, equalTo, update, serverTimestamp } from "firebase/database";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // State for password reset
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetUserId, setResetUserId] = useState('');


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please enter your User ID and password.",
      });
      return;
    }
    setLoading(true);

    try {
      const usersRef = ref(db, 'users');
      const q = query(usersRef, orderByChild('id'), equalTo(userId.trim()));
      const snapshot = await get(q);

      if (!snapshot.exists()) {
        throw new Error("Invalid User ID or password.");
      }
      
      const usersData = snapshot.val();
      const firebaseUid = Object.keys(usersData)[0];
      const userRecord = usersData[firebaseUid];

      if (!userRecord || !firebaseUid) {
          throw new Error("Invalid User ID or password.");
      }

      if (userRecord.status === 'disabled') {
        throw new Error("Your account has been disabled. Please contact administration.");
      }

      const userEmail = userRecord.email;
      const userRole = userRecord.role.toLowerCase();

      if (!userEmail) {
        throw new Error("User data is incomplete.");
      }
      
      await signInWithEmailAndPassword(auth, userEmail, password);
      
      await update(ref(db, `users/${firebaseUid}`), {
          lastLogin: serverTimestamp()
      });

      toast({ variant: 'success', title: 'Login Successful', description: 'Welcome back!' });
      if (userRole === 'admin') {
        router.push('/admin/dashboard');
      } else if (userRole === 'staff') {
        router.push('/staff/courses');
      } else {
        router.push('/student/dashboard');
      }

    } catch (error: any) {
      console.error("Login failed:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid User ID or password. Please try again.",
      });
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetUserId) {
        toast({ variant: 'destructive', title: 'User ID required' });
        return;
    }
    setResetLoading(true);
    try {
        const usersRef = ref(db, 'users');
        const q = query(usersRef, orderByChild('id'), equalTo(resetUserId.trim()));
        const snapshot = await get(q);

        if (!snapshot.exists()) {
            throw new Error("User ID not found.");
        }
        
        const usersData = snapshot.val();
        const userEmail = Object.values(usersData)[0].email;

        if (!userEmail) {
            throw new Error("User email not found in records.");
        }

        await sendPasswordResetEmail(auth, userEmail);
        toast({ title: 'Password Reset Email Sent', description: 'Please check your email inbox for instructions.' });
        setIsResetOpen(false);
        setResetUserId('');

    } catch(error: any) {
         toast({ variant: 'destructive', title: 'Password Reset Failed', description: error.message });
    } finally {
        setResetLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-block">
            <Logo />
          </div>
        </div>
        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  type="text"
                  placeholder="e.g., STU-001"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                    <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                        <DialogTrigger asChild>
                            <Button variant="link" type="button" className="ml-auto inline-block text-sm underline">Forgot your password?</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Reset Password</DialogTitle>
                                <DialogDescription>Enter your User ID to receive a password reset link at your registered email address.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-2">
                                <Label htmlFor="reset-user-id">User ID</Label>
                                <Input id="reset-user-id" placeholder="e.g., STU-001" value={resetUserId} onChange={e => setResetUserId(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline" type="button">Cancel</Button></DialogClose>
                                <Button onClick={handlePasswordReset} disabled={resetLoading}>
                                    {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Send Reset Link
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
             
              <Button type="submit" className="w-full !mt-6" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Log in'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              Having trouble?{" "}
              <Link href="/contact" className="underline">
                Contact administration
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
