
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, BookOpen, User, Info, Archive, Hand, Calendar as CalendarIcon, FileText, Clock, Banknote, FileQuestion } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, differenceInDays } from 'date-fns';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerName: string;
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

type BankDetails = { bankName: string; accountName: string; accountNumber: string; branchCode: string; swiftCode: string; };

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const timeToMinutes = (time: string) => {
    if(!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

export default function StudentSemesterOverviewPage() {
    const [activeSemesters, setActiveSemesters] = React.useState<SemesterCourses[]>([]);
    const [archivedSemesters, setArchivedSemesters] = React.useState<SemesterCourses[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [bankDetails, setBankDetails] = React.useState<BankDetails | null>(null);
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
                if(settingsData.bankDetails) setBankDetails(settingsData.bankDetails);
            }

            if (!registrationsSnap.exists()) {
                setActiveSemesters([]);
                setArchivedSemesters([]);
                setLoading(false);
                return;
            }
            
            const allSemesters = semestersSnap.exists() ? semestersSnap.val() : {};
            const coursesData = coursesSnap.exists() ? coursesSnap.val() : {};
            const usersData = usersSnap.exists() ? usersSnap.val() : {};
            const allAttendance = attendanceSnap.exists() ? attendanceSnap.val() : {};
            const allTimetables = timetablesSnap.exists() ? timetablesSnap.val() : {};
            const allCalendarEvents = calendarSnap.exists() ? Object.values(calendarSnap.val()) : [];
            const allQuizzes = quizzesSnap.exists() ? quizzesSnap.val() : {};
            
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const semesterCourseMap: Record<string, Course[]> = {};
            const registrationsData = registrationsSnap.val();
            const userProfile = usersData[currentUser.uid];
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                if (registration.status === 'Completed' || registration.status === 'Pending Payment') {
                    if(!semesterCourseMap[semesterId]) semesterCourseMap[semesterId] = [];
                    for (const courseId of registration.courses) {
                        const courseInfo = coursesData[courseId];
                        if (courseInfo) {
                            semesterCourseMap[semesterId].push({
                                id: courseId,
                                name: courseInfo.name,
                                code: courseInfo.code,
                                lecturerName: userMap.get(courseInfo.lecturerId) || 'N/A',
                            });
                        }
                    }
                }
            }

            const newActiveSemesters: SemesterCourses[] = [];
            const newArchivedSemesters: SemesterCourses[] = [];

            let nextDeadline: Date | null = null;

            for (const semesterId in semesterCourseMap) {
                const semesterInfo = allSemesters[semesterId];
                const courses = semesterCourseMap[semesterId];

                // Calculate attendance
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
                
                // Get Timetable
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
                
                // Get Assessments
                const assessmentEvents: AssessmentEvent[] = [];
                (allCalendarEvents as any[]).forEach((event: any) => {
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

                // Get Quizzes
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
                } else {
                    newArchivedSemesters.push(semesterData);
                }
            }

            if (nextDeadline) {
                const daysLeft = differenceInDays(nextDeadline, new Date());
                if (daysLeft >= 0) {
                    setCountdown(`${daysLeft} day(s) until next payment deadline.`);
                }
            }
            
            setActiveSemesters(newActiveSemesters.sort((a,b) => b.semesterName.localeCompare(a.semesterName)));
            setArchivedSemesters(newArchivedSemesters.sort((a,b) => b.semesterName.localeCompare(a.semesterName)));

        } catch (error) {
            console.error("Error fetching enrolled courses:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your enrolled courses." });
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
                    <CardDescription>An overview of your currently enrolled classes and schedules.</CardDescription>
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
                <Accordion type="single" collapsible className="w-full space-y-4" defaultValue={activeSemesters[0]?.semesterId}>
                    {activeSemesters.map((semester) => (
                    <Card key={semester.semesterId} className="shadow-lg">
                        <AccordionItem value={semester.semesterId} className="border-b-0">
                            <AccordionTrigger className="p-6 hover:no-underline">
                                <div className="w-full">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="font-headline">{semester.semesterName}</CardTitle>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            <span>{semester.courses.length} Course(s)</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1 mt-4 text-left">
                                        <div className="flex justify-between items-center text-sm">
                                            <div className="flex items-center text-muted-foreground"><Hand className="mr-2 h-4 w-4" /> <span>Overall Attendance</span></div>
                                            <span className="font-bold">{semester.attendancePercentage.toFixed(0)}%</span>
                                        </div>
                                        <Progress value={semester.attendancePercentage} />
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                                <div className="grid lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2">
                                        <h4 className="font-semibold mb-2">Class Timetable</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-px border bg-border overflow-hidden rounded-lg">
                                            {daysOfWeek.map(day => (
                                                <div key={day} className="bg-card">
                                                    <h3 className="font-semibold text-center text-xs p-2 border-b bg-muted/50">{day}</h3>
                                                    <div className="p-2 space-y-2 min-h-24">
                                                        {semester.timetable
                                                            .filter(entry => entry.day === day)
                                                            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                                                            .map((entry, index) => (
                                                                <div key={index} className="p-2 text-xs rounded-md bg-primary/10 text-primary-foreground border border-primary/20">
                                                                    <p className="font-bold text-primary">{entry.courseCode}</p>
                                                                    <p className="text-primary/80">{entry.startTime} - {entry.endTime}</p>
                                                                    <p className="text-primary/80">Venue: {entry.venue}</p>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Key Dates</h4>
                                        <div className="space-y-2">
                                            {semester.assessments
                                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                                .map((event, index) => (
                                                <Link key={index} href={event.link || '#'} passHref>
                                                <div className="flex items-center gap-2 p-2 border rounded-md hover:bg-accent cursor-pointer">
                                                    {event.type === 'quiz' ? <FileQuestion className="h-4 w-4 text-muted-foreground"/> : <CalendarIcon className="h-4 w-4 text-muted-foreground"/>}
                                                    <div>
                                                        <p className="text-sm font-medium">{event.title.replace(`- ${semester.semesterName}`, '')}</p>
                                                        <p className="text-xs text-muted-foreground">{format(parseISO(event.date), 'PPP')}</p>
                                                    </div>
                                                </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                    ))}
                </Accordion>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Classes Found</AlertTitle>
                            <AlertDescription>
                                You are not enrolled in any classes. Please complete your course registration and payment first.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}

            {bankDetails?.accountName && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Banknote/> Bank Payment Details</CardTitle>
                    <CardDescription>Use the following details for bank transfers. Please use your student ID as the reference.</CardDescription>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                        <div><dt className="font-semibold">Bank Name</dt><dd className="text-muted-foreground">{bankDetails.bankName}</dd></div>
                        <div><dt className="font-semibold">Account Name</dt><dd className="text-muted-foreground">{bankDetails.accountName}</dd></div>
                        <div><dt className="font-semibold">Account Number</dt><dd className="text-muted-foreground">{bankDetails.accountNumber}</dd></div>
                        <div><dt className="font-semibold">Branch Code</dt><dd className="text-muted-foreground">{bankDetails.branchCode}</dd></div>
                    </dl>
                </CardContent>
            </Card>
            )}

            {archivedSemesters.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="archived-courses">
                        <AccordionTrigger>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <Archive className="h-5 w-5"/>
                                Archived Semesters
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-4">
                                {archivedSemesters.map((semester) => (
                                <Card key={semester.semesterId} className="flex flex-col justify-between shadow-lg opacity-70">
                                    <CardHeader>
                                        <CardTitle className="font-headline">{semester.semesterName}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            <span>{semester.courses.length} Course(s)</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                    <Button asChild className="w-full" variant="secondary" disabled>
                                        <Link href={`/student/semester/${semester.semesterId}`}>
                                            View Details <ChevronRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                    </CardFooter>
                                </Card>
                                ))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
}
