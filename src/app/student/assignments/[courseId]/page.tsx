// This file is being replaced by /app/student/courses/[courseId]/assignments for a more integrated experience.
// We will redirect users from here to the new page.

'use client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    const params = useParams();
    const courseId = params.courseId as string;

    useEffect(() => {
        if (courseId) {
            router.replace(`/student/courses/${courseId}/assignments`);
        }
    }, [router, courseId]);

    return (
        <div>Redirecting to course assignments...</div>
    );
}
