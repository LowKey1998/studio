
'use client';
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db, auth } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Route } from 'lucide-react';
import { useParams } from 'next/navigation';

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
    const [currentUser, setCurrentUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
            setCurrentUser(user);
          } else {
            setLoading(false);
          }
        });
        return () => unsubscribeAuth();
      }, []);
    
    React.useEffect(() => {
        if (!currentUser || !courseId) return;
        
        const pathRef = ref(db, `coursePaths/${courseId}`);
        const unsubscribe = onValue(pathRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: CoursePathItem[] = Object.keys(data).map(id => ({ id, ...data[id] }))
                    .sort((a, b) => a.week - b.week);
                setCoursePath(list);
            } else {
                setCoursePath([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [courseId, currentUser]);
    
    if(loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            {coursePath.length > 0 ? (
                 <div className="space-y-4">
                    {coursePath.map((item) => (
                        <Card key={item.id}>
                            <CardHeader>
                                <CardTitle>Week {item.week}: {item.title}</CardTitle>
                            </CardHeader>
                            {item.description && <CardContent><p className="text-muted-foreground">{item.description}</p></CardContent>}
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="pt-6">
                        <Alert>
                            <Route className="h-4 w-4" />
                            <AlertTitle>No Course Path Defined</AlertTitle>
                            <AlertDescription>
                                The lecturer has not defined a course path or syllabus yet.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
