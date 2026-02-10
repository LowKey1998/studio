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
    scheduleKey: string; // Used for merging: courseId + day + time + venue
};

type MergedCourse = {
    key: string; 
    courseId: string;
    name: string;
    code: string;
    totalStudentCount: number;
    day: string;
    startTime: string;
    endTime: string;
    venue: string;
    instances: CourseInstance[];
    isMerged: boolean;
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
            const allUsers = usersSnap.val() || {};

            // 1. Calculate student counts per course per semester
            const studentCounts: Record<string, Record<string, number>> = {};
            for (const userId in allRegistrations) {
                for (const semesterId in allRegistrations[userId]) {
                    const reg = allRegistrations[userId][semesterId];
                    if (reg.status === 'Completed' || reg.status === 'Pending Payment') {
                        if (reg.courses) {
                            if (!studentCounts[semesterId]) studentCounts[semesterId] = {};
                            reg.courses.forEach((courseId: string) => {
                                studentCounts[semesterId][courseId] = (studentCounts[semesterId][courseId] || 0) + 1;
                            });
                        }
                    }
                }
            }

            // 2. Identify active courses assigned to this lecturer that are on the timetable
            const instances: CourseInstance[] = [];
            for (const semId in allTimetables) {
                const semInfo = allSemesters[semId] || { name: semId === 'master' ? 'Master Schedule' : 'Manual Entry', status: 'Active' };
                if (semInfo.status === 'Archived') continue;

                for (const courseId in allTimetables[semId]) {
                    const courseData = allCoursesData[courseId];
                    if (!courseData) continue;

                    // Check if lecturer is assigned
                    const lecturerIds = courseData.lecturerIds || [];
                    const isAssigned = (Array.isArray(lecturerIds) && lecturerIds.includes(currentUser.uid)) || (courseData.lecturerId === currentUser.uid);
                    
                    if (isAssigned) {
                        const entries = Object.values(allTimetables[semId][courseId]) as any[];
                        entries.forEach(entry => {
                            const scheduleKey = `${courseId}-${entry.day}-${entry.startTime}-${entry.venue}`;
                            instances.push({
                                id: courseId,
                                name: courseData.name,
                                code: courseData.code,
                                studentCount: studentCounts[semId]?.[courseId] || 0,
                                semester: semInfo.name,
                                semesterId: semId,
                                day: entry.day,
                                startTime: entry.startTime,
                                endTime: entry.endTime,
                                venue: entry.venue,
                                scheduleKey
                            });
                        });
                    }
                }
            }

            // 3. Process Merging
            let displayList: MergedCourse[] = [];
            if (showMerged) {
                const mergedMap = new Map<string, MergedCourse>();
                instances.forEach(instance => {
                    if (mergedMap.has(instance.scheduleKey)) {
                        const existing = mergedMap.get(instance.scheduleKey)!;
                        existing.instances.push(instance);
                        existing.totalStudentCount += instance.studentCount;
                        existing.isMerged = true;
                    } else {
                        mergedMap.set(instance.scheduleKey, {
                            key: instance.scheduleKey,
                            courseId: instance.id,
                            name: instance.name,
                            code: instance.code,
                            totalStudentCount: instance.studentCount,
                            day: instance.day,
                            startTime: instance.startTime,
                            endTime: instance.endTime,
                            venue: instance.venue,
                            instances: [instance],
                            isMerged: false
                        });
                    }
                });
                displayList = Array.from(mergedMap.values());
            } else {
                displayList = instances.map(instance => ({
                    key: `${instance.semesterId}-${instance.scheduleKey}`,
                    courseId: instance.id,
                    name: instance.name,
                    code: instance.code,
                    totalStudentCount: instance.studentCount,
                    day: instance.day,
                    startTime: instance.startTime,
                    endTime: instance.endTime,
                    venue: instance.venue,
                    instances: [instance],
                    isMerged: false
                }));
            }

            setCourses(displayList.sort((a,b) => a.name.localeCompare(b.name) || a.startTime.localeCompare(b.startTime)));
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
            <Card className="shadow-lg border-0">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">My Classes</CardTitle>
                        <CardDescription>
                            Courses from the active timetable where you are assigned as a lecturer.
                        </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-lg border">
                        <Switch id="merged-mode" checked={showMerged} onCheckedChange={setShowMerged} />
                        <Label htmlFor="merged-mode" className="text-sm font-medium cursor-pointer">Merge Simultaneous Classes</Label>
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
                                {course.isMerged && <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap"><Layers className="h-3 w-3 mr-1"/> Merged</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-primary" />
                                    <span className="font-semibold">{course.day}, {course.startTime} - {course.endTime}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span>{course.venue}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Group(s) / Semester(s)</Label>
                                <div className="flex flex-wrap gap-1">
                                    {course.instances.map((inst, idx) => (
                                        <Badge key={idx} variant="outline" className="text-[10px] bg-background">{inst.semester}</Badge>
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
                                <Link href={`/staff/courses/${course.courseId}/assignments`}>
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
