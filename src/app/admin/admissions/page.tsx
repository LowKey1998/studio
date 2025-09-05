'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is a redirect to the default "/admin/admissions/add-student" page
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/admissions/add-student');
    }, [router]);

    return (
        <div>Redirecting to Add Student page...</div>
    );
}
