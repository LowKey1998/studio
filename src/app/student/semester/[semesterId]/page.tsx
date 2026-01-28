'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

type Semester = {
  name: string;
};

export default function SemesterDetailPage() {
    const params = useParams();
    const semesterId = params.semesterId as string;
    const [semester, setSemester] = React.useState<Semester | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!semesterId) return;
        const fetchSemester = async () => {
            setLoading(true);
            const semesterRef = ref(db, `semesters/${semesterId}`);
            const snapshot = await get(semesterRef);
            if (snapshot.exists()) {
                setSemester(snapshot.val());
            }
            setLoading(false);
        };
        fetchSemester();
    }, [semesterId]);

    if (loading) {
        return <Skeleton className="h-64 w-full" />;
    }

    return (
        <div className="space-y-6">
             <Button variant="outline" asChild>
                <Link href="/student/classes"><ChevronLeft className="mr-2 h-4 w-4" /> Back to All Semesters</Link>
            </Button>
             <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{semester?.name || 'Semester Details'}</CardTitle>
                    <CardDescription>
                        Detailed information for the semester, including timetables and exam schedules, will be displayed here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Coming soon...</p>
                </CardContent>
            </Card>
        </div>
    );
}
