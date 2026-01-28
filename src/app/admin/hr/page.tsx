
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is a redirect to the default "/admin/hr/staff-list" page
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/hr/staff-list');
    }, [router]);

    return (
        <div>Redirecting to Staff List page...</div>
    );
}
