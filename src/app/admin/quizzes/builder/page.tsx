'use client';
import * as React from 'react';
import QuizBuilder from '@/components/quiz-builder';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

function CreateQuizPageContent() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const semesterId = searchParams.get('semesterId');

    return <QuizBuilder courseId={courseId} semesterId={semesterId} />;
}


export default function CreateQuizPage() {
    return (
        <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CreateQuizPageContent />
        </React.Suspense>
    );
}
