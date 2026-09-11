import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { requireRole } from "@/lib/server-auth";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function CounselorLayout({ children }) {
  const user = await requireRole("COUNSELOR");

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
