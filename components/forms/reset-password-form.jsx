"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/**
 * The reset token is read on the server (from searchParams) and passed down as
 * a prop, so this component needs no mount-time effect and never flashes the
 * wrong step.
 */
export function ResetPasswordForm({ token = "" }) {
  const hasToken = Boolean(token);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [devLink, setDevLink] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const requestReset = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevLink("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در ارسال درخواست");
        return;
      }
      setMessage(data.message);
      if (data.devResetUrl) setDevLink(data.devResetUrl);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("تکرار رمز عبور با رمز جدید مطابقت ندارد");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "خطا در تغییر رمز عبور");
        return;
      }
      setDone(true);
      setMessage(data.message);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-xl">
            {hasToken ? "تعیین رمز عبور جدید" : "بازیابی رمز عبور"}
          </CardTitle>
          <CardDescription>
            {hasToken
              ? "رمز عبور جدید خود را وارد کنید"
              : "نام کاربری خود را وارد کنید تا لینک بازیابی ایجاد شود"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive text-center">
              {error}
            </div>
          )}

          {message && !error && (
            <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 text-center dark:bg-emerald-950/30 dark:text-emerald-200">
              {message}
            </div>
          )}

          {devLink && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 break-all dark:bg-amber-950/30 dark:text-amber-100">
              <p className="mb-1 font-semibold">حالت توسعه — لینک بازیابی:</p>
              <a href={devLink} className="underline">
                {devLink}
              </a>
            </div>
          )}

          {hasToken ? (
            done ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  اکنون می‌توانید با رمز عبور جدید وارد شوید.
                </p>
                <Button asChild className="w-full">
                  <Link href="/">بازگشت به صفحه ورود</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submitNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">رمز عبور جدید</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">تکرار رمز عبور جدید</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    dir="ltr"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "تغییر رمز عبور"}
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  dir="ltr"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "درخواست بازیابی رمز"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              بازگشت به صفحه اصلی
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
