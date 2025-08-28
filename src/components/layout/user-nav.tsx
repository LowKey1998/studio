
'use client';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ProfileDialog } from "../profile-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function UserNav() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await auth.signOut();
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
  
  if (loading) {
    return <Skeleton className="h-10 w-24 rounded-full" />;
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  }


  return (
    <>
    <div className="flex items-center gap-2">
        <span className="text-sm font-medium hidden md:inline-block">{userProfile?.name}</span>
        <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full"
            onClick={() => setIsProfileOpen(true)}
        >
            <Avatar className="h-10 w-10 border-2 border-transparent hover:border-primary transition-colors">
            <AvatarImage src={userProfile?.profilePictureUrl || undefined} alt={userProfile?.name || 'User'} data-ai-hint="profile picture" />
            <AvatarFallback>{userProfile?.name ? getInitials(userProfile.name) : user.email ? getInitials(user.email) : 'U'}</AvatarFallback>
            </Avatar>
        </Button>
    </div>

    {user && (
      <ProfileDialog
        isOpen={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        userId={user.uid}
      />
    )}
    </>
  );
}
