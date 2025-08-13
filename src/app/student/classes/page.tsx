
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is a redirect to the default "/student/courses" page
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/student/courses');
    }, [router]);

    return (
        <div>Redirecting...</div>
    );
}
