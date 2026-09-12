"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
import { PASSWORD_REQUIREMENTS, validatePasswordStrength } from "@/lib/password-policy";
import { AlertCircle, Info, KeyRound, Loader2 } from "lucide-react";

/**
 * Change-password card shared by all three settings pages.
 *
 * The rules shown here come from the same module the server enforces, so the
 * hint text can never contradict the API.
 */
export function ChangePasswordForm() {
  const { addToast } = useToast();
  const [form, setForm] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = React.useState("");

  const { loading, run: submit } = useAsyncSubmit(async (event) => {
    event.preventDefault();
    setError("");

    const policy = validatePasswordStrength(form.newPassword);
    if (!policy.valid) {
      setError(policy.errors[0]);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("تکرار رمز عبور جدید مطابقت ندارد");
      return;
    }

    if (form.newPassword === form.currentPassword) {
      setError("رمز عبور جدید نباید با رمز عبور فعلی یکسان باشد");
      return;
    }

    const response = await apiRequest("/api/auth/change-password", {
      method: "POST",
      body: {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      },
    });

    if (!response.ok) {
      setError(response.data?.error || "تغییر رمز عبور انجام نشد");
      return;
    }

    addToast({
      title: "رمز عبور تغییر کرد",
      description: "از این پس با رمز عبور جدید وارد شوید.",
      variant: "success",
    });
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          تغییر رمز عبور
        </CardTitle>
        <CardDescription>
          پس از تغییر رمز، نشست سایر دستگاه‌های وارد‌شده با رمز قدیمی خاتمه می‌یابد.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              className="text-left"
              value={form.currentPassword}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, currentPassword: event.target.value }))
              }
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">رمز عبور جدید</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-left"
              value={form.newPassword}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, newPassword: event.target.value }))
              }
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">تکرار رمز عبور جدید</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-left"
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))
              }
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

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال ذخیره...
              </>
            ) : (
              "ذخیره رمز عبور جدید"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
