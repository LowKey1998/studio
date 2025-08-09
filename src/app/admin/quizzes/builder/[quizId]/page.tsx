
'use client';
import QuizBuilder from '@/components/quiz-builder';
import { useParams } from 'next/navigation';

export default function EditQuizPage() {
    const params = useParams();
    const quizId = params.quizId as string;

    return <QuizBuilder quizId={quizId} />;
}
