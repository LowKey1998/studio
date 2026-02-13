
'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, BookMarked, Folder, Route, MessageSquare, ClipboardEdit, Hand, Users, ShieldAlert, MonitorPlay } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

type Course = {
    name: string;
    code: string;
    lecturerId?: string;
    lecturerIds?: string[];
};

export default function StaffCourseLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const courseId = params.courseId as string;
    const pathname = usePathname();
    const [course, setCourse] = React.useState<Course | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { user, userProfile } = useAuth();

    React.useEffect(() => {
        if (!courseId) return;
        const fetchCourse = async () => {
            setLoading(true);
            const courseRef = ref(db, `courses/${courseId}`);
            const snapshot = await get(courseRef);
            if (snapshot.exists()) {
                setCourse(snapshot.val());
            }
            setLoading(false);
        };
        fetchCourse();
    }, [courseId]);

    const isAuthorized = React.useMemo(() => {
        if (!user || !course) return false;
        if (userProfile?.role === 'Admin') return true;
        
        const lecturerIds = course.lecturerIds || [];
        return user.uid && (
            (Array.isArray(lecturerIds) && lecturerIds.includes(user.uid)) ||
            (course.lecturerId && course.lecturerId === user.uid)
        );
    }, [user, userProfile, course]);

    const navItems = [
        { name: 'Assignments', href: `/staff/courses/${courseId}/assignments`, icon: <BookMarked/> },
        { name: 'Resources', href: `/staff/courses/${courseId}/resources`, icon: <Folder/> },
        { name: 'Lesson Plans', href: `/staff/courses/${courseId}/lesson-plans`, icon: <Route/> },
        { name: 'Attendance', href: `/staff/courses/${courseId}/attendance`, icon: <Hand /> },
        { name: 'Assessment', href: `/staff/courses/${courseId}/assessment`, icon: <ClipboardEdit/> },
        { name: 'Participants', href: `/staff/courses/${courseId}/participants`, icon: <Users/> },
        { name: 'Messages', href: `/staff/courses/${courseId}/messages`, icon: <MessageSquare/> },
        { name: 'Live Session', href: `/staff/courses/${courseId}/live`, icon: <MonitorPlay/> },
    ];
    
    const checkActive = (href: string) => {
        if(href.endsWith('/assignments')) {
            return pathname === href || pathname === `/staff/courses/${courseId}`;
        }
        return pathname.startsWith(href);
    }

    if (loading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    if (!isAuthorized) {
        return (
            <div className="space-y-6">
                <Button variant="outline" asChild>
                    <Link href="/staff/courses"><ChevronLeft className="mr-2 h-4 w-4" /> Back to My Courses</Link>
                </Button>
                <Card>
                    <CardContent className="pt-6">
                        <Alert variant="destructive">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Access Denied</AlertTitle>
                            <AlertDescription>You are not assigned as a lecturer for this course.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <Button variant="outline" asChild>
                <Link href="/staff/courses"><ChevronLeft className="mr-2 h-4 w-4" /> Back to My Courses</Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{course?.name || 'Course'}</CardTitle>
                    <CardDescription>{course?.code || ''}</CardDescription>
                </CardHeader>
            </Card>

             <nav className="flex border-b overflow-x-auto">
                {navItems.map((item) => {
                    const isActive = checkActive(item.href);
                    return (
                        <Link key={item.name} href={item.href} passHref>
                            <button className={`flex items-center gap-2 py-4 px-6 text-sm font-medium whitespace-nowrap ${isActive ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                {React.cloneElement(item.icon as React.ReactElement, { className: 'h-4 w-4' })}
                                {item.name}
                            </button>
                        </Link>
                    )
                })}
            </nav>

            <div className="mt-6">{children}</div>
        </div>
    );
}
