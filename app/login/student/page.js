import { LoginForm } from "@/components/forms/login-form";

export const metadata = {
  title: "ورود دانش‌آموز",
  robots: { index: false, follow: false },
};

export default function StudentLoginPage() {
  return <LoginForm role="STUDENT" />;
}
