
'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, BookMarked, Folder, Route, MessageSquare, Users, ClipboardCheck, Hand } from 'lucide-react';

type Course = {
    name: string;
    code: string;
};

export default function StudentCourseLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const courseId = params.courseId as string;
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
        { name: 'Course Path', href: `/student/courses/${courseId}`, icon: <Route/>, exact: true },
        { name: 'Assignments', href: `/student/courses/${courseId}/assignments`, icon: <BookMarked/> },
        { name: 'Resources', href: `/student/courses/${courseId}/resources`, icon: <Folder/> },
        { name: 'Attendance', href: `/student/courses/${courseId}/attendance`, icon: <Hand /> },
        { name: 'Participants', href: `/student/courses/${courseId}/participants`, icon: <Users/> },
        { name: 'Messages', href: `/student/courses/${courseId}/messages`, icon: <MessageSquare/> },
        { name: 'Results', href: `/student/courses/${courseId}/results`, icon: <ClipboardCheck/> },
    ];
    
    const checkActive = (href: string, exact?: boolean) => {
        if (exact) return pathname === href;
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
                <Link href="/student/classes"><ChevronLeft className="mr-2 h-4 w-4" /> Back to All Classes</Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{course?.name || 'Course'}</CardTitle>
                    <CardDescription>{course?.code || ''}</CardDescription>
                </CardHeader>
            </Card>

             <nav className="flex border-b overflow-x-auto">
                 {navItems.map((item) => {
                    const isActive = checkActive(item.href, item.exact);
                    return (
                        <Link key={item.name} href={item.href} passHref>
                            <button className={`flex items-center gap-2 py-4 px-6 text-sm font-medium whitespace-nowrap ${isActive ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                                {React.cloneElement(item.icon, { className: 'h-4 w-4' })}
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
