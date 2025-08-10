
'use client';
import QuizBuilder from '@/components/quiz-builder';
import { useSearchParams } from 'next/navigation';

export default function CreateQuizPage() {
    const searchParams = useSearchParams();
    const courseId = searchParams.get('courseId');
    const semesterId = searchParams.get('semesterId');

    return <QuizBuilder courseId={courseId} semesterId={semesterId} />;
}
