
'use client';
import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function ParentHeader() {
    const router = useRouter();
    const { toast } = useToast();

    const handleLogout = async () => {
        try {
          await supabase.auth.signOut();
          toast({
            title: "Logged Out",
            description: "You have been successfully logged out.",
          });
          router.push('/login');
        } catch (error) {
          console.error("Logout failed:", error);
          toast({
            variant: 'destructive',
            title: 'Logout Failed',
            description: 'An error occurred while logging out. Please try again.',
          });
        }
      };

    return (
         <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                <Logo />
                <Button variant="ghost" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /> Log Out</Button>
            </div>
        </header>
    )
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = React.useState(true);
    const [authenticated, setAuthenticated] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/parent-login');
            } else {
                setAuthenticated(true);
            }
            setLoading(false);
        };
        
        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.replace('/parent-login');
            } else {
                setAuthenticated(true);
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    if (loading || !authenticated) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="flex min-h-screen flex-col bg-muted/40">
            <ParentHeader />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
    );
}
