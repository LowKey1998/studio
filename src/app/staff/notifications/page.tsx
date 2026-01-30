'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Check, Trash2, X, Info, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useNotifications } from '@/hooks/use-notifications';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';


const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  success: <Check className="h-5 w-5 text-green-500" />,
  error: <X className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};


export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    // A simple timeout to simulate loading, as the hook handles the actual fetching
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    const { user } = auth;
    if (!user) return;
    try {
      const notificationRef = ref(db, `notifications/${user.uid}/${notificationId}`);
      await remove(notificationRef);
      toast({ title: "Notification deleted." });
    } catch (error) {
       toast({ variant: 'destructive', title: "Failed to delete notification." });
    }
  };
  
  const handleUpdateNotification = (id: string, isRead: boolean) => {
    const { user } = auth;
    if (!user) return;
    const notificationRef = ref(db, `notifications/${user.uid}/${id}`);
    update(notificationRef, { read: !isRead });
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <CardTitle className="font-headline text-2xl">Notifications</CardTitle>
                <CardDescription>A complete log of all your notifications.</CardDescription>
            </div>
            <Button 
                onClick={markAllAsRead} 
                disabled={loading || unreadCount === 0}
            >
                <Check className="mr-2 h-4 w-4" />
                Mark all as read
            </Button>
        </CardHeader>
        <CardContent>
            <ul className="space-y-3">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <li key={i} className="flex items-center gap-4 rounded-lg border p-4">
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <div className="flex-1 space-y-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                            <Skeleton className="h-8 w-20" />
                        </li>
                    ))
                ) : notifications.length > 0 ? (
                    notifications.map(n => (
                        <li 
                            key={n.id} 
                            className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center ${!n.isRead ? 'bg-accent/50' : 'bg-transparent'}`}
                        >
                            <div 
                              className="flex flex-1 items-start gap-4 cursor-pointer"
                              onClick={() => handleNotificationClick(n)}
                            >
                                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    {notificationIcons[n.type] || notificationIcons.info}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{n.message}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center">
                                <Button 
                                    variant={n.isRead ? "secondary" : "outline"} 
                                    size="sm" 
                                    onClick={() => handleUpdateNotification(n.id, n.isRead)}
                                >
                                    {n.isRead ? <X className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                                    {n.isRead ? 'Mark Unread' : 'Mark Read'}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteNotification(n.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </li>
                    ))
                ) : (
                    <div className="py-16 text-center text-muted-foreground">
                        <Bell className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No notifications yet</h3>
                        <p className="mt-2 text-sm">Check back here for important updates.</p>
                    </div>
                )}
            </ul>
        </CardContent>
      </Card>
    </div>
  );
}
