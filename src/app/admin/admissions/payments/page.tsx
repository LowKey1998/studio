// This page has been removed as its functionality is now part of the main /admin/payments page.
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/payments');
    }, [router]);

    return (
        <div>Redirecting to Payments...</div>
    );
}
