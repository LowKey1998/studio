'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useParams, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, BookMarked, Folder, Route, MessageSquare, Users, ClipboardCheck, Hand, Calendar, Video } from 'lucide-react';

type Course = {
    name: string;
    code: string;
};

export default function StudentCourseLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const searchParams = useSearchParams();
    const courseId = params.courseId as string;
    const semesterId = searchParams.get('semesterId');
    const pathname = usePathname();
    const [course, setCourse] = React.useState<Course | null>(null);
    const [loading, setLoading] = React.useState(true);

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

    const navItems = [
        { name: 'Assignments', href: `/student/courses/${courseId}/assignments`, icon: <BookMarked/> },
        { name: 'Resources', href: `/student/courses/${courseId}/resources`, icon: <Folder/> },
        { name: 'Schedule', href: `/student/courses/${courseId}/schedule`, icon: <Calendar /> },
        { name: 'Attendance', href: `/student/courses/${courseId}/attendance`, icon: <Hand /> },
        { name: 'Participants', href: `/student/courses/${courseId}/participants`, icon: <Users/> },
        { name: 'Messages', href: `/student/courses/${courseId}/messages`, icon: <MessageSquare/> },
        { name: 'Results', href: `/student/courses/${courseId}/results`, icon: <ClipboardCheck/> },
        { name: 'Live Session', href: `/student/courses/${courseId}/live`, icon: <Video/> },
    ];
    
    const getLinkHref = (baseHref: string) => {
        return semesterId ? `${baseHref}?semesterId=${semesterId}` : baseHref;
    };

    const checkActive = (href: string) => {
        if(href.endsWith('/assignments')) {
            return pathname === href || pathname === `/student/courses/${courseId}`;
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

    return (
        <div className="space-y-6">
             <Button variant="outline" asChild>
                <Link href="/student/courses"><ChevronLeft className="mr-2 h-4 w-4" /> Back to All Classes</Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{course?.name || 'Course'}</CardTitle>
                    <CardDescription>{course?.code || ''}</CardDescription>
                </CardHeader>
            </Card>

             <nav className="flex border-b overflow-x-auto scrollbar-hide">
                 {navItems.map((item) => {
                    const isActive = checkActive(item.href);
                    return (
                        <Link key={item.name} href={getLinkHref(item.href)} passHref>
                            <button className={`flex items-center gap-2 py-4 px-6 text-sm font-medium whitespace-nowrap transition-all ${isActive ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
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
