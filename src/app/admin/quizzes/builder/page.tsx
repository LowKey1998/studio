
'use client';
import QuizBuilder from '@/components/quiz-builder';
import { useSearchParams } from 'next/navigation';

export default function CreateQuizPage() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');

    return <QuizBuilder courseId={courseId} />;
}
