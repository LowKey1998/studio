'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Info, User, DollarSign, Hand, Calendar, BookOpen, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

type UserProfile = { programmeId?: string; name?: string; intakeId?: string; };
type Semester = { name: string; status: string; paymentPlanIds?: Record<string, boolean> };
type CalendarEvent = { title: string; date: string; semester: string; };

export default function ParentDashboardPage() {
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [studentProfile, setStudentProfile] = React.useState<UserProfile | null>(null);
    const [feeBalance, setFeeBalance] = React.useState(0);
    const [attendancePercentage, setAttendancePercentage] = React.useState(0);
    const [upcomingDeadlines, setUpcomingDeadlines] = React.useState<CalendarEvent[]>([]);
    const [currentCourses, setCurrentCourses] = React.useState<{code:string, name: string}[]>([]);
    
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) setCurrentUser(user);
            else setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const usersRef = ref(db, 'users');
                const usersSnap = await get(usersRef);
                let studentUid: string | null = null;
                let studentData: any = null;

                if (usersSnap.exists()) {
                    const allUsers = usersSnap.val();
                    for (const uid in allUsers) {
                        const guardian = allUsers[uid].guardian;
                        const matchesEmail = guardian?.email && guardian.email === currentUser.email;
                        const matchesPhone = guardian?.contact && (guardian.contact === currentUser.phoneNumber || guardian.contact.replace(/\s+/g, '') === currentUser.phoneNumber);
                        
                        if (matchesEmail || matchesPhone) {
                            studentUid = uid;
                            studentData = allUsers[uid];
                            break;
                        }
                    }
                }

                if (!studentUid || !studentData) {
                    toast({ variant: 'destructive', title: 'Student Not Found', description: 'Could not find a student account associated with your verified contact details.' });
                    setLoading(false);
                    return;
                }
                setStudentProfile(studentData);

                const [registrationsSnap, invoicesSnap, transactionsSnap, attendanceSnap, calendarSnap, coursesSnap, semestersSnap] = await Promise.all([
                    get(ref(db, `registrations/${studentUid}`)),
                    get(ref(db, `invoices/${studentUid}`)),
                    get(ref(db, 'transactions')),
                    get(ref(db, 'attendance')),
                    get(ref(db, 'calendarEvents')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'semesters'))
                ]);

                const regsData = registrationsSnap.val() || {};
                const invoicesData = invoicesSnap.val() || {};
                const transactionsData = transactionsSnap.val() || {};
                const attendanceData = attendanceSnap.val() || {};
                const calendarData = calendarSnap.val() || {};
                const coursesData = coursesSnap.val() || {};
                const semestersData = semestersSnap.val() || {};

                let totalDue = 0;
                let totalPaid = 0;
                let activeSemesterId = null;
                
                Object.values(semestersData).forEach((sem: any) => {
                    if (sem.status === 'Open') {
                        if(regsData[sem.id]){
                            activeSemesterId = sem.id;
                        }
                    }
                });

                if (activeSemesterId && regsData[activeSemesterId]) {
                    const currentReg = regsData[activeSemesterId];
                    if (currentReg.invoiceId && invoicesData[currentReg.invoiceId]) {
                        const invoice = invoicesData[currentReg.invoiceId];
                        const tuition = Number(invoice.totalTuition || 0);
                        const mandatory = Number(invoice.totalMandatoryFees || 0);
                        const optional = Number(invoice.totalOptionalFees || 0);
                        const late = Number(invoice.lateFee || 0);
                        const scholarPerc = Number(invoice.scholarshipPercentage || 100);

                        totalDue = invoice.applyScholarship 
                            ? (tuition * (1 - (scholarPerc / 100))) + mandatory + optional + late
                            : tuition + mandatory + optional + late;
                    }
                    if(currentReg.courses) {
                       const coursesArr = Array.isArray(currentReg.courses) ? currentReg.courses : Object.keys(currentReg.courses);
                       setCurrentCourses(coursesArr.map((cid: string) => coursesData[cid]).filter(Boolean));
                    }
                }
                
                Object.values(transactionsData).forEach((tx: any) => {
                    if (tx.userId === studentUid && tx.status === 'successful') totalPaid += (tx.amount || 0);
                });
                setFeeBalance(Math.max(0, totalDue - totalPaid));

                let markedClasses = 0;
                let attendedClasses = 0;
                Object.values(attendanceData).forEach((courseAttendance: any) => {
                    Object.values(courseAttendance).forEach((dailyRecord: any) => {
                        const status = dailyRecord[studentUid];
                        if (status) {
                            markedClasses++;
                            if (status === 'Present' || status === 'Late' || status === 'Excused Absence') {
                                attendedClasses++;
                            }
                        }
                    });
                });
                setAttendancePercentage(markedClasses > 0 ? (attendedClasses / markedClasses) * 100 : 100);

                setUpcomingDeadlines(Object.values(calendarData as Record<string, CalendarEvent>)
                    .filter(e => new Date(e.date) >= new Date())
                    .sort((a,b) => a.date.localeCompare(b.date))
                    .slice(0, 3));

            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load dashboard data.' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, toast]);

    if (loading) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
    
    if (!studentProfile) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full border-dashed border-2">
                    <CardContent className="pt-12 pb-12 flex flex-col items-center text-center gap-4">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                            <Info className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <AlertTitle className="font-bold text-xl">Account Not Linked</AlertTitle>
                        <AlertDescription>
                            We couldn't find a student account associated with your contact information. Please ensure the student has provided your phone number correctly in their profile.
                        </AlertDescription>
                        <Button variant="outline" onClick={() => auth.signOut()}>Log Out</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-primary/10">
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="font-headline text-2xl">Welcome, Guardian of {studentProfile.name}</CardTitle>
                        <CardDescription className="font-medium text-primary/80">{studentProfile.programmeName}</CardDescription>
                    </div>
                </CardHeader>
            </Card>

             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-md border-l-4 border-l-destructive">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <DollarSign className="h-4 w-4"/> Fee Balance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black text-destructive">ZMW {feeBalance.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 italic">Outstanding for the current semester</p>
                    </CardContent>
                </Card>

                 <Card className="shadow-md border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Hand className="h-4 w-4"/> Attendance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-2xl font-black text-primary">{attendancePercentage.toFixed(0)}%</span>
                            <span className="text-[10px] font-bold text-muted-foreground">RELIABILITY</span>
                        </div>
                        <Progress value={attendancePercentage} className="h-1.5" />
                    </CardContent>
                </Card>

                <Card className="shadow-md border-l-4 border-l-orange-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Calendar className="h-4 w-4"/> Key Deadlines
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {upcomingDeadlines.length > 0 ? upcomingDeadlines.map(event => (
                            <div key={event.title} className="flex justify-between text-xs items-center p-1.5 bg-muted/30 rounded border border-dashed">
                                <span className="font-medium truncate pr-2">{event.title.split(' - ')[0]}</span>
                                <Badge variant="outline" className="bg-background text-[9px] font-bold">{format(parseISO(event.date), 'dd MMM')}</Badge>
                            </div>
                        )) : <p className="text-xs text-muted-foreground text-center py-2 italic">No upcoming deadlines.</p>}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-lg border-primary/5">
                <CardHeader className="border-b bg-muted/5">
                    <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary"/> Enrolled Courses</CardTitle>
                    <CardDescription>Academic progress for the active session.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        {currentCourses.length > 0 ? currentCourses.map(course => (
                            <div key={course.code} className="flex justify-between items-center p-4 border rounded-xl bg-card hover:bg-muted/30 transition-colors shadow-sm">
                                <div>
                                    <p className="font-bold text-sm">{course.name}</p>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{course.code}</p>
                                </div>
                                <Badge variant="secondary" className="text-[10px] font-bold">Active</Badge>
                            </div>
                        )) : (
                            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
                                <p className="text-sm text-muted-foreground italic">No active course registrations found for this semester.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
