import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { GraduationCap, Presentation, ShieldAlert, ArrowRight } from "lucide-react";

export const metadata = {
  title: "ثبت‌نام",
  description: "ثبت‌نام دانش‌آموز و مشاور در سامانه هدایت تحصیلی متوسطه اول",
  robots: { index: false, follow: false },
};

const OPTIONS = [
  {
    href: "/register/student",
    icon: GraduationCap,
    title: "ثبت‌نام دانش‌آموز",
    description:
      "نام کاربری و رمز عبور خود را می‌سازید و بلافاصله می‌توانید وارد سامانه شوید و نمرات، علایق و توانایی‌های خود را ثبت کنید.",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    href: "/register/counselor",
    icon: Presentation,
    title: "ثبت‌نام مشاور",
    description:
      "پس از ثبت‌نام، حساب شما در وضعیت «در انتظار تأیید مدیر» قرار می‌گیرد و بعد از تأیید می‌توانید وارد پنل مشاور شوید.",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
];

export default function RegisterChoicePage() {
  return (
    <AuthShell
      badge="ثبت‌نام"
      title="چه نوع حسابی می‌خواهید بسازید؟"
      description="ثبت‌نام مدیر سیستم به‌صورت عمومی امکان‌پذیر نیست و فقط توسط مدیر فعلی سامانه انجام می‌شود."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          حساب کاربری دارید؟{" "}
          <Link href="/" className="font-medium text-primary hover:underline">
            صفحه ورود
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        {OPTIONS.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${option.accent}`}
            >
              <option.icon className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {option.title}
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                {option.description}
              </span>
            </span>
          </Link>
        ))}

        <div className="flex items-start gap-3 rounded-2xl border border-dashed bg-muted/40 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-6 text-muted-foreground">
            حساب مدیر سیستم جهت حفظ امنیت سامانه از طریق ثبت‌نام عمومی ساخته نمی‌شود. برای
            ایجاد حساب مدیر با مدیر فعلی سامانه تماس بگیرید.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
