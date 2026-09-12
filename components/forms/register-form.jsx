"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
import { PASSWORD_REQUIREMENTS, validatePasswordStrength } from "@/lib/password-policy";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const REGISTRATION_USERNAME_PATTERN = /^[a-zA-Z0-9]+$/;
const GRADE_OPTIONS = [
  { value: 7, label: "پایه هفتم" },
  { value: 8, label: "پایه هشتم" },
  { value: 9, label: "پایه نهم" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

function RegisterForm({ role }) {
  const isCounselor = role === "COUNSELOR";

  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    studentCode: "",
    grade: 7,
    schoolYear: "1404-1405",
    phone: "",
    expertise: "",
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState({});
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  /** Client-side validation mirrors the server schema, but the server is authoritative. */
  const validate = () => {
    const errors = {};

    if (!form.firstName.trim()) errors.firstName = "نام را وارد کنید";
    if (!form.lastName.trim()) errors.lastName = "نام خانوادگی را وارد کنید";

    if (!form.username.trim()) {
      errors.username = "نام کاربری را وارد کنید";
    } else if (form.username.trim().length < 4) {
      errors.username = "نام کاربری باید حداقل ۴ کاراکتر باشد";
    } else if (!REGISTRATION_USERNAME_PATTERN.test(form.username.trim())) {
      errors.username = "نام کاربری فقط می‌تواند شامل حروف انگلیسی و اعداد باشد";
    }

    const passwordCheck = validatePasswordStrength(form.password);
    if (!passwordCheck.valid) {
      errors.password = passwordCheck.errors[0];
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "تکرار رمز عبور مطابقت ندارد";
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "ایمیل وارد‌شده معتبر نیست";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const { loading, run: submitRegistration } = useAsyncSubmit(async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!validate()) return;

    const payload = isCounselor
      ? {
          role: "COUNSELOR",
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          expertise: form.expertise.trim(),
          phone: form.phone.trim(),
        }
      : {
          role: "STUDENT",
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim(),
          studentCode: form.studentCode.trim(),
          grade: Number(form.grade),
          schoolYear: form.schoolYear.trim(),
          phone: form.phone.trim(),
        };

    const response = await apiRequest("/api/auth/register", { method: "POST", body: payload });

    if (response.networkError) {
      setError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
      return;
    }

    if (!response.ok) {
      setError(response.data?.error || "ثبت‌نام انجام نشد. اطلاعات وارد‌شده را بررسی کنید.");
      return;
    }

    setResult(response.data);
  });

  if (result) {
    return (
      <AuthShell
        badge={isCounselor ? "ثبت‌نام مشاور" : "ثبت‌نام دانش‌آموز"}
        title={isCounselor ? "ثبت‌نام شما ثبت شد" : "ثبت‌نام با موفقیت انجام شد"}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="leading-6">{result.message}</span>
          </div>

          {result.requiresApproval ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="leading-6">
                حساب شما در وضعیت «در انتظار تأیید مدیر» است. پس از تأیید، می‌توانید از
                صفحه ورود مشاور وارد شوید.
              </span>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="font-medium">اطلاعات ورود شما</p>
              <p className="mt-2 text-muted-foreground">
                نام کاربری: <span dir="ltr" className="font-mono">{result.user?.username}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {!result.requiresApproval && (
              <Button asChild className="flex-1">
                <Link href={`/login/${String(role).toLowerCase()}`}>ورود به پنل</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">بازگشت به صفحه اصلی</Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      badge={isCounselor ? "ثبت‌نام مشاور" : "ثبت‌نام دانش‌آموز"}
      title={isCounselor ? "ساخت حساب مشاور" : "ساخت حساب دانش‌آموز"}
      description={
        isCounselor
          ? "نام کاربری و رمز عبور را خودتان انتخاب کنید. پس از تأیید مدیر سیستم، ورود شما فعال می‌شود."
          : "نام کاربری و رمز عبور را خودتان انتخاب کنید و بلافاصله وارد سامانه شوید."
      }
      footer={
        <p className="text-center text-sm text-muted-foreground">
          حساب کاربری دارید؟{" "}
          <Link
            href={`/login/${String(role).toLowerCase()}`}
            className="font-medium text-primary hover:underline"
          >
            ورود به پنل
          </Link>
        </p>
      }
    >
      <form onSubmit={submitRegistration} className="space-y-5" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">نام</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={update("firstName")}
              disabled={loading}
              placeholder="مثال: علی"
              autoComplete="given-name"
              required
            />
            <FieldError>{fieldErrors.firstName}</FieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">نام خانوادگی</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={update("lastName")}
              disabled={loading}
              placeholder="مثال: احمدی"
              autoComplete="family-name"
              required
            />
            <FieldError>{fieldErrors.lastName}</FieldError>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">نام کاربری</Label>
          <Input
            id="username"
            value={form.username}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                // Only English letters and digits can be typed at all.
                username: event.target.value.replace(/[^a-zA-Z0-9]/g, ""),
              }))
            }
            disabled={loading}
            dir="ltr"
            className="text-left"
            placeholder="student1405"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
          <p className="text-xs text-muted-foreground">
            فقط حروف انگلیسی و اعداد — بین ۴ تا ۳۰ کاراکتر
          </p>
          <FieldError>{fieldErrors.username}</FieldError>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={update("password")}
                disabled={loading}
                dir="ltr"
                className="text-left pl-11"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError>{fieldErrors.password}</FieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تکرار رمز عبور</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={update("confirmPassword")}
              disabled={loading}
              dir="ltr"
              className="text-left"
              autoComplete="new-password"
              required
            />
            <FieldError>{fieldErrors.confirmPassword}</FieldError>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="space-y-1">
            {PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">
              ایمیل <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={update("email")}
              disabled={loading}
              dir="ltr"
              className="text-left"
              placeholder="you@example.com"
              autoComplete="email"
            />
            <FieldError>{fieldErrors.email}</FieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              شماره تماس{" "}
              <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={update("phone")}
              disabled={loading}
              dir="ltr"
              className="text-left"
              placeholder="09xxxxxxxxx"
              autoComplete="tel"
            />
          </div>
        </div>

        {isCounselor ? (
          <div className="space-y-2">
            <Label htmlFor="expertise">
              حوزه تخصص{" "}
              <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="expertise"
              value={form.expertise}
              onChange={update("expertise")}
              disabled={loading}
              placeholder="مثال: مشاوره تحصیلی پایه نهم"
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="studentCode">
                کد دانش‌آموزی{" "}
                <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
              </Label>
              <Input
                id="studentCode"
                value={form.studentCode}
                onChange={update("studentCode")}
                disabled={loading}
                dir="ltr"
                className="text-left"
                placeholder="در صورت خالی بودن، خودکار ساخته می‌شود"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade">پایه تحصیلی</Label>
              <select
                id="grade"
                value={form.grade}
                onChange={update("grade")}
                disabled={loading}
                className={selectClass}
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schoolYear">سال تحصیلی</Label>
              <Input
                id="schoolYear"
                value={form.schoolYear}
                onChange={update("schoolYear")}
                disabled={loading}
                dir="ltr"
                className="text-left"
                placeholder="1404-1405"
              />
            </div>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال ثبت‌نام...
            </>
          ) : isCounselor ? (
            "ارسال درخواست ثبت‌نام"
          ) : (
            "تکمیل ثبت‌نام"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          ثبت‌نام مدیر سیستم عمومی نیست؛ حساب مدیر فقط توسط مدیر فعلی سامانه ساخته می‌شود.
        </p>
      </form>
    </AuthShell>
  );
}

export { RegisterForm };
