'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, BookOpen, Info, Hand, Calendar as CalendarIcon, Clock, Banknote, FileQuestion, Library, UserCheck } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerNames: string;
};

type TimetableEntry = {
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    courseCode: string;
    courseName: string;
};

type AssessmentEvent = {
    title: string;
    date: string;
    type: 'deadline' | 'quiz';
    link?: string;
};

type SemesterCourses = {
    semesterId: string;
    semesterName: string;
    courses: Course[];
    attendancePercentage: number;
    timetable: TimetableEntry[];
    assessments: AssessmentEvent[];
};

type BankDetails = { id: string; bankName: string; accountName?: string; accountNumber: string; branchCode: string; swiftCode?: string; };

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if(!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentSemesterOverviewPage() {
    const [activeSemesters, setActiveSemesters] = React.useState<SemesterCourses[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [bankDetails, setBankDetails] = React.useState<BankDetails[]>([]);
    const [countdown, setCountdown] = React.useState('');
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribe();
      }, []);

    const fetchDashboardData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [registrationsSnap, semestersSnap, coursesSnap, usersSnap, attendanceSnap, timetablesSnap, calendarSnap, settingsSnap, quizzesSnap] = await Promise.all([
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'attendance')),
                get(ref(db, 'timetables')),
                get(ref(db, 'calendarEvents')),
                get(ref(db, 'settings')),
                get(ref(db, 'quizzes'))
            ]);

            if (settingsSnap.exists()) {
                const settingsData = settingsSnap.val();
                if(settingsData.bankDetails) {
                    const banks = Object.entries(settingsData.bankDetails).map(([id, data]: [string, any]) => ({ id, ...data }));
                    setBankDetails(banks);
                }
            }

            if (!registrationsSnap.exists()) {
                setActiveSemesters([]);
                setLoading(false);
                return;
            }
            
            const allSemesters = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const allAttendance = attendanceSnap.val() || {};
            const allTimetables = timetablesSnap.val() || {};
            const allCalendarEvents = calendarSnap.val() || {};
            const allQuizzes = quizzesSnap.val() || {};
            
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const semesterCourseMap: Record<string, Course[]> = {};
            const registrationsData = registrationsSnap.val();
            const userProfile = usersData[currentUser.uid];
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                if (registration.status === 'Completed' || registration.status === 'Pending Payment') {
                    if(!semesterCourseMap[semesterId]) semesterCourseMap[semesterId] = [];
                    for (const courseId of (registration.courses || [])) {
                        const courseInfo = coursesData[courseId];
                        if (courseInfo) {
                            const lecturerNames = (courseInfo.lecturerIds || []).map((lid: string) => userMap.get(lid)).filter(Boolean).join(', ') || userMap.get(courseInfo.lecturerId) || 'Unassigned';
                            semesterCourseMap[semesterId].push({
                                id: courseId,
                                name: courseInfo.name,
                                code: courseInfo.code,
                                lecturerNames
                            });
                        }
                    }
                }
            }

            const newActiveSemesters: SemesterCourses[] = [];
            let nextDeadline: Date | null = null;

            for (const semesterId in semesterCourseMap) {
                const semesterInfo = allSemesters[semesterId];
                const courses = semesterCourseMap[semesterId];

                let totalPresent = 0;
                let totalMarked = 0;
                courses.forEach(course => {
                    const courseAttendance = allAttendance[course.id];
                    if (courseAttendance) {
                        Object.values(courseAttendance).forEach((dailyRecord: any) => {
                             const status = dailyRecord[currentUser.uid];
                             if(status) {
                                 totalMarked++;
                                 if (status === 'Present' || status === 'Late' || status === 'Excused Absence') {
                                     totalPresent++;
                                 }
                             }
                        });
                    }
                });
                const attendancePercentage = totalMarked > 0 ? (totalPresent / totalMarked) * 100 : 100;
                
                const timetableEntries: TimetableEntry[] = [];
                if(allTimetables[semesterId]) {
                    courses.forEach(course => {
                        if (allTimetables[semesterId][course.id]) {
                            Object.values(allTimetables[semesterId][course.id]).forEach((entry: any) => {
                                timetableEntries.push({ ...entry, courseCode: course.code, courseName: course.name });
                            });
                        }
                    });
                }
                
                const assessmentEvents: AssessmentEvent[] = [];
                Object.values(allCalendarEvents).forEach((event: any) => {
                    if (event.semester === semesterInfo?.name) {
                        assessmentEvents.push({ title: event.title, date: event.date, type: 'deadline' });
                        if(event.title.toLowerCase().includes('deadline')) {
                            const eventDate = parseISO(event.date);
                            if (!nextDeadline || eventDate < nextDeadline) {
                                nextDeadline = eventDate;
                            }
                        }
                    }
                });

                 Object.entries(allQuizzes).forEach(([quizId, quiz]: [string, any]) => {
                    if(quiz.programmeIds?.includes(userProfile.programmeId) && quiz.intakeIds?.includes(userProfile.intakeId)){
                        if(quiz.startTime) {
                            assessmentEvents.push({ title: quiz.title, date: quiz.startTime, type: 'quiz', link: `/student/quizzes/${quizId}` });
                        }
                    }
                });

                const semesterData = {
                    semesterId: semesterId,
                    semesterName: semesterInfo?.name || "Unknown Semester",
                    courses,
                    attendancePercentage,
                    timetable: timetableEntries,
                    assessments: assessmentEvents,
                };

                if(semesterInfo && semesterInfo.status !== 'Archived') {
                    newActiveSemesters.push(semesterData);
                }
            }

            if (nextDeadline) {
                const daysLeft = differenceInDays(nextDeadline, new Date());
                if (daysLeft >= 0) {
                    setCountdown(`${daysLeft} day(s) until next payment deadline.`);
                }
            }
            
            setActiveSemesters(newActiveSemesters.sort((a,b) => b.semesterName.localeCompare(a.semesterName)));

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch dashboard data." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);


    React.useEffect(() => {
        if (currentUser) {
            fetchDashboardData();
        }
    }, [currentUser, fetchDashboardData]);
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">My Dashboard</CardTitle>
                    <CardDescription>Enrolled classes and schedules.</CardDescription>
                </CardHeader>
            </Card>

             {countdown && (
              <div className="animate-pulse text-sm font-semibold flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 py-3">
                <Clock className="h-4 w-4"/>
                <span>{countdown}</span>
              </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                       <Skeleton key={index} className="h-48 w-full" />
                    ))}
                </div>
            ) : activeSemesters.length > 0 ? (
                <div className="space-y-4">
                    {activeSemesters.map((semester) => (
                    <Card key={semester.semesterId} className="shadow-lg">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{semester.semesterName}</CardTitle>
                                <Badge variant="outline">{semester.courses.length} Course(s)</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">Attendance</span>
                                    <span className="font-bold">{semester.attendancePercentage.toFixed(0)}%</span>
                                </div>
                                <Progress value={semester.attendancePercentage} />
                            </div>
                            <div className="grid lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <h4 className="font-semibold mb-2">Timetable</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-px border rounded-lg overflow-hidden">
                                        {daysOfWeek.map(day => (
                                            <div key={day} className="bg-card">
                                                <h3 className="font-semibold text-center text-[10px] p-1 border-b bg-muted/50">{day}</h3>
                                                <div className="p-1 space-y-1 min-h-[80px]">
                                                    {semester.timetable
                                                        .filter(entry => entry.day === day)
                                                        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                                                        .map((entry, index) => (
                                                            <div key={index} className="p-1 text-[9px] rounded-md bg-primary/10 border border-primary/20">
                                                                <p className="font-bold text-primary">{entry.courseCode}</p>
                                                                <p>{entry.startTime}</p>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Dates</h4>
                                    <div className="space-y-2">
                                        {semester.assessments.slice(0, 3).map((event, index) => (
                                            <div key={index} className="flex justify-between text-xs p-2 border rounded bg-muted/20">
                                                <span className="truncate pr-2">{event.title.split(' - ')[0]}</span>
                                                <span className="font-medium whitespace-nowrap">{format(parseISO(event.date), 'dd MMM')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    ))}
                </div>
            ) : (
                <Alert><Info className="h-4 w-4" /><AlertTitle>No Active Classes</AlertTitle><AlertDescription>Complete your registration to see your dashboard.</AlertDescription></Alert>
            )}

            {bankDetails.length > 0 && (
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Banknote/> Payment Details</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    {bankDetails.map((bank, idx) => (
                        <div key={bank.id} className={idx > 0 ? "pt-6 border-t" : ""}>
                            <h4 className="font-bold mb-3 text-primary">{String(bank.bankName)}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {bank.accountName && <div><p className="text-[10px] uppercase text-muted-foreground">Account Name</p><p className="font-medium">{String(bank.accountName)}</p></div>}
                                <div><p className="text-[10px] uppercase text-muted-foreground">Account Number</p><p className="font-mono font-medium">{String(bank.accountNumber)}</p></div>
                                <div><p className="text-[10px] uppercase text-muted-foreground">Branch Code</p><p className="font-medium">{String(bank.branchCode)}</p></div>
                                {bank.swiftCode && <div><p className="text-[10px] uppercase text-muted-foreground">SWIFT</p><p className="font-mono font-medium">{String(bank.swiftCode)}</p></div>}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            )}
        </div>
    );
}
