'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
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

                // 1. Add Lecturers
                const addLecturer = (lid: string) => {
                    if (allUsers[lid]) {
                        const lData = allUsers[lid];
                        if (!userList.find(u => u.uid === lid)) {
                            userList.push({
                                uid: lid,
                                id: lData.id,
                                name: lData.name,
                                email: lData.email,
                                phoneNumber: lData.phoneNumber,
                                role: 'Lecturer',
                                profilePictureUrl: lData.profilePictureUrl
                            });
                        }
                    }
                };

                if (courseData.lecturerId) addLecturer(courseData.lecturerId);
                if (courseData.lecturerIds) courseData.lecturerIds.forEach(addLecturer);
                
                // 2. Add Students
                for (const userId in allRegistrations) {
                    for (const semester in allRegistrations[userId]) {
                        const reg = allRegistrations[userId][semester];
                        if (reg.courses?.includes(courseId) && (reg.status === 'Completed' || reg.status === 'Pending Payment')) {
                            if (allUsers[userId]) {
                                const sData = allUsers[userId];
                                if (!userList.find(u => u.uid === userId)) {
                                    userList.push({
                                        uid: userId,
                                        id: sData.id,
                                        name: sData.name,
                                        email: sData.email,
                                        phoneNumber: sData.phoneNumber,
                                        role: 'Student',
                                        profilePictureUrl: sData.profilePictureUrl
                                    });
                                }
                            }
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
                        <div key={index} className="flex items-center gap-4 p-2"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-48" /></div>
                    ))}
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Participants List</CardTitle>
                <CardDescription>A comprehensive list of faculty and students enrolled in this session.</CardDescription>
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