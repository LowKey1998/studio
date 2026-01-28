
// This page has been moved to /admin/dashboard/financial-kpis
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/dashboard/financial-kpis');
    }, [router]);

    return (
        <div>Redirecting to Financial KPIs dashboard...</div>
    );
}
