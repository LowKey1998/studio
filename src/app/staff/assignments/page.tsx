// This file is being replaced by /app/staff/courses/page.tsx for a more integrated experience.
// We will redirect users from here to the new page.

'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/staff/courses');
    }, [router]);

    return (
        <div>Redirecting to your courses...</div>
    );
}
