
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page has been replaced by /admin/registration_management
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/registration_management');
    }, [router]);

    return (
        <div>Redirecting...</div>
    );
}
