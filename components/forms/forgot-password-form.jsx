"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";

/**
 * Step one of password recovery: request a reset link.
 *
 * The server always answers with the same generic message, so this screen never
 * reveals whether a username exists.
 */
function ForgotPasswordForm({ role = "" }) {
  const [username, setUsername] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [devLink, setDevLink] = React.useState("");

  const loginHref = role ? `/login/${role}` : "/login/student";

  const { loading, run: submitRequest } = useAsyncSubmit(async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevLink("");

    const response = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { username: username.trim() },
    });

    if (response.networkError) {
      setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      return;
    }

    if (!response.ok) {
      setError(response.data?.error || "درخواست بازیابی ثبت نشد. لطفاً دوباره تلاش کنید.");
      return;
    }

    setMessage(response.data?.message || "درخواست شما ثبت شد.");
    if (response.data?.devResetUrl) setDevLink(response.data.devResetUrl);
  });

  return (
    <AuthShell
      badge="بازیابی رمز عبور"
      title="رمز عبور خود را فراموش کرده‌اید؟"
      description="نام کاربری خود را وارد کنید تا لینک بازیابی برای شما ساخته شود."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          رمز عبور را به یاد آوردید؟{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">
            بازگشت به صفحه ورود
          </Link>
        </p>
      }
    >
      <form onSubmit={submitRequest} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-6">{message}</span>
            </div>

            {devLink && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
                <p className="mb-1 font-semibold">حالت توسعه — لینک بازیابی:</p>
                <a href={devLink} className="break-all underline">
                  {devLink}
                </a>
              </div>
            )}

            <div className="flex items-center gap-2">
              <MailCheck className="h-4 w-4" />
              <span>
                اگر لینک بازیابی را دریافت کردید، از{" "}
                <Link href="/reset-password" className="font-medium underline">
                  این صفحه
                </Link>{" "}
                رمز جدید خود را تعیین کنید.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="username">نام کاربری</Label>
          <Input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={loading}
            dir="ltr"
            className="text-left"
            placeholder="نام کاربری خود را وارد کنید"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading || !username.trim()}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال ارسال درخواست...
            </>
          ) : (
            "درخواست لینک بازیابی"
          )}
        </Button>

        <p className="text-center text-xs leading-6 text-muted-foreground">
          به دلایل امنیتی، پیام این صفحه در هر حالت یکسان است تا امکان شناسایی نام‌های
          کاربری موجود وجود نداشته باشد.
        </p>
      </form>
    </AuthShell>
  );
}

export { ForgotPasswordForm };
