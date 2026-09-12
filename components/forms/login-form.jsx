"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAsyncSubmit } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  GraduationCap,
  Presentation,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const ROLE_CONFIG = {
  ADMIN: {
    title: "ورود مدیر سیستم",
    description: "برای مدیریت کاربران، مدارس و گزارش‌های سامانه وارد شوید.",
    badge: "پنل مدیریت",
    icon: ShieldCheck,
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    ring: "focus-visible:ring-rose-500/40",
  },
  COUNSELOR: {
    title: "ورود مشاور",
    description: "برای مشاهده و بررسی پرونده دانش‌آموزان مرتبط با شما وارد شوید.",
    badge: "پنل مشاور",
    icon: Presentation,
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    ring: "focus-visible:ring-blue-500/40",
  },
  STUDENT: {
    title: "ورود دانش‌آموز",
    description: "برای مشاهده نمرات، علایق، توانایی‌ها و نتیجه هدایت تحصیلی وارد شوید.",
    badge: "پنل دانش‌آموز",
    icon: GraduationCap,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "focus-visible:ring-emerald-500/40",
  },
};

function LoginForm({ role }) {
  const router = useRouter();
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.STUDENT;
  const RoleIcon = config.icon;

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);

  // The lock inside useAsyncSubmit is what actually prevents a double submit:
  // a second click while the request is in flight is a no-op.
  const { loading, run: submitLogin } = useAsyncSubmit(async (event) => {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, role }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(data?.error || "ورود به سیستم انجام نشد. لطفاً دوباره تلاش کنید.");
        setPassword("");
        return;
      }

      setSuccess(true);
      // Client-side navigation, then a refresh so the destination panel is
      // rendered again on the server with the session cookie that was just set.
      // The server-side role guard in the panel layout therefore runs on a
      // request that already carries the new session.
      router.replace(`/${String(role).toLowerCase()}`);
      router.refresh();
    } catch {
      setError("ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.");
    }
  });

  return (
    <AuthShell title={config.title} description={config.description} badge={config.badge}>
      <div
        className={cn(
          "mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
          config.accent
        )}
      >
        <RoleIcon className="h-4 w-4" />
        <span>ورود اختصاصی {config.badge.replace("پنل ", "")}</span>
      </div>

      <form onSubmit={submitLogin} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>ورود موفق — در حال انتقال به پنل...</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="username">نام کاربری</Label>
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="مثال: student1001"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={loading || success}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            className={cn("text-left", config.ring)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">رمز عبور</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="رمز عبور خود را وارد کنید"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading || success}
              autoComplete="current-password"
              dir="ltr"
              className={cn("text-left pl-11", config.ring)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <Link
            href={`/forgot-password${role ? `?role=${String(role).toLowerCase()}` : ""}`}
            className="font-medium text-primary hover:underline"
          >
            رمز عبور خود را فراموش کرده‌اید؟
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || success || !username || !password}
        >
          {loading || success ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {success ? "در حال انتقال..." : "در حال ورود..."}
            </>
          ) : (
            "ورود به پنل"
          )}
        </Button>
      </form>

      {role !== "ADMIN" && (
        <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4">
          <p className="text-sm font-medium">حساب کاربری ندارید؟</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {role === "COUNSELOR"
              ? "مشاوران می‌توانند ثبت‌نام کنند؛ پس از تأیید مدیر سیستم، ورود شما فعال می‌شود."
              : "دانش‌آموزان می‌توانند در چند دقیقه ثبت‌نام کرده و وارد سامانه شوند."}
          </p>
          <Link
            href={`/register/${String(role).toLowerCase()}`}
            className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
          >
            ثبت‌نام {role === "COUNSELOR" ? "مشاور" : "دانش‌آموز"}
          </Link>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        ورود شما در سامانه به‌صورت امن ثبت می‌شود.{" "}
        <Link href="/" className="font-medium text-primary hover:underline">
          بازگشت به صفحه اصلی
        </Link>
      </p>
    </AuthShell>
  );
}

export { LoginForm };
