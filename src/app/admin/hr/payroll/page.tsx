
// This page has been replaced by the more feature-rich /staff/payroll page.
// We will redirect users from here to the new page.

'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/vacancies');
    }, [router]);

    return (
        <div>Redirecting to Vacancies...</div>
    );
}
