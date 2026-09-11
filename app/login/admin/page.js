import { LoginForm } from "@/components/forms/login-form";

export const metadata = {
  title: "ورود مدیر سیستم",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <LoginForm role="ADMIN" />;
}
