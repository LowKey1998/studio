
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Archive, CalendarDays, UserCheck, Clock, AlertCircle, ClipboardCheck, GraduationCap, BookCopy } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
    isCurrent: boolean;
    isUpcoming: boolean;
    isArchived: boolean;
};

type YearGroup = {
    year: number;
    semesters: SemesterGroup[];
    isCurrentYear: boolean;
};

export default function StudentCoursesPage() {
    const [yearGroups, setYearGroups] = React.useState<YearGroup[]>([]);
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
                    setAcademicState(calculatedState);
                }
            }

            const allSemesters = semestersSnap.val() || {};
            const coursesData = coursesSnap.val() || {};
            const usersData = usersSnap.val() || {};
            const allAssignments = assignmentsSnap.val() || {};
            const allResultsPublished = resultsSnap.val() || {};
            const userMap = new Map<string, string>();
            Object.keys(usersData).forEach(uid => userMap.set(uid, usersData[uid].name));

            const tempYearMap: Record<number, Record<string, SemesterGroup>> = {};
            const registrationsData = registrationsSnap.val() || {};
            
            for (const semesterId in registrationsData) {
                const registration = registrationsData[semesterId];
                const semesterInfo = allSemesters[semesterId];
                if (!semesterInfo) continue;

                const year = semesterInfo.year;
                if (!tempYearMap[year]) tempYearMap[year] = {};

                if (!tempYearMap[year][semesterId]) {
                    const isCurrent = calculatedState?.year === year && calculatedState?.semester === semesterInfo.semesterInYear;
                    const isArchived = (year < (calculatedState?.year || 0)) || (year === calculatedState?.year && semesterInfo.semesterInYear < (calculatedState?.semester || 0));
                    const isUpcoming = (year > (calculatedState?.year || 0)) || (year === calculatedState?.year && semesterInfo.semesterInYear > (calculatedState?.semester || 0));

                    tempYearMap[year][semesterId] = {
                        semesterId,
                        semesterName: semesterInfo.name,
                        year: semesterInfo.year,
                        semesterInYear: semesterInfo.semesterInYear,
                        courses: [],
                        isCurrent,
                        isArchived,
                        isUpcoming
                    };
                }

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

                        Object.values(courseAssignments).forEach((a: any) => {
                            if (a.submissions?.[currentUser.uid]) return; 
                            
                            const dueDate = parseISO(a.dueDate);
                            const today = startOfDay(new Date());
                            const diff = differenceInCalendarDays(dueDate, today);

                            if (isBefore(dueDate, today)) {
                                late++;
                            } else if (diff <= 3) {
                                soon++;
                            }

                            if (!earliestDueDate || isBefore(dueDate, parseISO(earliestDueDate))) {
                                earliestDueDate = a.dueDate;
                            }
                        });

                        tempYearMap[year][semesterId].courses.push({
                            id: courseId,
                            name: courseInfo.name,
                            code: courseInfo.code,
                            lecturerName: lecturerNames,
                            semesterId: semesterId,
                            semesterName: semesterInfo.name,
                            year: semesterInfo.year,
                            semesterInYear: semesterInfo.semesterInYear,
                            assignmentStatus: { soon, late, earliestDueDate },
                            hasResultsPublished: !!allResultsPublished[semesterId]?.[courseId]
                        });
                    }
                }
            }

            const formattedYearGroups: YearGroup[] = Object.entries(tempYearMap).map(([yearStr, semestersMap]) => {
                const yearNum = Number(yearStr);
                const semesters = Object.values(semestersMap).sort((a,b) => a.semesterInYear - b.semesterInYear);
                return {
                    year: yearNum,
                    semesters,
                    isCurrentYear: calculatedState?.year === yearNum
                };
            }).sort((a,b) => b.year - a.year);

            setYearGroups(formattedYearGroups);

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
            ) : yearGroups.length > 0 ? (
                 <Accordion type="multiple" defaultValue={yearGroups.filter(y => y.isCurrentYear).map(y => `year-${y.year}`)} className="w-full space-y-6">
                    {yearGroups.map((yearGroup) => (
                        <AccordionItem value={`year-${yearGroup.year}`} key={yearGroup.year} className="border-none">
                            <AccordionTrigger className="hover:no-underline bg-muted/30 px-4 py-3 rounded-lg border">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-black uppercase tracking-tight">Academic Year {yearGroup.year}</h3>
                                    {yearGroup.isCurrentYear && <Badge className="bg-primary text-primary-foreground text-[10px] h-5">Active Year</Badge>}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-6 space-y-8">
                                {yearGroup.semesters.map((semGroup) => (
                                    <div key={semGroup.semesterId} className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-lg font-bold">Semester {semGroup.semesterInYear}</h4>
                                                <span className="text-xs text-muted-foreground italic">({semGroup.semesterName})</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {semGroup.isCurrent && <Badge variant="default" className="bg-blue-600 text-white border-blue-700 h-5 text-[9px] uppercase font-black tracking-widest">Current Standing</Badge>}
                                                {semGroup.isArchived && <Badge variant="secondary" className="h-5 text-[9px] uppercase font-black opacity-60">Completed</Badge>}
                                                {semGroup.isUpcoming && <Badge variant="outline" className="h-5 text-[9px] uppercase font-black opacity-60">Upcoming</Badge>}
                                            </div>
                                        </div>
                                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                            {semGroup.courses.map((course, idx) => (
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

                                                        {(course.assignmentStatus?.late || 0) > 0 && (
                                                            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold">
                                                                <AlertCircle className="h-4 w-4" />
                                                                <span>{course.assignmentStatus?.late} OVERDUE (due {course.assignmentStatus?.earliestDueDate ? format(parseISO(course.assignmentStatus.earliestDueDate), 'MMM dd') : 'N/A'})</span>
                                                            </div>
                                                        )}

                                                        {(course.assignmentStatus?.soon || 0) > 0 && (
                                                            <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold">
                                                                <Clock className="h-4 w-4" />
                                                                <span>{course.assignmentStatus?.soon} PENDING (due {course.assignmentStatus?.earliestDueDate ? format(parseISO(course.assignmentStatus.earliestDueDate), 'MMM dd') : 'N/A'})</span>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                    <CardFooter>
                                                        <Button asChild className="w-full">
                                                            <Link href={`/student/courses/${course.id}/assignments?semesterId=${semGroup.semesterId}`}>
                                                                Enter Classroom <ChevronRight className="ml-2 h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    </CardFooter>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                 </Accordion>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Current Registration Incomplete</AlertTitle>
                            <AlertDescription>
                                You are not enrolled in any classes for your current standing. Please complete your registration if you haven't already.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
