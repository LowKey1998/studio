
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This file is no longer needed as the functionality has been moved to /app/student/classes for a more integrated experience.
// We will redirect users from here to the new page.
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/student/courses');
    }, [router]);

    return (
        <div>Redirecting to your classes...</div>
    );
}
