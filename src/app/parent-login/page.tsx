'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/firebase";
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
import { Loader2, ArrowLeft, Smartphone, MessageCircle } from "lucide-react";

/**
 * Normalizes a phone number to a standard numeric format (e.g., 260977...)
 * for reliable database matching.
 */
const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); 
  
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '260' + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    cleaned = '260' + cleaned;
  }
  
  return cleaned;
};

export default function ParentLoginPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const validateParentPhone = async (phone: string) => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return false;

    const usersData = snapshot.val();
    const normalizedInput = normalizePhone(phone);

    for (const uid in usersData) {
      const user = usersData[uid];
      if (user.role === 'Student' && user.guardian?.contact) {
        const normalizedDb = normalizePhone(user.guardian.contact);
        if (normalizedInput === normalizedDb && normalizedInput.length >= 9) {
          return true;
        }
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

      // Format for E.164
      let finalPhone = phoneNumber.trim();
      if (!finalPhone.startsWith('+')) {
          finalPhone = '+' + normalizePhone(finalPhone);
      }

      // Attempt to send via WhatsApp channel
      const { error } = await supabase.auth.signInWithOtp({
        phone: finalPhone,
        options: {
            channel: 'whatsapp'
        }
      });

      if (error) throw error;

      setStep('otp');
      toast({ title: "WhatsApp Sent", description: "Please check your WhatsApp messages for the verification code." });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Failed to send OTP",
        description: error.message || "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    try {
      let finalPhone = phoneNumber.trim();
      if (!finalPhone.startsWith('+')) {
          finalPhone = '+' + normalizePhone(finalPhone);
      }

      const { error } = await supabase.auth.verifyOtp({
        phone: finalPhone,
        token: otp,
        type: 'sms', 
      });

      if (error) throw error;

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
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <MessageCircle className="text-green-600" />
                Parent Secure Login
            </CardTitle>
            <CardDescription>
              {step === 'phone' 
                ? "Enter your mobile number to receive a secure login code via WhatsApp." 
                : "Enter the 6-digit code sent to your WhatsApp."}
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
                    Ensure your number is registered with WhatsApp. Standard message rates may apply.
                  </p>
                </div>
                <Button type="submit" className="w-full h-12 font-bold bg-green-600 hover:bg-green-700" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Send WhatsApp Code'}
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