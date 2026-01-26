
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page's functionality has been moved to /admin/registration_management
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/registration_management');
    }, [router]);

    return (
        <div>Redirecting to Registration Management...</div>
    );
}
