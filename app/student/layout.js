import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { requireRole } from "@/lib/server-auth";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function StudentLayout({ children }) {
  const user = await requireRole("STUDENT");

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
