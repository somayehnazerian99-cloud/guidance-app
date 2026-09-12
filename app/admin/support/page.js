import { TicketCenter } from "@/components/support/ticket-center";

export const metadata = {
  title: "پشتیبانی کاربران",
  robots: { index: false, follow: false },
};

export default function AdminSupportPage() {
  return <TicketCenter isAdmin />;
}
