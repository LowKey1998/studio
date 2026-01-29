
// This page has been replaced by /staff/student-absences
// We will redirect users from here to the new page.

'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/staff/student-absences');
    }, [router]);

    return (
        <div>Redirecting to Student Absences...</div>
    );
}
