'use client';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info, ChevronRight, BookCopy, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

type UserProfile = { intakeId: string; programmeId: string; programmeName: string; intakeName: string; };
type Course = { id: string; name: string; code: string; };
type CoursePath = { id: string; intakeId: string; programmeId: string; semesters: Record<string, { courses: string[] }>; };
type Semester = { id: string; name: string; intakeId: string; year: number; semesterInYear: number; status: 'Open' | 'Closed' | 'Archived'; };
type SemesterWithStatus = Semester & { isRegistered: boolean; isOpen: boolean; courses: Course[]; };

export default function StudentRegistrationPage() {
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [semestersForPath, setSemestersForPath] = React.useState<SemesterWithStatus[]>([]);
    const { toast } = useToast();

    React.useEffect(() => {
        onAuthStateChanged(auth, user => setCurrentUser(user));
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const [uSnap, pSnap, iSnap, cpSnap, soSnap, rSnap, cSnap, sSnap] = await Promise.all([
                get(ref(db, `users/${currentUser.uid}`)), get(ref(db, 'programmes')), get(ref(db, 'intakes')),
                get(ref(db, 'coursePaths')), get(ref(db, 'semesterOfferings')), get(ref(db, `registrations/${currentUser.uid}`)),
                get(ref(db, 'courses')), get(ref(db, 'semesters')),
            ]);
            
            if (!uSnap.exists()) return;
            const profile = uSnap.val();
            setUserProfile({ ...profile, programmeName: pSnap.val()[profile.programmeId]?.name || 'Unknown', intakeName: iSnap.val()[profile.intakeId]?.name || 'Unknown' });
            
            const userPath = Object.values(cpSnap.val() || {}).find((p: any) => p.intakeId === profile.intakeId && p.programmeId === profile.programmeId) as any;
            if (!userPath) { setSemestersForPath([]); setLoading(false); return; }
            
            const offerings = soSnap.val() || {};
            const regs = rSnap.val() || {};
            const sData = sSnap.val() || {};
            const cData = cSnap.val() || {};
            const list: SemesterWithStatus[] = [];
            
            if (userPath.semesters) {
                for (const semId in userPath.semesters) {
                    const details = sData[semId];
                    if (!details || details.status === 'Archived') continue;
                    const isOpen = !!offerings[userPath.id]?.[semId]?.active;
                    const isRegistered = !!(regs[semId]?.courses?.length > 0);
                    if (!isOpen && !isRegistered) continue;
                    list.push({ ...details, id: semId, isRegistered, isOpen: isOpen && !isRegistered, courses: (userPath.semesters[semId].courses || []).map((id: string) => ({ id, name: cData[id]?.name, code: cData[id]?.code })) });
                }
            }
            setSemestersForPath(list.sort((a,b) => a.year - b.year || a.semesterInYear - b.semesterInYear));
        } catch (error) { toast({ variant: 'destructive', title: 'Error' }); }
        finally { setLoading(false); }
    }, [currentUser, toast]);

    React.useEffect(() => { if(currentUser) fetchData(); }, [currentUser, fetchData]);
    
    if (loading) return <div className="space-y-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>;
    
    return (
        <div className="space-y-6">
            <Card><CardHeader><CardTitle className="font-headline text-2xl">Registration</CardTitle><CardDescription>{userProfile?.programmeName} - {userProfile?.intakeName}</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle>My Academic Path</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {semestersForPath.length > 0 ? semestersForPath.map(sem => (
                        <Card key={sem.id}><CardHeader className="flex-row items-center justify-between"><div><CardTitle>{sem.name}</CardTitle><CardDescription>Year {sem.year}, Sem {sem.semesterInYear}</CardDescription></div>
                            {sem.isRegistered ? <Button disabled className="bg-green-100 text-green-700"><CheckCircle2 className="mr-2 h-4 w-4"/>Registered</Button> : 
                             sem.isOpen ? <Button asChild><Link href={`/student/registration/${sem.intakeId}/${sem.year}/${sem.semesterInYear}`}>Register Now <ChevronRight className="ml-2 h-4 w-4"/></Link></Button> : 
                             <Button disabled variant="outline">Closed</Button>}
                        </CardHeader></Card>
                    )) : <Alert><Info className="h-4 w-4"/><AlertTitle>No Semesters</AlertTitle><AlertDescription>No active semesters found.</AlertDescription></Alert>}
                </CardContent>
            </Card>
        </div>
    );
}
