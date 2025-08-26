
'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectPage() {
    const router = useRouter();
    React.useEffect(() => {
        router.replace('/admin/course-paths');
    }, [router]);

    return (
        <div>Redirecting to Course Paths...</div>
    );
}

    