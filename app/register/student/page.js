import { RegisterForm } from "@/components/forms/register-form";

export const metadata = {
  title: "ثبت‌نام دانش‌آموز",
  robots: { index: false, follow: false },
};

export default function StudentRegisterPage() {
  return <RegisterForm role="STUDENT" />;
}
