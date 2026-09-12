import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { PageHeader } from "@/components/ui/states";
import { Settings } from "lucide-react";

export const metadata = {
  title: "تنظیمات",
  robots: { index: false, follow: false },
};

export default function CounselorSettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        icon={Settings}
        title="تنظیمات"
        description="مدیریت امنیت حساب کاربری شما"
      />
      <ChangePasswordForm />
    </div>
  );
}
