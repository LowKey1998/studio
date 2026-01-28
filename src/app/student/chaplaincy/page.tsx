
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to the prayer requests page by default
export default function ChaplaincyPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/student/chaplaincy/prayer-requests');
    }, [router]);

    return (
        <div>Redirecting to prayer requests...</div>
    );
}
