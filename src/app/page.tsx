'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Logo from '@/components/logo';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  if (user) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container z-40 bg-background">
        <div className="flex h-20 items-center justify-between py-6">
          <Logo />
          <nav className="hidden gap-6 md:flex">
            <Link href="/vacancies" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
              Careers
            </Link>
            <Button asChild>
                <Link href="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center gap-6 pb-8 pt-6 text-center md:pb-12 md:pt-10 lg:py-32">
          <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
            A modern platform to manage your entire institution
          </h1>
          <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
            Edutrack360 provides a seamless, integrated experience for students, staff, and administrators, from course registration to library management.
          </p>
          <div className="flex w-full items-center justify-center gap-4">
            <Button asChild size="lg">
                <Link href="/login">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
                <Link href="/vacancies">View Openings</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
