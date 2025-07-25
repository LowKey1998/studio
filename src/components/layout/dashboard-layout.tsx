
"use client";

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Header } from '@/components/layout/header';
import { LogOut, LayoutDashboard, User, Settings, Library, PenSquare, BookCheck, FileText, Calendar, DollarSign, BarChart2, UserCheck, Briefcase, BookUp, UploadCloud, BookOpenCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { get, ref } from 'firebase/database';
import { Skeleton } from '../ui/skeleton';

const studentMenuItems = [
    { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/student/courses', label: 'Courses', icon: Library },
    { href: '/student/assignments', label: 'Assignments', icon: PenSquare },
    { href: '/student/quizzes', label: 'Quizzes', icon: BookCheck },
    { href: '/student/registration', label: 'Registration', icon: UserCheck },
    { href: '/student/library', label: 'Library', icon: Library },
    { href: '/student/resources', label: 'Resources', icon: FileText },
    { href: '/student/calendar', label: 'Calendar', icon: Calendar },
    { href: '/student/payments', label: 'Payments', icon: DollarSign },
    { href: '/student/attendance', label: 'Attendance', icon: BarChart2 },
  ];

const staffMenuItems = [
    { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staff/profile', label: 'Profile', icon: User },
    { href: '/staff/courses', label: 'Course Management', icon: BookOpenCheck },
    { href: '/staff/library', label: 'Library Management', icon: BookUp },
    { href: '/staff/resources', label: 'Resource Management', icon: UploadCloud },
    // Add more staff-specific items here
];

const adminMenuItems = [
    { href: '/admin/dashboard', label: 'User Management', icon: User },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    // Add more admin-specific items here
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [role, setRole] = React.useState<string | null>(null);
  const [menuItems, setMenuItems] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchUserRole = async () => {
        if (user) {
            // This is not efficient, but it's a simple way to get the ID
            // In a real app, you'd want a more direct way to get the user's custom ID
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                const users = snapshot.val();
                const foundUser = Object.entries(users).find(([id, userData]: [string, any]) => userData.uid === user.uid);
                if(foundUser) {
                    const userRole = foundUser[1].role;
                    setRole(userRole);
                    switch(userRole) {
                        case 'student':
                            setMenuItems(studentMenuItems);
                            break;
                        case 'staff':
                            setMenuItems(staffMenuItems);
                            break;
                        case 'admin':
                            setMenuItems(adminMenuItems);
                            break;
                        default:
                            setMenuItems([]);
                    }
                }
            }
        }
    };

    if (!loading) {
      fetchUserRole();
    }
  }, [user, loading]);



  const handleLogout = async () => {
    try {
      await signOut(auth);
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

  const renderMenu = () => {
    if (loading || !role) {
        return Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
    }

    return menuItems.map((item) => (
      <SidebarMenuItem key={item.href}>
        <Link href={item.href} passHref legacyBehavior>
          <SidebarMenuButton isActive={pathname === item.href}>
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    ));
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <h1 className="text-2xl font-bold text-primary">EduTrack360</h1>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {renderMenu()}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout}>
                        <LogOut />
                        <span>Log out</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Header />
        <main className="p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
