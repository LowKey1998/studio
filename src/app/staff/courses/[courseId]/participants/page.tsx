'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Users, Mail, Phone, Hash } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

type Participant = { 
    uid: string;
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
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

                // Helper to add a user to the list
                const addUserToList = (uid: string, role: 'Lecturer' | 'Student') => {
                    const userData = allUsers[uid];
                    if (userData && !userList.find(u => u.uid === uid)) {
                        userList.push({
                            uid,
                            id: userData.id || 'N/A',
                            name: userData.name || 'Unknown',
                            email: userData.email || 'N/A',
                            phoneNumber: userData.phoneNumber,
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
                    for (const semesterId in userRegs) {
                        const reg = userRegs[semesterId];
                        const enrolledCourses = reg.courses ? (Array.isArray(reg.courses) ? reg.courses : Object.values(reg.courses)) : [];
                        
                        if (enrolledCourses.includes(courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                            addUserToList(userId, 'Student');
                            break; // Move to next user once enrollment is found
                        }
                    }
                }
                
                const sortedList = userList.sort((a, b) => {
                    if (a.role === 'Lecturer' && b.role !== 'Lecturer') return -1;
                    if (a.role !== 'Lecturer' && b.role === 'Lecturer') return 1;
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
                    <CardTitle>Participants List</CardTitle>
                    <CardDescription>A comprehensive list of faculty and students enrolled in this session.</CardDescription>
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
                            <div key={p.uid} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarImage src={p.profilePictureUrl} data-ai-hint="person avatar" />
                                        <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold">{p.name}</p>
                                            <Badge variant={p.role === 'Lecturer' ? 'default' : 'outline'}>{p.role}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <Hash className="h-3 w-3" /> {p.id}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Mail className="h-4 w-4" /> {p.email}
                                    </div>
                                    {p.phoneNumber && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Phone className="h-4 w-4" /> {p.phoneNumber}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Alert>
                        <Users className="h-4 w-4" />
                        <AlertTitle>No Participants Found</AlertTitle>
                        <AlertDescription>This course does not currently have any participants listed.</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}