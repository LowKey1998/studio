import { NotificationsPopover } from '@/components/notifications-popover';
import { UserNav } from '@/components/layout/user-nav';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b bg-background/90 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="hidden font-headline text-xl font-semibold text-primary md:block">
          EduTrack360
        </h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationsPopover />
        <UserNav />
      </div>
    </header>
  );
}
