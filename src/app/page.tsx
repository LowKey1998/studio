import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-primary">EduTrack360</h1>
        <nav>
          <Link href="/login">
            <Button>
              Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-4xl md:text-6xl font-bold mb-4">
          The Future of Student Management
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
          EduTrack360 provides a seamless, all-in-one solution for students, staff, and administrators to manage academic life efficiently.
        </p>
        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/about">
            <Button size="lg" variant="outline">Learn More</Button>
          </Link>
        </div>
      </main>
      <footer className="p-4 text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} EduTrack360. All rights reserved.</p>
      </footer>
    </div>
  );
}
