
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page has been replaced by the Notifications Popover in the header
// and a future unified messages center.
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/student/dashboard');
    }, [router]);

    return (
        <div>Redirecting...</div>
    );
}
