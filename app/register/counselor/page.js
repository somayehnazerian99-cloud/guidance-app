import { RegisterForm } from "@/components/forms/register-form";

export const metadata = {
  title: "ثبت‌نام مشاور",
  robots: { index: false, follow: false },
};

export default function CounselorRegisterPage() {
  return <RegisterForm role="COUNSELOR" />;
}
