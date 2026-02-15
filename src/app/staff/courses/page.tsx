'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Users, Layers, Clock, MapPin } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type CourseInstance = {
    id: string; // courseId
    name: string;
    code: string;
    studentCount: number;
    semester: string;
    semesterId: string;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    scheduleKey: string;
    separateInstance: boolean;
};

type MergedCourse = {
    key: string; 
    courseId: string;
    semesterId: string; // First matched semester for linking
    name: string;
    code: string;
    totalStudentCount: number;
    semesterNames: string[];
    sessions: { day: string; startTime: string; endTime: string; venue: string }[];
    isMerged: boolean;
    separateInstance: boolean;
};

export default function StaffCoursesPage() {
    const [courses, setCourses] = React.useState<MergedCourse[]>([]);
    const [showMerged, setShowMerged] = React.useState(true);
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<FirebaseUser | null>(null);
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

    const fetchLecturerCourses = React.useCallback(async () => {
        if (!currentUser?.uid) return;
        setLoading(true);
        try {
            const [coursesSnap, semestersSnap, regsSnap, timetablesSnap, usersSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'semesters')),
                get(ref(db, 'registrations')),
                get(ref(db, 'timetables')),
                get(ref(db, 'users'))
            ]);

            const allCoursesData = coursesSnap.val() || {};
            const allSemesters = semestersSnap.val() || {};
            const allRegistrations = regsSnap.val() || {};
            const allTimetables = timetablesSnap.val() || {};

            const studentCounts: Record<string, Record<string, number>> = {};
            for (const userId in allRegistrations) {
                for (const semesterId in allRegistrations[userId]) {
                    const reg = allRegistrations[userId][semesterId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (reg.courses) {
                            if (!studentCounts[semesterId]) studentCounts[semesterId] = {};
                            const coursesArr = Array.isArray(reg.courses) ? reg.courses : Object.keys(reg.courses);
                            coursesArr.forEach((courseId: string) => {
                                studentCounts[semesterId][courseId] = (studentCounts[semesterId][courseId] || 0) + 1;
                            });
                        }
                    }
                }
            }

            const courseSemesterMap = new Map<string, { 
                courseId: string, 
                semId: string, 
                semName: string, 
                sessions: { day: string, startTime: string, endTime: string, venue: string }[],
                studentCount: number,
                separateInstance: boolean
            }>();

            for (const semId in allTimetables) {
                const semInfo = allSemesters[semId] || { name: semId === 'master' ? 'Master Schedule' : 'Manual Entry', status: 'Active' };
                if (semInfo.status === 'Archived') continue;

                for (const courseId in allTimetables[semId]) {
                    const courseData = allCoursesData[courseId];
                    if (!courseData) continue;

                    const lecturerIds = courseData.lecturerIds || [];
                    const isAssigned = (Array.isArray(lecturerIds) && lecturerIds.includes(currentUser.uid)) || (courseData.lecturerId === currentUser.uid);
                    
                    if (isAssigned) {
                        const key = `${semId}-${courseId}`;
                        const entries = Object.values(allTimetables[semId][courseId]) as any[];
                        
                        courseSemesterMap.set(key, {
                            courseId,
                            semId,
                            semName: semInfo.name,
                            sessions: entries.map(e => ({ day: e.day, startTime: e.startTime, endTime: e.endTime, venue: e.venue })),
                            studentCount: studentCounts[semId]?.[courseId] || 0,
                            separateInstance: !!courseData.separateInstance
                        });
                    }
                }
            }

            let displayList: MergedCourse[] = [];

            if (showMerged) {
                const finalMergeMap = new Map<string, MergedCourse>();
                
                courseSemesterMap.forEach((val) => {
                    const sessionSignature = val.sessions
                        .sort((a, b) => a.day.localeCompare(b.day) || a.startTime.localeCompare(b.startTime))
                        .map(s => `${s.day}-${s.startTime}-${s.venue}`)
                        .join('|');
                    
                    const mergeKey = val.separateInstance ? `${val.semId}-${val.courseId}-${sessionSignature}` : `${val.courseId}-${sessionSignature}`;

                    if (finalMergeMap.has(mergeKey)) {
                        const existing = finalMergeMap.get(mergeKey)!;
                        existing.totalStudentCount += val.studentCount;
                        if(!existing.semesterNames.includes(val.semName)) {
                            existing.semesterNames.push(val.semName);
                        }
                        existing.isMerged = true;
                    } else {
                        finalMergeMap.set(mergeKey, {
                            key: mergeKey,
                            courseId: val.courseId,
                            semesterId: val.semId,
                            name: allCoursesData[val.courseId].name,
                            code: allCoursesData[val.courseId].code,
                            totalStudentCount: val.studentCount,
                            semesterNames: [val.semName],
                            sessions: val.sessions,
                            isMerged: false,
                            separateInstance: val.separateInstance
                        });
                    }
                });
                displayList = Array.from(finalMergeMap.values());
            } else {
                displayList = Array.from(courseSemesterMap.values()).map(val => ({
                    key: `${val.semId}-${val.courseId}`,
                    courseId: val.courseId,
                    semesterId: val.semId,
                    name: allCoursesData[val.courseId].name,
                    code: allCoursesData[val.courseId].code,
                    totalStudentCount: val.studentCount,
                    semesterNames: [val.semName],
                    sessions: val.sessions,
                    isMerged: false,
                    separateInstance: val.separateInstance
                }));
            }

            setCourses(displayList.sort((a,b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: "Could not fetch courses." });
        } finally {
            setLoading(false);
        }
    }, [currentUser, showMerged, toast]);

    React.useEffect(() => {
        if (currentUser) fetchLecturerCourses();
    }, [currentUser, fetchLecturerCourses]);
    
    if (loading) return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-64" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-primary/5">
                <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="font-headline text-2xl">My Classes</CardTitle>
                            <CardDescription>
                                Your assigned courses and student groupings. Multiple weekly sessions are grouped per card.
                            </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg border">
                            <Switch id="merged-mode" checked={showMerged} onCheckedChange={setShowMerged} />
                            <Label htmlFor="merged-mode" className="text-sm font-medium cursor-pointer">Group Sessions</Label>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                    <Card key={course.key} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-all border-t-4 border-t-primary">
                        <CardHeader>
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                    <CardTitle className="text-lg leading-tight">{course.name}</CardTitle>
                                    <CardDescription className="font-mono font-bold mt-1">{course.code}</CardDescription>
                                </div>
                                {course.isMerged && <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap"><Layers className="h-3 w-3 mr-1"/> Combined</Badge>}
                                {course.separateInstance && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Separate</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3 bg-muted/30 p-3 rounded-md border border-dashed">
                                {course.sessions.map((session, sIdx) => (
                                    <div key={sIdx} className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Clock className="h-4 w-4 text-primary" />
                                            <span className="font-semibold">{session.day}, {session.startTime} - {session.endTime}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="h-4 w-4" />
                                            <span>{session.venue}</span>
                                        </div>
                                        {sIdx < course.sessions.length - 1 && <Separator className="my-2 opacity-50" />}
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Group(s) / Semester(s)</Label>
                                <div className="flex flex-wrap gap-1">
                                    {course.semesterNames.map((name, idx) => (
                                        <Badge key={idx} variant="outline" className="text-[10px] bg-background">{name}</Badge>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex items-center text-sm font-medium pt-2 border-t">
                                <Users className="mr-2 h-4 w-4 text-primary" />
                                <span>{course.totalStudentCount} Students Enrolled</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full shadow-md group">
                                <Link href={`/staff/courses/${course.courseId}/assignments?semesterId=${course.semesterId}`}>
                                    Manage Class <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {courses.length === 0 && !loading && (
                <Alert>
                    <Info className="h-4 w-4"/>
                    <AlertTitle>No Active Sessions Found</AlertTitle>
                    <AlertDescription>
                        You don't have any courses currently scheduled on the timetable. Please check with the Registrar if you believe this is an error.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
