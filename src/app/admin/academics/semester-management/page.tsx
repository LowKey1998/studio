
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page's functionality has been moved to /admin/registration-management
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/registration-management');
    }, [router]);

    return (
        <div>Redirecting to Registration Management...</div>
    );
}
