
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserNav } from "./user-nav";
import { NotificationsPopover } from "../notifications-popover";

export function Header() {
  return (
    <header className="sticky top-0 z-10 w-full border-b bg-[hsl(var(--header-background)/0.95)] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--header-background)/0.6)]">
      <div className="flex h-14 items-center px-4">
        {/* Only show the toggle on mobile devices */}
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
            <NotificationsPopover />
            <UserNav />
        </div>
      </div>
    </header>
  );
}
