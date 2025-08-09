
'use client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';

// This page is now a layout with tabs, so we redirect the base route
// to the first tab, which is assignments.
export default function RedirectPage() {
    const router = useRouter();
    const params = useParams();
    const courseId = params.courseId as string;

    useEffect(() => {
        if (courseId) {
            router.replace(`/student/courses/${courseId}/path`);
        }
    }, [router, courseId]);

    return (
        <div>Redirecting...</div>
    );
}
