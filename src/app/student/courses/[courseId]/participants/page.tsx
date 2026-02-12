
'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Users, Mail, Hash } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

type Participant = { 
    uid: string;
    id: string;
    name: string;
    role: 'Lecturer' | 'Student';
    profilePictureUrl?: string;
};

export default function CourseParticipantsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const courseId = params.courseId as string;
    const semesterIdFilter = searchParams.get('semesterId');
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

                const addUserToList = (uid: string, role: 'Lecturer' | 'Student') => {
                    const userData = allUsers[uid];
                    if (userData && !userList.find(u => u.uid === uid)) {
                        userList.push({
                            uid,
                            id: userData.id || 'N/A',
                            name: userData.name || 'Unknown',
                            role: role,
                            profilePictureUrl: userData.profilePictureUrl
                        });
                    }
                };

                // 1. Add Lecturers
                if (courseData.lecturerId) addUserToList(courseData.lecturerId, 'Lecturer');
                
                const coLecturerIds = courseData.lecturerIds ? (Array.isArray(courseData.lecturerIds) ? courseData.lecturerIds : Object.values(courseData.lecturerIds)) : [];
                (coLecturerIds as string[]).forEach(id => addUserToList(id, 'Lecturer'));
                
                // 2. Add Students
                for (const userId in allRegistrations) {
                    const userRegs = allRegistrations[userId];
                    const semesterIdsToCheck = semesterIdFilter ? [semesterIdFilter] : Object.keys(userRegs);

                    for (const semId of semesterIdsToCheck) {
                        const reg = userRegs[semId];
                        if (!reg) continue;

                        const enrolledCourses = reg.courses ? (Array.isArray(reg.courses) ? reg.courses : Object.values(reg.courses)) : [];
                        
                        if (enrolledCourses.includes(courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                            addUserToList(userId, 'Student');
                            break;
                        }
                    }
                }
                
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
    }, [courseId, semesterIdFilter]);
    
    if(loading) {
        return (
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
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
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Class Participants</CardTitle>
                    <CardDescription>Your lecturer and fellow classmates enrolled in this session.</CardDescription>
                </div>
                <Badge variant="secondary" className="text-base px-3 py-1">
                    <Users className="mr-2 h-4 w-4" />
                    {participants.length} Total
                </Badge>
            </CardHeader>
            <CardContent>
                {participants.length > 0 ? (
                     <div className="space-y-2">
                        {participants.map((p) => (
                            <div key={p.uid} className="flex items-center gap-4 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                                <Avatar>
                                    <AvatarImage src={p.profilePictureUrl} data-ai-hint="person avatar" />
                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm">{p.name}</p>
                                        <Badge variant={p.role === 'Lecturer' ? 'default' : 'outline'} className="text-[10px] h-4">{p.role}</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{p.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Alert>
                        <Users className="h-4 w-4" />
                        <AlertTitle>No Participants Found</AlertTitle>
                        <AlertDescription>There are currently no students enrolled in this course session.</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
