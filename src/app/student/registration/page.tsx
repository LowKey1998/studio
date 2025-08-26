
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info, ChevronRight, BookCopy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

// Type definitions
type UserProfile = {
    intakeId: string;
    programmeId: string;
    programmeName: string;
    intakeName: string;
};

type Course = {
    id: string;
    name: string;
    code: string;
};

type CoursePath = {
    id: string;
    intakeId: string;
    programmeId: string;
    semesters: Record<string, { courses: string[] }>; // key is semesterId
};

type Semester = {
    id: string;
    name: string;
    intakeId: string;
    year: number;
    semesterInYear: number;
};

type ActiveSemester = {
    semesterId: string;
    semesterName: string;
    intakeId: string;
    year: number;
    semesterInYear: number;
    courses: Course[];
};

export default function StudentRegistrationPage() {
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [openSemesters, setOpenSemesters] = React.useState<ActiveSemester[]>([]);

    const { toast } = useToast();

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (user) {
                setCurrentUser(user);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);

        try {
            const [
                userSnap,
                programmesSnap,
                intakesSnap,
                coursePathsSnap,
                semesterOfferingsSnap,
                registrationsSnap,
                coursesSnap,
                semestersSnap,
            ] = await Promise.all([
                get(ref(db, `users/${currentUser.uid}`)),
                get(ref(db, 'programmes')),
                get(ref(db, 'intakes')),
                get(ref(db, 'coursePaths')),
                get(ref(db, 'semesterOfferings')),
                get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'courses')),
                get(ref(db, 'semesters')),
            ]);
            
            if (!userSnap.exists()) {
                toast({ variant: 'destructive', title: 'User profile not found.' });
                setLoading(false);
                return;
            }

            const profile = userSnap.val();
            const programmes = programmesSnap.val() || {};
            const intakes = intakesSnap.val() || {};
            const allCoursesData = coursesSnap.val() || {};
            const allSemestersData = semestersSnap.val() || {};
            
            profile.programmeName = programmes[profile.programmeId]?.name || 'Unknown Programme';
            profile.intakeName = intakes[profile.intakeId]?.name || 'Unknown Intake';
            setUserProfile(profile);
            
            const coursePathsData = coursePathsSnap.exists() ? coursePathsSnap.val() : {};
            const userPathEntry = Object.entries(coursePathsData as Record<string, CoursePath>).find(
                ([id, p]) => p.intakeId === profile.intakeId && p.programmeId === profile.programmeId
            );
            
            if (!userPathEntry) {
                setOpenSemesters([]);
                setLoading(false);
                return;
            }

            const [userPathId, userPath] = userPathEntry;
            
            const pathOfferings = (semesterOfferingsSnap.val() || {})[userPathId] || {};
            const userRegistrations = registrationsSnap.exists() ? Object.keys(registrationsSnap.val()) : [];
            
            const activeSemestersList: ActiveSemester[] = [];
            
            const semesterIdsInPath = Object.keys(userPath.semesters);
            
            for (const semId of semesterIdsInPath) {
                if (pathOfferings[semId]?.active) {
                    const semesterDetails = allSemestersData[semId];
                    if (!semesterDetails) continue;

                    const isRegistered = userRegistrations.includes(semId);
                    
                    if (!isRegistered) {
                        const semesterCourses = userPath.semesters[semId]?.courses || [];
                        const courseDetails: Course[] = semesterCourses.map((id: string) => ({
                            id,
                            name: allCoursesData[id]?.name || 'Unknown Course',
                            code: allCoursesData[id]?.code || 'N/A'
                        }));

                        activeSemestersList.push({ 
                           semesterId: semId,
                           semesterName: semesterDetails.name,
                           intakeId: profile.intakeId,
                           year: semesterDetails.year, 
                           semesterInYear: semesterDetails.semesterInYear,
                           courses: courseDetails,
                       });
                    }
                }
            }
            
            setOpenSemesters(activeSemestersList.sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear));

        } catch (error) {
            console.error("Failed to load registration data:", error);
            toast({ variant: 'destructive', title: 'Error loading data' });
        } finally {
            setLoading(false);
        }

    }, [currentUser, toast]);

    React.useEffect(() => {
        if(currentUser) {
            fetchData();
        }
    }, [currentUser, fetchData]);
    
    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Course Registration</CardTitle>
                    <CardDescription>
                        Register for the next semester in your academic journey.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {userProfile ? (
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                            <div className="flex flex-col">
                                <span className="font-semibold">Programme:</span>
                                <span className="text-muted-foreground">{userProfile.programmeName}</span>
                            </div>
                             <div className="flex flex-col">
                                <span className="font-semibold">Intake:</span>
                                <span className="text-muted-foreground">{userProfile.intakeName}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Could not load your profile information.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Open Registrations</CardTitle>
                    <CardDescription>Below are the semesters currently open for registration.</CardDescription>
                </CardHeader>
                <CardContent>
                    {openSemesters.length > 0 ? (
                        <div className="space-y-4">
                            {openSemesters.map(semester => (
                                <Card key={semester.semesterId}>
                                    <CardHeader className="flex-row items-center justify-between">
                                        <div className="space-y-1">
                                            <CardTitle>{semester.semesterName}</CardTitle>
                                            <CardDescription>Year {semester.year}, Semester {semester.semesterInYear}</CardDescription>
                                        </div>
                                        <Button asChild>
                                            <Link href={`/student/registration/${semester.intakeId}/${semester.year}/${semester.semesterInYear}`}>
                                                Register for this Semester <ChevronRight className="h-4 w-4 ml-2"/>
                                            </Link>
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <h4 className="text-sm font-semibold mb-2">Courses</h4>
                                        <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                            {semester.courses.map(course => (
                                                <div key={course.id} className="flex items-center gap-2">
                                                    <BookCopy className="h-4 w-4 flex-shrink-0" />
                                                    <span>{course.name} ({course.code})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Open Registrations</AlertTitle>
                            <AlertDescription>
                                There are currently no semesters open for registration for your programme. Please check back later or contact administration for more details.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
