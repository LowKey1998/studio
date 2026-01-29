
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page has been moved to /admin/dashboard/financial-kpis
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/dashboard/financial-kpis');
    }, [router]);

    return (
        <div>Redirecting to Financial KPIs dashboard...</div>
    );
}
