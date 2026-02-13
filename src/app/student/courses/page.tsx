'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Archive, CalendarDays, UserCheck, Clock, BookMarked, AlertCircle, ClipboardCheck } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { calculateAcademicState, parseIntakeDate } from '@/lib/semester-utils';
import { differenceInCalendarDays, parseISO, isBefore } from 'date-fns';

type Course = {
    id: string;
    name: string;
    code: string;
    lecturerName: string;
    semesterId: string;
    semesterName: string;
    year: number;
    semesterInYear: number;
    assignmentStatus?: {
        dueSoon: number;
        pastDue: number;
        earliestDueDate: string | null;
    };
    hasResultsPublished?: boolean;
};

type SemesterGroup = {
    semesterId: string;
    semesterName: string;
    year: number;
    semesterInYear: number;
    courses: Course[];
};

export default function StudentCoursesPage() {
    const [semesterGroups, setSemesterGroups] = React.useState<SemesterGroup[]>([]);
    const [archivedGroups, setArchivedGroups] = React.useState<SemesterGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
    const [intakeName, setIntakeName] = React.useState('');
    const [academicState, setAcademicState] = React.useState<any>(null);
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
            const [registrationsSnap, semestersSnap, coursesSnap, usersSnap, intakesSnap, calendarSnap, assignmentsSnap, resultsSnap] = await Promise.all([
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'semesters')),
                get(ref(db, 'courses')),
                get(ref(db, 'users')),
                get(ref(db, 'intakes')),
                get(ref(db, 'settings/academicCalendar')),
                get(ref(db, 'assignments')),
                get(ref(db, 'resultsPublished'))
            ]);

            const userProfile = usersSnap.val()?.[currentUser.uid];
            if (!userProfile) throw new Error("Profile not found");
            
            const studentIntakeId = userProfile?.intakeId;
            const currentIntakeName = studentIntakeId ? intakesSnap.val()?.[studentIntakeId]?.name : 'Your Intake';
            setIntakeName(currentIntakeName);

            if (calendarSnap.exists() && currentIntakeName) {
                const intakeStartStr = parseIntakeDate(currentIntakeName);
                if (intakeStartStr) {
                    setAcademicState(calculateAcademicState(
                        intakeStartStr, 
                        new Date(), 
                        calendarSnap.val().standardCycles, 
                        Object.values(calendarSnap.val().anomalies || {})
                    ));
                }
            }

            const allSemesters = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const allAssignments = assignmentsSnap.val() || {};
            const allResultsPublished = resultsSnap.val() || {};
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const activeGroups: Record<string, SemesterGroup> = {};
            const archivedGroups: Record<string, SemesterGroup> = {};
            
            const registrationsData = registrationsSnap.val() || {};
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                if (registration.courses && registration.courses.length > 0) {
                    const semesterInfo = allSemesters[semesterId];
                    if (!semesterInfo) continue;

                    if (semesterInfo.intakeId !== studentIntakeId) continue;

                    const isArchived = semesterInfo.status === 'Archived';
                    const targetGroups = isArchived ? archivedGroups : activeGroups;

                    if (!targetGroups[semesterId]) {
                        targetGroups[semesterId] = {
                            semesterId,
                            semesterName: semesterInfo.name,
                            year: semesterInfo.year,
                            semesterInYear: semesterInfo.semesterInYear,
                            courses: []
                        };
                    }
                    
                    for (const courseId of (registration.courses || [])) {
                        const courseInfo = coursesData[courseId];
                        if (courseInfo) {
                            const lecturerNames = (courseInfo.lecturerIds || [])
                                .map((id: string) => userMap.get(id))
                                .filter(Boolean)
                                .join(', ') || userMap.get(courseInfo.lecturerId) || 'N/A';

                            // Assignment Alert Logic
                            const courseAssignments = allAssignments[courseId] || allAssignments[`${courseId}_${semesterId}`] || {};
                            let dueSoon = 0;
                            let pastDue = 0;
                            let earliestDueDate = null;

                            Object.values(courseAssignments).forEach((a: any) => {
                                if (a.submissions?.[currentUser.uid]) return; // Skip if submitted
                                
                                const dueDate = parseISO(a.dueDate);
                                const today = new Date();
                                const diff = differenceInCalendarDays(dueDate, today);

                                if (isBefore(dueDate, today)) {
                                    pastDue++;
                                } else if (diff <= 3) {
                                    dueSoon++;
                                }

                                if (!earliestDueDate || isBefore(dueDate, parseISO(earliestDueDate))) {
                                    earliestDueDate = a.dueDate;
                                }
                            });

                            targetGroups[semesterId].courses.push({
                                id: courseId,
                                name: courseInfo.name,
                                code: courseInfo.code,
                                lecturerName: lecturerNames,
                                semesterId: semesterId,
                                semesterName: semesterInfo.name,
                                year: semesterInfo.year,
                                semesterInYear: semesterInfo.semesterInYear,
                                assignmentStatus: { dueSoon, pastDue, earliestDueDate },
                                hasResultsPublished: !!allResultsPublished[semesterId]?.[courseId]
                            });
                        }
                    }
                }
            }

            setSemesterGroups(Object.values(activeGroups).sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear));
            setArchivedGroups(Object.values(archivedGroups).sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear));

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
                            <CardTitle className="font-headline text-2xl">My Classes</CardTitle>
                            <CardDescription>Academic pathway for Intake: <strong>{intakeName}</strong></CardDescription>
                        </div>
                        {academicState && (
                            <Badge variant="secondary" className="w-fit gap-2 h-10 px-4 text-sm font-bold border-primary/20 bg-primary/5">
                                <CalendarDays className="h-4 w-4" />
                                Current Standing: Year {academicState.year}, Sem {academicState.semester}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {loading ? (
                <div className="space-y-8">
                    {Array.from({ length: 2 }).map((_, index) => (
                       <div key={index} className="space-y-4">
                           <Skeleton className="h-8 w-48" />
                           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                               <Skeleton className="h-48 w-full" />
                               <Skeleton className="h-48 w-full" />
                           </div>
                       </div>
                    ))}
                </div>
            ) : semesterGroups.length > 0 ? (
                 <div className="space-y-10">
                    {semesterGroups.map((group) => (
                    <div key={group.semesterId} className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-2">
                            <h3 className="text-xl font-bold">Year {group.year}, Semester {group.semesterInYear}</h3>
                            {academicState?.year === group.year && academicState?.semester === group.semesterInYear && (
                                <Badge className="bg-primary text-primary-foreground">Active Semester</Badge>
                            )}
                        </div>
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {group.courses.map((course, idx) => (
                                    <Card key={`${course.id}-${idx}`} className="flex flex-col justify-between shadow-md transition-all duration-300 hover:shadow-xl border-t-2 border-t-primary/10">
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <CardTitle className="font-headline text-lg leading-tight">{course.name}</CardTitle>
                                                <CardDescription className="font-bold font-mono text-primary/80">{course.code}</CardDescription>
                                            </div>
                                            {course.hasResultsPublished && (
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                                                    <ClipboardCheck className="h-3 w-3 mr-1" /> Results Out
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-start text-sm text-muted-foreground">
                                            <UserCheck className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{course.lecturerName}</span>
                                        </div>

                                        {(course.assignmentStatus?.pastDue || 0) > 0 && (
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold">
                                                <AlertCircle className="h-4 w-4" />
                                                {course.assignmentStatus?.pastDue} Assignment(s) OVERDUE
                                            </div>
                                        )}

                                        {(course.assignmentStatus?.dueSoon || 0) > 0 && (
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold">
                                                <Clock className="h-4 w-4" />
                                                {course.assignmentStatus?.dueSoon} Pending Assignment(s) Due Soon
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter>
                                    <Button asChild className="w-full">
                                        <Link href={`/student/courses/${course.id}/assignments?semesterId=${group.semesterId}`}>
                                            Enter Classroom <ChevronRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </div>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Classes Found</AlertTitle>
                            <AlertDescription>
                                You are not enrolled in any active classes for the {intakeName} intake. Please complete your registration if you haven't already.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}

            {archivedGroups.length > 0 && (
                <div className="space-y-8 mt-12 pt-8 border-t">
                    <div className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
                        <Archive className="h-5 w-5"/>
                        Completed / Archived Semesters
                    </div>
                    {archivedGroups.map((group) => (
                        <div key={group.semesterId} className="space-y-4">
                            <h3 className="font-bold text-muted-foreground">Year {group.year}, Semester {group.semesterInYear} (Completed)</h3>
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {group.courses.map((course, idx) => (
                                    <Card key={`${course.id}-${idx}`} className="flex flex-col justify-between shadow-sm opacity-70">
                                        <CardHeader>
                                            <CardTitle className="font-headline text-base">{course.name}</CardTitle>
                                            <CardDescription>{course.code}</CardDescription>
                                        </CardHeader>
                                        <CardFooter>
                                        <Button asChild className="w-full" variant="secondary" size="sm">
                                            <Link href={`/student/courses/${course.id}/assignments?semesterId=${group.semesterId}`}>
                                                View Records <ChevronRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
