import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export const metadata = {
  title: "بازیابی رمز عبور",
  robots: { index: false, follow: false },
};

/**
 * The token is read on the server so it never ends up in a client-side effect,
 * a lazy state initializer or a hydration mismatch.
 */
export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = typeof rawToken === "string" ? rawToken : "";

  return <ResetPasswordForm token={token} />;
}
