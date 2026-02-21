'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ref, get } from "firebase/database";

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
import { Loader2, ArrowLeft, Smartphone } from "lucide-react";

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | undefined;
  }
}

export default function ParentLoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {},
        'expired-callback': () => {}
      });
    }
  };

  const validateParentPhone = async (phone: string) => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return false;

    const usersData = snapshot.val();
    const formattedPhone = phone.trim();

    for (const uid in usersData) {
      const user = usersData[uid];
      if (user.role === 'Student' && user.guardian?.contact === formattedPhone) {
        return true;
      }
    }
    return false;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setLoading(true);
    try {
      const isValid = await validateParentPhone(phoneNumber);
      if (!isValid) {
        throw new Error("This phone number is not registered as a guardian contact in our system.");
      }

      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier!;

      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      setStep('otp');
      toast({ title: "OTP Sent", description: "Please check your phone for the verification code." });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error.message || "An error occurred. Please try again.",
      });
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !confirmationResult) return;

    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      toast({ variant: 'success', title: 'Login Successful', description: 'Welcome to the Parent Portal.' });
      router.push('/parent/dashboard');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "The code you entered is invalid. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo />
        </div>
        <Card className="shadow-2xl border-primary/10">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Parent Secure Login</CardTitle>
            <CardDescription>
              {step === 'phone' 
                ? "Enter your registered mobile number to receive a secure login code." 
                : "Enter the 6-digit code sent to your phone."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'phone' ? (
              <form className="space-y-4" onSubmit={handleSendOtp}>
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number (with country code)</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+260 977 123456"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={loading}
                      className="pl-10 h-12"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic leading-tight">
                    Note: Your number must exactly match the guardian contact provided to the admissions office.
                  </p>
                </div>
                <div id="recaptcha-container"></div>
                <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Send Verification Code'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleVerifyOtp}>
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={loading}
                    className="text-center text-2xl tracking-[0.5em] font-black h-16 border-2 focus-visible:ring-primary"
                    maxLength={6}
                  />
                </div>
                <Button type="submit" className="w-full h-12 font-bold" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Verify & Log In'}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full text-xs font-bold uppercase tracking-widest opacity-60" 
                  onClick={() => setStep('phone')}
                  disabled={loading}
                >
                  Change Phone Number
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t pt-4 bg-muted/5">
            <Button variant="link" size="sm" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4"/>
                Return to Standard Login
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
