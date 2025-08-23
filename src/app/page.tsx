// This file has been replaced by landing/page.tsx
// It can be deleted.

'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/landing');
  }, [router]);

  return null;
}
