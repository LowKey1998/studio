'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart2, CheckCircle2, Library, MessageSquare, MonitorPlay, Shield, Wallet } from 'lucide-react';
import Image from 'next/image';

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

  const features = [
    {
        icon: <Library className="h-8 w-8 text-primary" />,
        title: 'Unified Platform',
        description: 'Manage academics, finance, HR, and student life from a single, intuitive dashboard.',
    },
    {
        icon: <MonitorPlay className="h-8 w-8 text-primary" />,
        title: 'E-Learning Tools',
        description: 'Engage students with online quizzes, assignments, video lectures, and discussion forums.',
    },
    {
        icon: <Wallet className="h-8 w-8 text-primary" />,
        title: 'Financial Management',
        description: 'Automate invoicing, track payments, manage expenses, and integrate with accounting software.',
    },
    {
        icon: <BarChart2 className="h-8 w-8 text-primary" />,
        title: 'Data-Driven Insights',
        description: 'Access real-time analytics on enrollment, attendance, and financial performance.',
    },
    {
        icon: <Shield className="h-8 w-8 text-primary" />,
        title: 'Secure & Scalable',
        description: 'Built on a robust and secure infrastructure that grows with your institution.',
    },
    {
        icon: <MessageSquare className="h-8 w-8 text-primary" />,
        title: 'Seamless Communication',
        description: 'Keep students, staff, and parents informed with integrated notifications and messaging.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <header className="container z-40 bg-background/80 backdrop-blur-sm sticky top-0">
        <div className="flex h-20 items-center justify-between py-6">
          <Logo />
          <nav className="hidden gap-6 md:flex items-center">
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
        {/* Hero Section */}
        <section className="container flex flex-col items-center justify-center gap-6 pb-12 pt-10 text-center md:pb-24 md:pt-16 lg:py-32">
          <h1 className="text-4xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
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

        {/* Features Section */}
        <section id="features" className="container space-y-6 bg-slate-50/50 dark:bg-slate-900/50 py-12 lg:py-24">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <h2 className="font-headline text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Everything You Need</h2>
                <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                    One platform to manage every aspect of your educational institution, reducing complexity and improving efficiency.
                </p>
            </div>
            <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
                {features.map((feature, i) => (
                     <div key={i} className="relative overflow-hidden rounded-lg border bg-background p-2">
                        <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                            {feature.icon}
                            <div className="space-y-2">
                                <h3 className="font-bold">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
        
        {/* Showcase Section */}
        <section className="container space-y-6 py-12 lg:py-24">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                <h2 className="font-headline text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Designed for Everyone</h2>
                <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                    Tailored dashboards and tools for every role within your institution, empowering users and simplifying daily tasks.
                </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                    <h3 className="text-2xl font-bold mb-4">For Students</h3>
                    <p className="text-muted-foreground mb-6">Empower your students with a modern, mobile-friendly portal. They can register for courses, view their timetable, access learning materials, track their results, and stay connected with the campus community, all in one place.</p>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Easy Course Registration & Payments</li>
                        <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Access to Grades & Attendance</li>
                        <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Integrated E-Learning Resources</li>
                    </ul>
                </div>
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <Image src="https://placehold.co/600x400.png" alt="Student Dashboard" width={600} height={400} className="rounded-md" data-ai-hint="student dashboard"/>
                </div>
            </div>
             <div className="grid md:grid-cols-2 gap-8 items-center mt-12">
                 <div className="rounded-lg border bg-card p-4 shadow-sm md:order-2">
                    <Image src="https://placehold.co/600x400.png" alt="Staff Dashboard" width={600} height={400} className="rounded-md" data-ai-hint="lecturer dashboard"/>
                </div>
                <div className="md:order-1">
                    <h3 className="text-2xl font-bold mb-4">For Staff & Lecturers</h3>
                    <p className="text-muted-foreground mb-6">Equip your faculty with the tools they need to succeed. Manage courses, mark attendance, enter grades, and communicate with students effortlessly. HR and finance staff get dedicated modules to streamline their workflows.</p>
                     <ul className="space-y-3">
                        <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Simplified Grade & Attendance Entry</li>
                        <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Course & Resource Management</li>
                        <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Leave and Payroll Management</li>
                    </ul>
                </div>
            </div>
        </section>

        {/* CTA Section */}
        <section id="cta" className="container py-12 lg:py-24 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
                 <h2 className="font-headline text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Transform Your Institution Today</h2>
                  <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                    Ready to streamline your operations and enhance the educational experience? Get started with Edutrack360.
                </p>
                 <Button asChild size="lg">
                    <Link href="/login">Get Started <ArrowRight className="ml-2 h-4 w-4"/></Link>
                </Button>
            </div>
        </section>

      </main>
       <footer className="container">
            <div className="flex flex-col items-center justify-between gap-4 border-t py-10 md:h-24 md:flex-row md:py-0">
                <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                    <Logo />
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">© {new Date().getFullYear()} Edutrack360. All rights reserved.</p>
                </div>
            </div>
        </footer>
    </div>
  );
}
