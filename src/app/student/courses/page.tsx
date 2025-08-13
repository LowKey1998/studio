'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page is a redirect to the default "classes" overview
export default function RedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/student/classes');
    }, [router]);

    return (
        <div>Redirecting...</div>
    );
}
