'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, Info, User, DollarSign, Hand, Calendar, BookOpen } from 'lucide-react';
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
type PaymentPlan = { id: string; name: string; installments: number; };
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
                // Find student associated with this parent
                const usersRef = ref(db, 'users');
                const usersSnap = await get(usersRef);
                let studentUid: string | null = null;
                let studentData: any = null;

                if (usersSnap.exists()) {
                    const allUsers = usersSnap.val();
                    for (const uid in allUsers) {
                        if (allUsers[uid].guardian?.email === currentUser.email) {
                            studentUid = uid;
                            studentData = allUsers[uid];
                            break;
                        }
                    }
                }

                if (!studentUid || !studentData) {
                    toast({ variant: 'destructive', title: 'Student Not Found', description: 'Could not find a student associated with your email.' });
                    setLoading(false);
                    return;
                }
                setStudentProfile(studentData);

                // Fetch all data in parallel
                const [registrationsSnap, invoicesSnap, transactionsSnap, attendanceSnap, calendarSnap, coursesSnap, semestersSnap, paymentPlansSnap] = await Promise.all([
                    get(ref(db, `registrations/${studentUid}`)),
                    get(ref(db, `invoices/${studentUid}`)),
                    get(ref(db, 'transactions')),
                    get(ref(db, 'attendance')),
                    get(ref(db, 'calendarEvents')),
                    get(ref(db, 'courses')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'settings/paymentPlans')),
                ]);

                const regsData = registrationsSnap.val() || {};
                const invoicesData = invoicesSnap.val() || {};
                const transactionsData = transactionsSnap.val() || {};
                const attendanceData = attendanceSnap.val() || {};
                const calendarData = calendarSnap.val() || {};
                const coursesData = coursesSnap.val() || {};
                const semestersData = semestersSnap.val() || {};
                const paymentPlansData = paymentPlansSnap.val() || {};

                // --- Calculate Balance & Get Current Courses ---
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
                        totalDue = (invoice.totalTuition || 0) + (invoice.totalMandatoryFees || 0) + (invoice.totalOptionalFees || 0) + (invoice.lateFee || 0);
                        if (invoice.applyScholarship) {
                            totalDue -= (invoice.totalTuition || 0);
                        }
                    }
                    if(currentReg.courses) {
                       setCurrentCourses(currentReg.courses.map((cid: string) => coursesData[cid]));
                    }
                }
                
                Object.values(transactionsData).forEach((tx: any) => {
                    if (tx.userId === studentUid) totalPaid += (tx.amount || 0);
                });
                setFeeBalance(totalDue - totalPaid);


                // --- Calculate Attendance ---
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

                // --- Find Upcoming Deadlines ---
                 setUpcomingDeadlines(Object.values(calendarData as Record<string, CalendarEvent>).filter(e => new Date(e.date) >= new Date()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3));


            } catch (e: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load dashboard data.' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, toast]);

    if (loading) {
        return <div className="space-y-4"><Skeleton className="h-48 w-full" /></div>
    }
    
    if (!studentProfile) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="destructive">
                        <Info className="h-4 w-4" />
                        <AlertTitle>No Associated Student</AlertTitle>
                        <AlertDescription>We couldn't find a student account linked to your email address. Please contact the administration.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }
    

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Welcome, Guardian of {studentProfile.name}</CardTitle>
                    <CardDescription>{studentProfile.programmeName}</CardDescription>
                </CardHeader>
            </Card>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign/>Outstanding Balance</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold">ZMW {feeBalance.toFixed(2)}</p></CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Hand/>Overall Attendance</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <Progress value={attendancePercentage} />
                        <p className="text-right font-semibold">{attendancePercentage.toFixed(0)}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Calendar/>Upcoming Deadlines</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {upcomingDeadlines.length > 0 ? upcomingDeadlines.map(event => (
                            <div key={event.title} className="flex justify-between">
                                <span>{event.title.split(' - ')[0]}</span>
                                <span className="font-medium">{format(parseISO(event.date), 'dd MMM')}</span>
                            </div>
                        )) : <p className="text-muted-foreground">No upcoming deadlines.</p>}
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader><CardTitle>Currently Enrolled Courses</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {currentCourses.length > 0 ? currentCourses.map(course => (
                            <div key={course.code} className="p-3 border rounded-md bg-muted/50">
                                <p className="font-semibold">{course.name}</p>
                                <p className="text-sm text-muted-foreground">{course.code}</p>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">No courses found for the current active semester.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
