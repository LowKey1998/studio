
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Users } from 'lucide-react';
import { useParams } from 'next/navigation';

type Participant = { 
    uid: string;
    name: string;
    role: 'Lecturer' | 'Student';
    profilePictureUrl?: string;
};

export default function CourseParticipantsPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [participants, setParticipants] = React.useState<Participant[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!courseId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [courseSnap, registrationsSnap, usersSnap] = await Promise.all([
                    get(ref(db, `courses/${courseId}`)),
                    get(ref(db, 'registrations')),
                    get(ref(db, 'users'))
                ]);

                if (!courseSnap.exists() || !registrationsSnap.exists() || !usersSnap.exists()) {
                    setParticipants([]);
                    setLoading(false);
                    return;
                }

                const courseData = courseSnap.val();
                const allRegistrations = registrationsSnap.val();
                const allUsers = usersSnap.val();
                const userList: Participant[] = [];

                // Add lecturer
                if (courseData.lecturerId && allUsers[courseData.lecturerId]) {
                    const lecturerData = allUsers[courseData.lecturerId];
                    userList.push({
                        uid: courseData.lecturerId,
                        name: lecturerData.name,
                        role: 'Lecturer',
                        profilePictureUrl: lecturerData.profilePictureUrl
                    });
                }
                
                // Add students
                for (const userId in allRegistrations) {
                    for (const semester in allRegistrations[userId]) {
                        const reg = allRegistrations[userId][semester];
                        if (reg.courses.includes(courseId) && reg.status === 'Completed') {
                            if (allUsers[userId]) {
                                userList.push({
                                    uid: userId,
                                    name: allUsers[userId].name,
                                    role: 'Student',
                                    profilePictureUrl: allUsers[userId].profilePictureUrl
                                });
                            }
                        }
                    }
                }
                
                // Sort with lecturer first, then alphabetically
                const sortedList = userList.sort((a, b) => {
                    if (a.role === 'Lecturer') return -1;
                    if (b.role === 'Lecturer') return 1;
                    return a.name.localeCompare(b.name);
                });

                setParticipants(sortedList);
            } catch (error) {
                console.error("Error fetching participants:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId]);
    
    if(loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4 p-2">
                             <Skeleton className="h-10 w-10 rounded-full" />
                             <Skeleton className="h-5 w-48" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Participants</CardTitle>
                <CardDescription>The lecturer and all students enrolled in this course.</CardDescription>
            </CardHeader>
            <CardContent>
                {participants.length > 0 ? (
                     <div className="space-y-2">
                        {participants.map((p) => (
                            <div key={p.uid} className="flex items-center gap-4 rounded-md border p-2">
                                <Avatar>
                                    <AvatarImage src={p.profilePictureUrl} data-ai-hint="person avatar" />
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.role}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Alert>
                        <Users className="h-4 w-4" />
                        <AlertTitle>No Participants Found</AlertTitle>
                        <AlertDescription>
                            There are currently no students enrolled in this course.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
