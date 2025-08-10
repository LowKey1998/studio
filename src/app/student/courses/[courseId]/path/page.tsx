
'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Route } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type CoursePathItem = { 
    id: string; 
    title: string; 
    description: string; 
    week: number; 
};

export default function StudentCoursePathPage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [coursePath, setCoursePath] = React.useState<CoursePathItem[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchData = React.useCallback(async () => {
        if (!courseId) return;
        setLoading(true);
        try {
            const pathRef = ref(db, `coursePaths/${courseId}`);
            const pathSnapshot = await get(pathRef);
            const pathItems = pathSnapshot.exists() 
                ? Object.entries(pathSnapshot.val()).map(([id, data]) => ({ id, ...(data as any) })) 
                : [];
            setCoursePath(pathItems);
        } catch (error) { 
            console.error("Error fetching course path:", error); 
        } 
        finally { setLoading(false); }
    }, [courseId]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    if(loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Course Path</CardTitle>
                <CardDescription>The weekly breakdown of topics for this course.</CardDescription>
            </CardHeader>
            <CardContent>
               {coursePath.length > 0 ? (
                    <div className="space-y-4">
                        {[...coursePath].sort((a,b) => a.week - b.week).map(p => (
                           <Card key={p.id}>
                               <CardHeader>
                                   <CardTitle>Week {p.week}: {p.title}</CardTitle>
                               </CardHeader>
                               {p.description && <CardContent><p className="whitespace-pre-wrap text-muted-foreground">{p.description}</p></CardContent>}
                           </Card>
                        ))}
                    </div>
                ) : (
                    <Alert>
                        <Route className="h-4 w-4" />
                        <AlertTitle>No Course Path Defined</AlertTitle>
                        <AlertDescription>The syllabus has not been set up for this course yet.</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
