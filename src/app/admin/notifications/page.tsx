
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page has been replaced by /admin/admissions/notifications
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/admissions/notifications');
    }, [router]);

    return (
        <div>Redirecting to SMS/Email Notifications...</div>
    );
}
