import Link from "next/link";
import { GraduationCap, Presentation } from "lucide-react";

export const metadata = {
  title: "سیستم هدایت تحصیلی",
  description: "سیستم جامع هدایت تحصیلی دانش‌آموزان متوسطه اول",
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground text-3xl font-bold">🎓</span>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            سیستم هدایت تحصیلی
          </h1>
          <p className="text-muted-foreground text-lg">
            سیستم جامع هدایت تحصیلی دانش‌آموزان متوسطه اول
          </p>
        </div>

        {/* Login Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Admin */}
          <Link href="/login/admin" className="group">
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                <span className="text-2xl">🛡️</span>
              </div>
              <h3 className="font-semibold text-lg mb-1">مدیریت</h3>
              <p className="text-sm text-muted-foreground">ورود مدیر سیستم</p>
            </div>
          </Link>

          {/* Counselor */}
          <Link href="/login/counselor" className="group">
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
              <div className="mx-auto h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <span className="text-2xl">👨‍🏫</span>
              </div>
              <h3 className="font-semibold text-lg mb-1">مشاوره</h3>
              <p className="text-sm text-muted-foreground">ورود مشاور</p>
            </div>
          </Link>

          {/* Student */}
          <Link href="/login/student" className="group">
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
              <div className="mx-auto h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="font-semibold text-lg mb-1">دانش‌آموز</h3>
              <p className="text-sm text-muted-foreground">ورود دانش‌آموز</p>
            </div>
          </Link>
        </div>

        {/* Sign-up call to action */}
        <div className="rounded-2xl border bg-card/70 p-6 shadow-sm backdrop-blur">
          <h2 className="text-center text-lg font-semibold">حساب کاربری ندارید؟</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            دانش‌آموزان می‌توانند بلافاصله ثبت‌نام کنند؛ ثبت‌نام مشاوران پس از تأیید مدیر سیستم
            فعال می‌شود.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/register/student"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <GraduationCap className="h-4 w-4" />
              ثبت‌نام دانش‌آموز
            </Link>
            <Link
              href="/register/counselor"
              className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <Presentation className="h-4 w-4" />
              ثبت‌نام مشاور
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            ثبت‌نام مدیر سیستم به‌صورت عمومی امکان‌پذیر نیست. رمز عبور خود را فراموش کرده‌اید؟{" "}
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              بازیابی رمز عبور
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} سیستم هدایت تحصیلی - تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  );
}
