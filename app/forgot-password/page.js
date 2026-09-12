import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata = {
  title: "بازیابی رمز عبور",
  description: "درخواست لینک بازیابی رمز عبور",
  robots: { index: false, follow: false },
};

/**
 * The portal a visitor came from is passed through the query string so the
 * "back to login" link returns them to the right place. It is only used to pick
 * a link — never to authorise anything.
 */
export default async function ForgotPasswordPage({ searchParams }) {
  const params = await searchParams;
  const rawRole = params?.role;
  const allowed = ["admin", "counselor", "student"];
  const role = typeof rawRole === "string" && allowed.includes(rawRole) ? rawRole : "";

  return <ForgotPasswordForm role={role} />;
}
