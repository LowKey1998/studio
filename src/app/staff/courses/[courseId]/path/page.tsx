
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

// This functionality has been moved to a new file /schedule.
export default function RedirectPage() {
    const router = useRouter();
    const params = useParams();
    const courseId = params.courseId as string;

    useEffect(() => {
        router.replace(`/staff/courses/${courseId}/schedule`);
    }, [router, courseId]);

    return (
        <div>Redirecting to Class Schedule...</div>
    );
}
