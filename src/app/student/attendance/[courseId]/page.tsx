'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, CheckCircle, XCircle, Clock, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';

type AttendanceRecord = {
    date: string;
    status: 'Present' | 'Absent' | 'Late' | 'Excused Absence';
};

type Course = {
    id: string;
    name: string;
    code: string;
};

const statusConfig: { [key in AttendanceRecord['status']]: { variant: "default" | "destructive" | "secondary", icon: React.ReactNode } } = {
  Present: { variant: 'default', icon: <CheckCircle className="mr-2 h-4 w-4" /> },
  Absent: { variant: 'destructive', icon: <XCircle className="mr-2 h-4 w-4" /> },
  Late: { variant: 'secondary', icon: <Clock className="mr-2 h-4 w-4" /> },
  'Excused Absence': { variant: 'secondary', icon: <Info className="mr-2 h-4 w-4" /> },
};


export default function StudentAttendanceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const [attendanceLog, setAttendanceLog] = React.useState<AttendanceRecord[]>([]);
    const [course, setCourse] = React.useState<Course | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        if (!currentUser || !courseId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersSnap, courseSnap, calendarSnap, semestersSnap, intakesSnap] = await Promise.all([
                    get(ref(db, `users/${currentUser.uid}`)),
                    get(ref(db, `courses/${courseId}`)),
                    get(ref(db, 'settings/academicCalendar')),
                    get(ref(db, 'semesters')),
                    get(ref(db, 'intakes'))
                ]);

                if (!courseSnap.exists()) {
                     toast({ variant: 'destructive', title: 'Error', description: 'Course not found.' });
                     router.push('/student/attendance');
                     return;
                }
                setCourse({ id: courseId, ...courseSnap.val() });

                // Calculate valid date range for current standing
                const userProfile = usersSnap.val();
                const allIntakes = intakesSnap.val() || {};
                const intakeName = userProfile.intakeId ? allIntakes[userProfile.intakeId]?.name : null;
                
                let semesterStart: Date | null = null;
                let semesterEnd: Date | null = null;

                if (intakeName && calendarSnap.exists()) {
                    const state = calculateAcademicState(
                        parseIntakeDate(intakeName)!, 
                        new Date(), 
                        calendarSnap.val().standardCycles, 
                        Object.values(calendarSnap.val().anomalies || {})
                    );

                    const allSemesters = semestersSnap.val() || {};
                    const matchingSem: any = Object.values(allSemesters).find((s: any) => 
                        s.intakeId === userProfile.intakeId && s.year === state.year && s.semesterInYear === state.semester
                    );

                    if (matchingSem?.startDate) semesterStart = parseISO(matchingSem.startDate);
                    if (matchingSem?.endDate) semesterEnd = parseISO(matchingSem.endDate);
                }

                // Fetch logs
                const attendanceRef = ref(db, `attendance/${courseId}`);
                onValue(attendanceRef, (snapshot) => {
                    const log: AttendanceRecord[] = [];
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        for (const date in data) {
                            const recordDate = parseISO(date);
                            // Strictly filter by date range of the current semester instance if available
                            const withinRange = (!semesterStart || recordDate >= semesterStart) && (!semesterEnd || recordDate <= semesterEnd);
                            
                            if (data[date][currentUser.uid] && withinRange) {
                                log.push({ date, status: data[date][currentUser.uid] });
                            }
                        }
                    }
                    setAttendanceLog(log.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                    setLoading(false);
                });

            } catch (error) {
                 console.error("Error fetching attendance details:", error);
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch attendance details.' });
                 setLoading(false);
            }
        };

        fetchData();

    }, [currentUser, courseId, toast, router]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-36" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
             <Button variant="outline" asChild>
                <Link href="/student/attendance"><ChevronLeft className="mr-2 h-4 w-4" /> Back to Summary</Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Detailed Log: {course?.name}</CardTitle>
                    <CardDescription>View every session marked for your current academic phase.</CardDescription>
                </CardHeader>
                <CardContent>
                    {attendanceLog.length > 0 ? (
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attendanceLog.map((record) => (
                                    <TableRow key={record.date} className="hover:bg-muted/50">
                                        <TableCell className="font-medium">{format(parseISO(record.date), 'PPP')}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusConfig[record.status]?.variant || 'secondary'} className="gap-1">
                                                {statusConfig[record.status]?.icon}
                                                {record.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                         <Alert className="border-dashed">
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Records for this Session</AlertTitle>
                            <AlertDescription>
                                No attendance data matches your current Year/Semester standing for this course.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
