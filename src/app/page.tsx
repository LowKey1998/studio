'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This component handles the root path "/" and redirects to the landing page.
export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/landing');
    }, [router]);

    return null; // Return null or a loading spinner while redirecting
}
