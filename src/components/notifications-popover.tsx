
"use client";

import { useNotifications } from "@/hooks/use-notifications";
import { Bell, Check, Sparkles, X, Info, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types";

const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  success: <Check className="h-5 w-5 text-green-500" />,
  error: <X className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
};

export function NotificationsPopover() {
  const {
    notifications,
    unreadCount,
    summary,
    isLoadingSummary,
    summarize,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const router = useRouter();

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 md:w-96">
        <Card className="border-0">
          <CardHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
            <CardTitle className="text-lg font-headline">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {unreadCount > 0 && (
              <div className="p-4 border-b">
                 <Button
                  className="w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white hover:opacity-90 transition-opacity"
                  onClick={summarize}
                  disabled={isLoadingSummary}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isLoadingSummary ? "Summarizing..." : "Summarize with AI"}
                </Button>
              </div>
            )}
           
            {isLoadingSummary && <div className="p-4 text-sm text-center text-muted-foreground">Generating summary...</div>}
            
            {summary && (
              <div className="p-4 border-b bg-secondary/50">
                 <h4 className="font-semibold text-sm mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-2 text-accent" />
                    AI Summary
                </h4>
                <p className="text-sm text-muted-foreground">{summary}</p>
              </div>
            )}

            <ScrollArea className="h-80">
              <div className="p-2">
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50 cursor-pointer",
                        !notification.isRead && "bg-secondary"
                      )}
                    >
                      <div className="mt-1">
                        {notificationIcons[notification.type] || notificationIcons.info}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center text-center">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-4 font-medium">No notifications</p>
                    <p className="text-sm text-muted-foreground">You're all caught up!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-2">
                <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link href="/student/notifications">View all notifications</Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
