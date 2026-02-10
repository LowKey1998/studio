'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, Info, Users, Layers, Layers2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type CourseInstance = {
    id: string;
    name: string;
    code: string;
    studentCount: number;
    semester: string;
    semesterId: string;
    scheduleKey: string; // Used for merging: time + venue
};

type MergedCourse = {
    id: string;
    name: string;
    code: string;
    totalStudentCount: number;
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
            const [coursesSnap, semestersSnap, regsSnap, timetablesSnap] = await Promise.all([
                get(ref(db, 'courses')),
                get(ref(db, 'semesters')),
                get(ref(db, 'registrations')),
                get(ref(db, 'timetables'))
            ]);

            const allCoursesData = coursesSnap.val() || {};
            const allSemesters = semestersSnap.val() || {};
            const allRegistrations = regsSnap.val() || {};
            const allTimetables = timetablesSnap.val() || {};

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
                const semInfo = allSemesters[semId];
                if (!semInfo || semInfo.status === 'Archived') continue;

                for (const courseId in allTimetables[semId]) {
                    const courseData = allCoursesData[courseId];
                    if (!courseData) continue;

                    // Check if lecturer is assigned
                    const lecturerIds = courseData.lecturerIds || [];
                    const isAssigned = (Array.isArray(lecturerIds) && lecturerIds.includes(currentUser.uid)) || (courseData.lecturerId === currentUser.uid);
                    
                    if (isAssigned) {
                        // Get timetable entries to build schedule keys for merging
                        const entries = Object.values(allTimetables[semId][courseId]) as any[];
                        if (entries.length === 0) continue;

                        // Use the first entry's time/venue as a merge key (simplified)
                        const primaryEntry = entries[0];
                        const scheduleKey = `${primaryEntry.day}-${primaryEntry.startTime}-${primaryEntry.venue}`;

                        instances.push({
                            id: courseId,
                            name: courseData.name,
                            code: courseData.code,
                            studentCount: studentCounts[semId]?.[courseId] || 0,
                            semester: semInfo.name,
                            semesterId: semId,
                            scheduleKey
                        });
                    }
                }
            }

            // 3. Process Merging
            let displayList: MergedCourse[] = [];
            if (showMerged) {
                const mergedMap = new Map<string, MergedCourse>();
                instances.forEach(instance => {
                    const key = `${instance.id}-${instance.scheduleKey}`;
                    if (mergedMap.has(key)) {
                        const existing = mergedMap.get(key)!;
                        existing.instances.push(instance);
                        existing.totalStudentCount += instance.studentCount;
                        existing.isMerged = true;
                    } else {
                        mergedMap.set(key, {
                            id: instance.id,
                            name: instance.name,
                            code: instance.code,
                            totalStudentCount: instance.studentCount,
                            instances: [instance],
                            isMerged: false
                        });
                    }
                });
                displayList = Array.from(mergedMap.values());
            } else {
                displayList = instances.map(instance => ({
                    id: instance.id,
                    name: instance.name,
                    code: instance.code,
                    totalStudentCount: instance.studentCount,
                    instances: [instance],
                    isMerged: false
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
    
    if (loading) return <div className="space-y-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-0">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="font-headline text-2xl">My Courses</CardTitle>
                        <CardDescription>Only courses currently scheduled on your timetable are displayed.</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="merged-mode" checked={showMerged} onCheckedChange={setShowMerged} />
                        <Label htmlFor="merged-mode" className="text-sm font-medium">Merge Simultaneous Groups</Label>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course, idx) => (
                    <Card key={`${course.id}-${idx}`} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-all">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{course.name}</CardTitle>
                                    <CardDescription>{course.code}</CardDescription>
                                </div>
                                {course.isMerged && <Badge variant="secondary" className="bg-primary/10 text-primary"><Layers className="h-3 w-3 mr-1"/> Merged</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Group(s) / Semester(s)</Label>
                                <div className="flex flex-wrap gap-1">
                                    {course.instances.map(inst => (
                                        <Badge key={inst.semesterId} variant="outline" className="text-[10px]">{inst.semester}</Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center text-sm font-medium">
                                <Users className="mr-2 h-4 w-4 text-primary" />
                                {course.totalStudentCount} Total Enrolled Students
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full">
                                <Link href={`/staff/courses/${course.id}`}>
                                    Manage Course <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {courses.length === 0 && !loading && (
                <Alert>
                    <Info className="h-4 w-4"/>
                    <AlertTitle>No Active Teaching Sessions</AlertTitle>
                    <AlertDescription>
                        You are not assigned to any courses with scheduled sessions in the current timetable.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
