'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ref, get, query, orderByChild, equalTo, update, serverTimestamp } from "firebase/database";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Smartphone, ShieldCheck } from "lucide-react";
import { logError } from "@/lib/error-logger";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please enter your User ID or Email and password.",
      });
      return;
    }
    setLoading(true);

    try {
      let emailToSign = identifier.trim();
      let userRole = '';
      let firebaseUid = '';

      if (identifier.includes('@')) {
          const userCredential = await signInWithEmailAndPassword(auth, emailToSign, password);
          const userRef = ref(db, `users/${userCredential.user.uid}`);
          const userSnap = await get(userRef);
          if (userSnap.exists()) {
              userRole = userSnap.val().role?.toLowerCase();
              firebaseUid = userCredential.user.uid;
          }
      } else {
          const usersRef = ref(db, 'users');
          const q = query(usersRef, orderByChild('id'), equalTo(identifier.trim()));
          const snapshot = await get(q);

          if (!snapshot.exists()) {
            throw new Error("Invalid User ID or password.");
          }
          
          const usersData = snapshot.val();
          firebaseUid = Object.keys(usersData)[0];
          const userRecord = usersData[firebaseUid];

          if (!userRecord || !firebaseUid) {
              throw new Error("Invalid User ID or password.");
          }

          if (userRecord.status === 'disabled') {
            throw new Error("Your account has been disabled. Please contact administration.");
          }

          emailToSign = userRecord.email;
          userRole = userRecord.role.toLowerCase();
          
          await signInWithEmailAndPassword(auth, emailToSign, password);
      }
      
      if (firebaseUid) {
          await update(ref(db, `users/${firebaseUid}`), {
              lastLogin: serverTimestamp()
          });
      }

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
      
      logError(
        error.message || "Login failed", 
        "Authentication", 
        { 
            attemptedIdentifier: identifier,
            errorCode: error.code || 'unknown'
        }
      );

      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
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
        <Card className="shadow-2xl border-primary/10">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Institutional Portal</CardTitle>
            <CardDescription>Sign in with your User ID or registered staff email.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="identifier">User ID / Email</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="e.g., STU-001 or john.doe@mail.com"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Enter Dashboard'}
              </Button>
            </form>
             
             <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground font-black tracking-widest">Guardian Access</span>
                </div>
            </div>

            <Button variant="outline" className="w-full h-12 border-2 border-primary/20 hover:bg-primary/5 gap-2" asChild>
                <Link href="/parent-login">
                    <Smartphone className="h-4 w-4 text-primary" />
                    Parent Secure Login (Phone)
                </Link>
            </Button>
          </CardContent>
           <CardFooter className="flex flex-col gap-2 justify-center mt-4 border-t pt-4">
             <Button variant="link" size="sm" asChild>
                <Link href="/contact" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Need technical assistance?
                </Link>
             </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
