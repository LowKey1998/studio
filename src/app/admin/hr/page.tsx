
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is a redirect to the default "/admin/hr/add-staff" page
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/hr/add-staff');
    }, [router]);

    return (
        <div>Redirecting to Add Staff page...</div>
    );
}
