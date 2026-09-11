import { LoginForm } from "@/components/forms/login-form";

export const metadata = {
  title: "ورود مشاور",
  robots: { index: false, follow: false },
};

export default function CounselorLoginPage() {
  return <LoginForm role="COUNSELOR" />;
}
