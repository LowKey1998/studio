import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from './theme-provider';
import { Skeleton } from './ui/skeleton';

export default function Logo() {
  const { institutionName, institutionLogo, institutionNameParts, loadingTheme } = useTheme();

  if (loadingTheme) {
    return <Skeleton className="h-8 w-32" />;
  }
  
  const hasCustomLogo = !!institutionLogo;
  const hasCustomName = institutionNameParts && institutionNameParts.length > 0;

  return (
    <Link href="/" className="flex items-center gap-2">
        {hasCustomLogo ? (
             <img src={institutionLogo!} alt={`${institutionName} Logo`} className="h-8 w-auto" />
        ) : (
            <GraduationCap className="h-6 w-6 text-primary" />
        )}
      <span className="font-headline text-lg font-bold">
        {hasCustomName ? (
            institutionNameParts.map((part, index) => (
                <span key={index} style={{ color: part.color }}>
                    {part.text}{' '}
                </span>
            ))
        ) : (
            institutionName || 'Edutrack'
        )}
      </span>
    </Link>
  );
}
