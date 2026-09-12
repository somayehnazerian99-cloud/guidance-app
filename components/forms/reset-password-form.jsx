"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
import { PASSWORD_REQUIREMENTS, validatePasswordStrength } from "@/lib/password-policy";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

/**
 * The reset token is read on the server (from searchParams) and passed down as
 * a prop, so this component needs no mount-time effect and never flashes the
 * wrong step.
 */
export function ResetPasswordForm({ token = "" }) {
  const hasToken = Boolean(token);

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [done, setDone] = React.useState(false);

  const { loading, run: submitNewPassword } = useAsyncSubmit(async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("تکرار رمز عبور با رمز جدید مطابقت ندارد");
      return;
    }

    const policy = validatePasswordStrength(password);
    if (!policy.valid) {
      setError(policy.errors[0]);
      return;
    }

    const response = await apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword: password },
    });

    if (response.networkError) {
      setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      return;
    }

    if (!response.ok) {
      setError(response.data?.error || "لینک بازیابی نامعتبر یا منقضی شده است");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setDone(true);
    setMessage(response.data?.message || "رمز عبور با موفقیت تغییر کرد.");
  });

  if (!hasToken) {
    return (
      <AuthShell
        badge="بازیابی رمز عبور"
        title="لینک بازیابی معتبر نیست"
        description="برای تعیین رمز عبور جدید، ابتدا از صفحه بازیابی یک لینک تازه درخواست کنید."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="font-medium text-primary hover:underline">
              بازگشت به صفحه اصلی
            </Link>
          </p>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-6">
            این صفحه فقط از طریق لینک ارسال‌شده قابل استفاده است. لینک‌های بازیابی یک‌بار
            مصرف هستند و پس از ۶۰ دقیقه منقضی می‌شوند.
          </span>
        </div>
        <Button asChild className="mt-4 w-full">
          <Link href="/forgot-password">درخواست لینک بازیابی جدید</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge="بازیابی رمز عبور"
      title={done ? "رمز عبور تغییر کرد" : "تعیین رمز عبور جدید"}
      description={
        done
          ? "از این پس باید با رمز عبور جدید وارد شوید."
          : "رمز عبور جدید خود را وارد کنید. سایر دستگاه‌های وارد‌شده از حساب شما خارج می‌شوند."
      }
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-primary hover:underline">
            بازگشت به صفحه اصلی
          </Link>
        </p>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && !error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-6">{message}</span>
        </div>
      )}

      {done ? (
        <Button asChild className="w-full" size="lg">
          <Link href="/">ورود به سامانه</Link>
        </Button>
      ) : (
        <form onSubmit={submitNewPassword} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور جدید</Label>
            <Input
              id="password"
              type="password"
              dir="ltr"
              className="text-left"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تکرار رمز عبور جدید</Label>
            <Input
              id="confirmPassword"
              type="password"
              dir="ltr"
              className="text-left"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="space-y-1">
              {PASSWORD_REQUIREMENTS.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال تغییر رمز عبور...
              </>
            ) : (
              "تغییر رمز عبور"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
