
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

type Notification = {
  id: string;
  message: string;
  link: string;
  timestamp: number;
  read: boolean;
};

export default function NotificationsPage() {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const notificationsRef = ref(db, `notifications/${currentUser.uid}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const notificationsList: Notification[] = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        setNotifications(notificationsList);
      } else {
        setNotifications([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);
  
  const handleUpdateNotification = async (notificationId: string, read: boolean) => {
    if (!currentUser) return;
    try {
      const notificationRef = ref(db, `notifications/${currentUser.uid}/${notificationId}`);
      await update(notificationRef, { read });
    } catch (error) {
      console.error("Failed to update notification", error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!currentUser) return;
    try {
      const notificationRef = ref(db, `notifications/${currentUser.uid}/${notificationId}`);
      await remove(notificationRef);
      toast({ title: "Notification deleted." });
    } catch (error) {
       console.error("Failed to delete notification", error);
       toast({ variant: 'destructive', title: "Failed to delete notification." });
    }
  };
  
  const handleMarkAllAsRead = async () => {
      if (!currentUser) return;
      const updates: { [key: string]: boolean } = {};
      notifications.forEach(n => {
        if (!n.read) {
          updates[`notifications/${currentUser.uid}/${n.id}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
        toast({ title: "All notifications marked as read." });
      }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <CardTitle className="font-headline text-2xl">Notifications</CardTitle>
                <CardDescription>A complete log of all your notifications.</CardDescription>
            </div>
            <Button 
                onClick={handleMarkAllAsRead} 
                disabled={loading || notifications.every(n => n.read)}
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
                            className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center ${!n.read ? 'bg-accent/50' : 'bg-transparent'}`}
                        >
                            <div className="flex flex-1 items-start gap-4">
                                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <Bell className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <Link href={n.link} passHref>
                                        <p className="cursor-pointer text-sm font-medium hover:underline">{n.message}</p>
                                    </Link>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center">
                                <Button 
                                    variant={n.read ? "secondary" : "outline"} 
                                    size="sm" 
                                    onClick={() => handleUpdateNotification(n.id, !n.read)}
                                >
                                    {n.read ? <X className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                                    {n.read ? 'Mark Unread' : 'Mark Read'}
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

