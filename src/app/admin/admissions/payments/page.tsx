
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page's functionality is in /admin/payments
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/payments');
    }, [router]);

    return (
        <div>Redirecting to Payments...</div>
    );
}
