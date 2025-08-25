
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is a redirect to the default "/admin/parents/accounts" page
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/parents/accounts');
    }, [router]);

    return (
        <div>Redirecting to Parent Accounts...</div>
    );
}
