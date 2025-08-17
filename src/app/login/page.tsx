
'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ref, get, child } from "firebase/database";

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

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

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
      // 1. Find the user's data in Realtime DB by their ID
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);

      if (!snapshot.exists()) {
        throw new Error("Invalid User ID or password.");
      }
      
      const usersData = snapshot.val();
      let userRecord = null;
      let firebaseUid = null;

      for (const uid in usersData) {
        if (usersData[uid].id === userId.trim()) {
          userRecord = usersData[uid];
          firebaseUid = uid;
          break;
        }
      }

      if (!userRecord || !firebaseUid) {
          throw new Error("Invalid User ID or password.");
      }

      // 2. Check if the user is disabled in the database
      if (userRecord.status === 'disabled') {
        throw new Error("Your account has been disabled. Please contact administration.");
      }

      // 3. Extract email from the found user
      const userEmail = userRecord.email;
      const userRole = userRecord.role.toLowerCase();

      if (!userEmail) {
        throw new Error("User data is incomplete.");
      }
      
      // 4. Authenticate with Firebase Auth using the retrieved email
      await signInWithEmailAndPassword(auth, userEmail, password);
      
      // 5. Redirect based on role
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
                  <Link href="#" className="ml-auto inline-block text-sm underline">
                    Forgot your password?
                  </Link>
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
              Don&apos;t have an account?{" "}
              <Link href="#" className="underline">
                Contact administration
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
