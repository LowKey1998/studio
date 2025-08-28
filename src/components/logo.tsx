import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from './theme-provider';
import { Skeleton } from './ui/skeleton';

export default function Logo() {
  const { institutionName, institutionLogo, loadingTheme } = useTheme();

  if (loadingTheme) {
      return <Skeleton className="h-8 w-32" />;
  }
  
  if (institutionLogo) {
      return (
        <Link href="/" className="flex items-center gap-2">
            <img src={institutionLogo} alt={`${institutionName} Logo`} className="h-8 w-auto" />
        </Link>
      )
  }

  return (
    <Link href="/" className="flex items-center gap-2">
      <GraduationCap className="h-6 w-6 text-primary" />
      <span className="font-headline text-lg font-bold">
        {institutionName || 'Edutrack'}
      </span>
    </Link>
  );
}
