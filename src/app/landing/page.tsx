
'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/logo';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart2, CheckCircle2, Library, MessageSquare, MonitorPlay, Shield, Wallet, Banknote, Clock, FileText } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { ref, get, push, serverTimestamp, onValue } from 'firebase/database';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Separator } from '@/components/ui/separator';

type BankDetails = { bankName: string; accountName?: string; accountNumber: string; branchCode: string; swiftCode?: string; };
type Programme = { id: string; name: string; };
type LandingPageSettings = {
  heroImageUrl?: string;
  featuresImageUrl?: string;
};

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bankDetails, setBankDetails] = React.useState<BankDetails | null>(null);
  const [landingSettings, setLandingSettings] = React.useState<LandingPageSettings>({});
  const [programmes, setProgrammes] = React.useState<Programme[]>([]);
  const { institutionName } = useTheme();
  
  // Inquiry Form State
  const [inquiryName, setInquiryName] = React.useState('');
  const [inquiryContact, setInquiryContact] = React.useState('');
  const [inquiryProgramme, setInquiryProgramme] = React.useState('');
  const [studentType, setStudentType] = React.useState('');
  const [inquiryResults, setInquiryResults] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!authLoading && user) {
        router.push('/dashboard');
    }
  }, [user, authLoading, router]);


  React.useEffect(() => {
    const settingsRef = ref(db, 'settings');
    const unsubSettings = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if(data.bankDetails) setBankDetails(data.bankDetails);
            if(data.landingPage) setLandingSettings(data.landingPage);
        }
    });

    const programmesRef = ref(db, 'programmes');
    const unsubProgrammes = onValue(programmesRef, (snapshot) => {
        if (snapshot.exists()){
            const data = snapshot.val();
            setProgrammes(Object.keys(data).map(id => ({id, name: data[id].name})));
        }
    });

    return () => {
        unsubSettings();
        unsubProgrammes();
    };
  }, []);

  const handleInquirySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inquiryName || !inquiryContact || !inquiryProgramme || !inquiryResults || !studentType) {
          toast({ variant: 'destructive', title: 'Please fill all required fields.'});
          return;
      }
      setIsSubmitting(true);
      try {
        const leadData = {
            name: inquiryName,
            phone: inquiryContact,
            programmeOfInterest: inquiryProgramme,
            studentType: studentType,
            results: inquiryResults,
            source: 'Website Inquiry Form',
            status: 'New',
            createdAt: serverTimestamp()
        };
        await push(ref(db, 'admissions/leads'), leadData);

        toast({
            variant: 'success',
            title: 'Application Submitted!',
            description: "Thank you for your interest. Our admissions team will contact you shortly."
        });
        
        setInquiryName('');
        setInquiryContact('');
        setInquiryProgramme('');
        setInquiryResults('');
        setStudentType('');

      } catch (error) {
           toast({ variant: 'destructive', title: 'Submission failed. Please try again.'});
      } finally {
        setIsSubmitting(false);
      }
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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container z-40 bg-background/80 backdrop-blur-sm sticky top-0">
        <div className="flex h-20 items-center justify-between py-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-4">
            <Link href="/vacancies" className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary px-2">
              Careers
            </Link>
            <Button asChild>
                <Link href={user ? "/dashboard" : "/login"}>
                    {user ? 'Dashboard' : 'Login'}
                </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        
        <section className="relative w-full h-[60vh] md:h-[80vh] flex items-center justify-center text-white">
            <div className="absolute inset-0 bg-black/60 z-10" />
            <Image 
                src={landingSettings.heroImageUrl || "https://picsum.photos/1920/1080"} 
                alt="Campus hero image" 
                layout="fill" 
                objectFit="cover" 
                className="z-0" 
                data-ai-hint="university campus" 
                priority
            />
            <div className="container relative z-20 flex flex-col items-center justify-center gap-6 text-center">
                <div className="mx-auto max-w-4xl">
                <h1 className="text-4xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1] text-balance">
                    A modern platform to manage your entire institution
                </h1>
                <p className="mt-6 max-w-[750px] mx-auto text-lg text-slate-200 sm:text-xl">
                    {institutionName} provides a seamless, integrated experience for students, staff, and administrators, from course registration to library management.
                </p>
                </div>
                <div className="flex w-full items-center justify-center gap-4">
                <Button asChild size="lg">
                    <Link href="#inquiry-form">Apply Now</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                    <Link href="/vacancies">View Openings</Link>
                </Button>
                </div>
            </div>
        </section>

        {bankDetails?.bankName && (
            <section className="w-full py-12 lg:py-24">
                <div className="container">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Banknote/> Bank Payment Details</CardTitle>
                        <CardDescription>Use the following details for bank transfers. Please use student ID as the reference.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                            <div><dt className="font-semibold">Bank Name</dt><dd className="text-muted-foreground">{bankDetails.bankName}</dd></div>
                            {bankDetails.accountName && <div><dt className="font-semibold">Account Name</dt><dd className="text-muted-foreground">{bankDetails.accountName}</dd></div>}
                            <div><dt className="font-semibold">Account Number</dt><dd className="text-muted-foreground">{bankDetails.accountNumber}</dd></div>
                            <div><dt className="font-semibold">Branch Code</dt><dd className="text-muted-foreground">{bankDetails.branchCode}</dd></div>
                             {bankDetails.swiftCode && <div><dt className="font-semibold">SWIFT Code</dt><dd className="text-muted-foreground">{bankDetails.swiftCode}</dd></div>}
                        </dl>
                    </CardContent>
                </Card>
                </div>
            </section>
        )}

        <section id="features" className="relative bg-slate-50/50 dark:bg-slate-900/50 py-12 lg:py-24">
             {landingSettings.featuresImageUrl && (
                <div className="absolute inset-0 z-0 opacity-10">
                    <Image src={landingSettings.featuresImageUrl} alt="Abstract background" layout="fill" objectFit="cover" />
                </div>
            )}
            <div className="container relative z-10">
                <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                    <h2 className="font-headline text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Everything You Need</h2>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        One platform to manage every aspect of your educational institution, reducing complexity and improving efficiency.
                    </p>
                </div>
                <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3 mt-12">
                    {features.map((feature, i) => (
                        <div key={i} className="relative overflow-hidden rounded-lg border bg-background/80 p-2 backdrop-blur-sm">
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
            </div>
        </section>
        
        <section className="container py-12 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
              <h2 className="font-headline text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Designed for Everyone</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                  Tailored dashboards and tools for every role within your institution, empowering users and simplifying daily tasks.
              </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-start mt-12">
              <div className="space-y-4">
                  <h3 className="text-2xl font-bold">For Students</h3>
                  <p className="text-muted-foreground">Empower your students with a modern, mobile-friendly portal. They can register for courses, view their timetable, access learning materials, track their results, and stay connected with the campus community, all in one place.</p>
                  <ul className="space-y-3">
                      <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Easy Course Registration & Payments</li>
                      <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Access to Grades & Attendance</li>
                      <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Integrated E-Learning Resources</li>
                  </ul>
              </div>
              <div className="space-y-4">
                  <h3 className="text-2xl font-bold">For Staff & Lecturers</h3>
                  <p className="text-muted-foreground">Equip your faculty with the tools they need to succeed. Manage courses, mark attendance, enter grades, and communicate with students effortlessly. HR and finance staff get dedicated modules to streamline their workflows.</p>
                  <ul className="space-y-3">
                      <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Simplified Grade & Attendance Entry</li>
                      <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Course & Resource Management</li>
                      <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary"/> Leave and Payroll Management</li>
                  </ul>
              </div>
          </div>
        </section>

        <section id="inquiry-form" className="w-full pb-12 lg:pb-24">
            <div className="container grid md:grid-cols-2 gap-12 items-start">
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h2 className="font-headline text-3xl">Admission Requirements</h2>
                        <p className="text-muted-foreground">Please ensure you meet the following criteria before applying.</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold">Minimum Academic Qualifications</h4>
                            <ul className="list-disc pl-5 mt-2 text-muted-foreground text-sm space-y-1">
                                <li>Full Grade 12 Certificate with 5 credits or better.</li>
                                <li>Required subjects: English, Mathematics, and any Science.</li>
                                <li>Two additional subjects of your choice.</li>
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-semibold">Required Documents</h4>
                             <ul className="list-disc pl-5 mt-2 text-muted-foreground text-sm space-y-1">
                                <li>Certified copy of your Grade 12 Certificate or Statement of Results.</li>
                                <li>Certified copy of your National Registration Card (NRC) or passport.</li>
                                <li>Two passport-sized photos.</li>
                                <li>Recommendation letter from your previous school or employer.</li>
                            </ul>
                        </div>
                         <div>
                            <h4 className="font-semibold">Transfer & International Students</h4>
                            <p className="text-muted-foreground text-sm mt-2">Additional documentation, such as academic transcripts and study permits, may be required. Please contact our admissions office for more details.</p>
                        </div>
                    </div>
                </div>
                 <Card className="shadow-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="font-headline text-3xl">Apply Online</CardTitle>
                        <CardDescription>Interested in joining us? Fill out the form below and our team will get in touch.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleInquirySubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label htmlFor="inq-name">Full Name</Label><Input id="inq-name" value={inquiryName} onChange={e => setInquiryName(e.target.value)} required/></div>
                                <div className="space-y-1"><Label htmlFor="inq-contact">Phone or Email</Label><Input id="inq-contact" value={inquiryContact} onChange={e => setInquiryContact(e.target.value)} required/></div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="inq-prog">Programme of Interest</Label>
                                    <Select value={inquiryProgramme} onValueChange={setInquiryProgramme}><SelectTrigger id="inq-prog"><SelectValue placeholder="Select a programme..."/></SelectTrigger><SelectContent>{programmes.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select>
                                </div>
                                 <div className="space-y-1">
                                    <Label htmlFor="inq-student-type">Student Type</Label>
                                    <Select value={studentType} onValueChange={setStudentType}><SelectTrigger id="inq-student-type"><SelectValue placeholder="Select type..."/></SelectTrigger><SelectContent>
                                        <SelectItem value="New Applicant">New Applicant</SelectItem>
                                        <SelectItem value="Transfer Student">Transfer Student</SelectItem>
                                        <SelectItem value="International Student">International Student</SelectItem>
                                    </SelectContent></Select>
                                </div>
                            </div>
                            <div className="space-y-1"><Label htmlFor="inq-results">Results / Qualifications</Label><Textarea id="inq-results" placeholder="e.g., 5 Credits including Maths & English..." value={inquiryResults} onChange={e => setInquiryResults(e.target.value)} required/></div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4"/>}Submit Application</Button>
                        </form>
                    </CardContent>
                </Card>
          </div>
        </section>

        <section id="cta" className="bg-slate-50/50 dark:bg-slate-900/50 py-12 lg:py-24">
          <div className="container">
              <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center">
                  <h2 className="font-headline text-3xl leading-[1.1] sm:text-3xl md:text-5xl">Transform Your Institution Today</h2>
                  <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                      Ready to streamline your operations and enhance the educational experience? Get started with {institutionName}.
                  </p>
                  <Button asChild size="lg">
                      <Link href="/login">Get Started <ArrowRight className="ml-2 h-4 w-4"/></Link>
                  </Button>
              </div>
          </div>
        </section>

      </main>
       <footer className="container">
            <div className="flex flex-col items-center justify-between gap-4 border-t py-10 md:h-24 md:flex-row md:py-0">
                <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                    <Logo />
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">© {new Date().getFullYear()} {institutionName}. All rights reserved.</p>
                </div>
            </div>
        </footer>
    </div>
  );
}
