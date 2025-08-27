
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/parents/accounts');
    }, [router]);

    return (
        <div>Redirecting to Parent Accounts...</div>
    );
}
