"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function LoginForm({ role }) {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const roleConfig = {
    ADMIN: {
      title: "ورود مدیر سیستم",
      description: "برای مدیریت سیستم وارد شوید",
      icon: "🛡️",
      color: "bg-red-100 dark:bg-red-900/30",
    },
    COUNSELOR: {
      title: "ورود مشاور",
      description: "برای مشاهده دانش‌آموزان خود وارد شوید",
      icon: "👨‍🏫",
      color: "bg-blue-100 dark:bg-blue-900/30",
    },
    STUDENT: {
      title: "ورود دانش‌آموز",
      description: "برای مشاهده پروفایل خود وارد شوید",
      icon: "📚",
      color: "bg-green-100 dark:bg-green-900/30",
    },
  };

  const config = roleConfig[role];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "خطا در ورود به سیستم");
        return;
      }

      router.push(`/${role.toLowerCase()}`);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className={`mx-auto h-16 w-16 rounded-full ${config.color} flex items-center justify-center`}>
            <span className="text-3xl">{config.icon}</span>
          </div>
          <CardTitle className="text-xl">{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">نام کاربری</Label>
              <Input
                id="username"
                type="text"
                placeholder="نام کاربری خود را وارد کنید"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">رمز عبور</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="رمز عبور خود را وارد کنید"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  dir="ltr"
                  className="pl-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  در حال ورود...
                </>
              ) : (
                "ورود"
              )}
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Link
              href="/reset-password"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              رمز عبور خود را فراموش کرده‌اید؟
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
              بازگشت به صفحه اصلی
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { LoginForm };
