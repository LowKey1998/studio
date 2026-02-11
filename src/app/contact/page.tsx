'use client';
import { useState } from "react";
import Link from "next/link";
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
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill out all fields.",
      });
      return;
    }
    setLoading(true);

    // Simulate sending an email
    await new Promise(resolve => setTimeout(resolve, 1500));

    setLoading(false);
    toast({
      variant: 'success',
      title: 'Message Sent',
      description: "Your inquiry has been sent to the administrator. We will get back to you shortly.",
    });

    // Reset form
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
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
            <CardTitle className="font-headline text-2xl">Contact Administrator</CardTitle>
            <CardDescription>Use this form for technical support, account issues, or to request a password reset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-primary/5 border-primary/20">
                <Mail className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-bold">Direct Email</AlertTitle>
                <AlertDescription className="text-xs">
                    Messages from this form are sent directly to <span className="font-bold">geraldaphiri@gmail.com</span>
                </AlertDescription>
            </Alert>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="email">Your Registered Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="e.g., Forgotten Password / Account Unlock"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Details</Label>
                <Textarea
                  id="message"
                  placeholder="Please provide your User ID and a clear description of your issue..."
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={loading}
                  rows={5}
                />
              </div>
             
              <Button type="submit" className="w-full !mt-6" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Send Request'}
              </Button>
            </form>
          </CardContent>
           <CardFooter className="justify-center">
             <Button variant="link" asChild>
                <Link href="/login">
                    <ArrowLeft className="mr-2 h-4 w-4"/>
                    Back to Login
                </Link>
             </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}