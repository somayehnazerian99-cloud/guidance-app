import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { requireRole } from "@/lib/server-auth";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  // Validated on the server against the database: a STUDENT or COUNSELOR
  // session can never render this panel, regardless of the URL used.
  const user = await requireRole("ADMIN");

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
