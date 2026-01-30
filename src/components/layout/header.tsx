"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserNav } from "./user-nav";
import { NotificationsPopover } from "../notifications-popover";
import Link from 'next/link';
import { Button } from "../ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <SidebarTrigger />
        <div className="flex flex-1 items-center justify-end space-x-2">
            <NotificationsPopover />
            <UserNav />
        </div>
      </div>
    </header>
  );
}
