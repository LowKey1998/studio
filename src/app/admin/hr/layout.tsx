// This file is obsolete as HR menu items are now dynamically added to the main layout.
// It can be deleted.

import DashboardLayout from "@/components/layout/dashboard-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
