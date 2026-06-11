'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, CalendarDays, UserCheck, Clock, AlertCircle, BookCopy, CheckCircle2, Users } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { differenceInCalendarDays, parseISO, isBefore, startOfDay, format } from 'date-fns';
import { cn } from '@/lib/utils';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerName: string;
    semesterId: string;
    semesterName: string;
    assignmentStatus?: {
        soon: number;
        late: number;
        earliestDueDate: string | null;
    };
    hasResultsPublished?: boolean;
    studentCount: number;
    assignments: {
        title: string;
        dueDate: string;
        isSubmitted: boolean;
        isOverdue: boolean;
    }[];
};

export default function StudentCoursesPage() {
    const [courses, setCourses] = React.useState<Course[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [intakeName, setIntakeName] = React.useState('');
    const [academicStanding, setAcademicStanding] = React.useState<string>('');
    const [semesterName, setSemesterName] = React.useState('');
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

    const fetchEnrolledCourses = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [usersSnap, regsSnap, semestersSnap, coursesSnap, intakesSnap, calendarSnap, assignmentsSnap, resultsSnap] = await Promise.all([
                get(ref(db, 'users')),
                get(ref(db, 'registrations')),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'assignments')),
                get(ref(db, 'resultsPublished'))
            ]);

            const allUsers = usersSnap.val() || {};
            const userProfile = allUsers[currentUser.uid];
            if (!userProfile) throw new Error("Profile not found");
            
            const studentIntakeId = userProfile.intakeId;
            const currentIntakeName = studentIntakeId ? intakesSnap.val()?.[studentIntakeId]?.name : null;
            setIntakeName(currentIntakeName || 'Your Intake');

            let calculatedState: any = null;
            if (calendarSnap.exists() && currentIntakeName) {
                const intakeStartStr = parseIntakeDate(currentIntakeName);
                if (intakeStartStr) {
                    calculatedState = calculateAcademicState(
                        intakeStartStr, 
                        new Date(), 
                        calendarSnap.val().standardCycles, 
                        Object.values(calendarSnap.val().anomalies || {})
                    );
                    setAcademicStanding(`Year ${calculatedState.year}, Sem ${calculatedState.semester}`);
                }
            }

            const allSemesters = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            const usersData = allUsers;
            const allAssignments = assignmentsSnap.val() || {};
            const allResultsPublished = resultsSnap.val() || {};
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const activeCourses: Course[] = [];
            const allRegistrations = regsSnap.val() || {};
            const registrationsData = allRegistrations[currentUser.uid] || {};
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                const semesterInfo = allSemesters[semesterId];
                if (!semesterInfo) continue;

                const isMatchingIntake = semesterInfo.intakeId === studentIntakeId;
                const isCurrentStanding = calculatedState?.year === semesterInfo.year && calculatedState?.semester === semesterInfo.semesterInYear;

                if (!isMatchingIntake || !isCurrentStanding) continue;
                
                setSemesterName(semesterInfo.name);

                const coursesArr = Array.isArray(registration.courses) ? registration.courses : Object.keys(registration.courses || {});
                for (const courseId of coursesArr) {
                    const courseInfo = coursesData[courseId];
                    if (courseInfo) {
                        const lecturerNames = (courseInfo.lecturerIds || [])
                            .map((id: string) => userMap.get(id))
                            .filter(Boolean)
                            .join(', ') || userMap.get(courseInfo.lecturerId) || 'N/A';

                        const courseAssignments = allAssignments[courseId] || allAssignments[`${courseId}_${semesterId}`] || {};
                        let soon = 0;
                        let late = 0;
                        let earliestDueDate = null;
                        const assignmentsList: any[] = [];

                        Object.values(courseAssignments).forEach((a: any) => {
                            const isSubmitted = !!a.submissions?.[currentUser.uid];
                            const dueDate = parseISO(a.dueDate);
                            const today = startOfDay(new Date());
                            const diff = differenceInCalendarDays(dueDate, today);
                            const isOverdue = isBefore(dueDate, today) && !isSubmitted;

                            if (!isSubmitted) {
                                if (isBefore(dueDate, today)) {
                                    late++;
                                } else if (diff <= 3) {
                                    soon++;
                                }
                            }

                            if (!earliestDueDate || isBefore(dueDate, parseISO(earliestDueDate))) {
                                earliestDueDate = a.dueDate;
                            }

                            assignmentsList.push({
                                title: a.title,
                                dueDate: a.dueDate,
                                isSubmitted,
                                isOverdue
                            });
                        });

                        let studentCount = 0;
                        Object.entries(allRegistrations).forEach(([studentUid, studentRegs]: [string, any]) => {
                            const semReg = studentRegs[semesterId];
                            if (semReg && (semReg.status === 'Completed' || semReg.status === 'Pending Payment')) {
                                const coursesList = Array.isArray(semReg.courses) ? semReg.courses : Object.keys(semReg.courses || {});
                                if (coursesList.includes(courseId)) {
                                    studentCount++;
                                }
                            }
                        });

                        activeCourses.push({
                            id: courseId,
                            name: courseInfo.name,
                            code: courseInfo.code,
                            lecturerName: lecturerNames,
                            semesterId: semesterId,
                            semesterName: semesterInfo.name,
                            assignmentStatus: { soon, late, earliestDueDate },
                            hasResultsPublished: !!allResultsPublished[semesterId]?.[courseId],
                            studentCount,
                            assignments: assignmentsList
                        });
                    }
                }
            }

            setCourses(activeCourses.sort((a,b) => a.code.localeCompare(b.code)));

        } catch (error) {
            console.error("Error fetching enrolled courses:", error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch your enrolled courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, toast]);


    React.useEffect(() => {
        if (currentUser) {
            fetchEnrolledCourses();
        }
    }, [currentUser, fetchEnrolledCourses]);
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl">My Current Classes</CardTitle>
                            <CardDescription>Courses for <strong>{semesterName || 'Current Semester'}</strong></CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-muted-foreground border-primary/20 bg-primary/5">Intake: {intakeName}</Badge>
                            {academicStanding && (
                                <Badge variant="secondary" className="w-fit gap-2 h-10 px-4 text-sm font-bold border-primary/20 bg-primary/5">
                                    <CalendarDays className="h-4 w-4" />
                                    Standing: {academicStanding}
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
                </div>
            ) : courses.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course, idx) => (
                        <Card key={`${course.id}-${idx}`} className="flex flex-col justify-between shadow-md transition-all duration-300 hover:shadow-xl border-t-2 border-t-primary/10">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <CardTitle className="font-headline text-lg leading-tight">{course.name}</CardTitle>
                                        <CardDescription className="font-bold font-mono text-primary/80">{course.code}</CardDescription>
                                    </div>
                                    {course.hasResultsPublished && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                            <CheckCircle2 className="h-3 w-3 mr-1" /> Results Out
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start text-xs text-muted-foreground">
                                    <UserCheck className="mr-2 h-4 w-4 mt-0.5 shrink-0 text-primary" />
                                    <span className="line-clamp-2">Lecturer(s): <strong>{course.lecturerName}</strong></span>
                                </div>

                                <div className="flex items-center text-xs text-muted-foreground">
                                    <Users className="mr-2 h-4 w-4 shrink-0 text-primary" />
                                    <span>Enrolled: <strong>{course.studentCount} students</strong></span>
                                </div>

                                {(course.assignmentStatus?.late || 0) > 0 && (
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>{course.assignmentStatus?.late} OVERDUE ASSIGNMENTS</span>
                                    </div>
                                )}

                                {(course.assignmentStatus?.soon || 0) > 0 && (
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold">
                                        <Clock className="h-4 w-4" />
                                        <span>{course.assignmentStatus?.soon} PENDING ASSIGNMENTS</span>
                                    </div>
                                )}

                                <div className="space-y-1.5 pt-2 border-t border-dashed">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Assignments & Deadlines</span>
                                    {course.assignments && course.assignments.length > 0 ? (
                                        <div className="space-y-1">
                                            {course.assignments.map((ass, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs p-1 rounded hover:bg-muted/30">
                                                    <span className="truncate max-w-[150px] font-medium" title={ass.title}>{ass.title}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn("text-[10px] font-mono", ass.isOverdue ? "text-red-500 font-bold" : ass.isSubmitted ? "text-green-600" : "text-muted-foreground")}>
                                                            {format(parseISO(ass.dueDate), 'MMM dd')}
                                                        </span>
                                                        {ass.isSubmitted ? (
                                                            <Badge className="h-3.5 text-[8px] px-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-200 uppercase font-black">Done</Badge>
                                                        ) : ass.isOverdue ? (
                                                            <Badge variant="destructive" className="h-3.5 text-[8px] px-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200 uppercase font-black">Late</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="h-3.5 text-[8px] px-1 uppercase font-black">Pending</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] text-muted-foreground italic pl-1">No assignments assigned.</p>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button asChild className="w-full">
                                    <Link href={`/student/courses/${course.id}/assignments?semesterId=${course.semesterId}`}>
                                        Enter Classroom <ChevronRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="border-dashed border-2 bg-muted/10">
                    <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
                        <BookCopy className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
                        <AlertTitle className="font-bold text-lg">No Active Classes</AlertTitle>
                        <AlertDescription className="max-w-xs mx-auto">
                            We couldn't find any courses for your current Year/Semester standing ({academicStanding}) in the {intakeName} intake. Please ensure your registration is complete.
                        </AlertDescription>
                        <Button variant="outline" asChild className="mt-6">
                            <Link href="/student/registration">Go to Registration</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
