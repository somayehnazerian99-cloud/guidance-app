import Link from "next/link";
import { GraduationCap, ShieldCheck, LineChart, Sparkles, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: LineChart,
    title: "تحلیل نمرات سه سال تحصیلی",
    description: "میانگین، روند پیشرفت و نقاط قوت و ضعف هر درس",
  },
  {
    icon: Sparkles,
    title: "پیشنهاد هوشمند رشته تحصیلی",
    description: "ترکیب نمرات، علایق، توانایی‌ها، آزمون‌ها و نظر والدین",
  },
  {
    icon: ShieldCheck,
    title: "دسترسی امن و نقش‌محور",
    description: "هر کاربر فقط اطلاعات مجاز خود را می‌بیند",
  },
];

/**
 * Shared shell for every unauthenticated screen (login, sign-up, password
 * recovery). Keeping the branding and spacing in one place means all of these
 * pages stay visually consistent and accessible without copy-pasting markup.
 */
export function AuthShell({ title, description, badge, children, footer, wide = false }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-100/70 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4 lg:p-8">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/60 bg-card/80 shadow-xl shadow-blue-900/5 backdrop-blur-md lg:grid-cols-2 dark:border-white/10">
          {/* Brand panel */}
          <aside className="relative hidden flex-col justify-between bg-gradient-to-bl from-primary via-blue-700 to-indigo-800 p-10 text-primary-foreground lg:flex">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_60%,white,transparent_40%)]"
            />

            <div className="relative space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <GraduationCap className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-base font-bold">سامانه هدایت تحصیلی</p>
                  <p className="text-xs text-primary-foreground/75">
                    ویژه دانش‌آموزان متوسطه اول
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-extrabold leading-relaxed">
                مسیر تحصیلی خود را
                <br />
                با اطمینان انتخاب کنید
              </h2>
              <p className="text-sm leading-7 text-primary-foreground/80">
                ثبت و تحلیل نمرات، علایق و توانایی‌ها به همراه آزمون‌های مشاوره‌ای، برای
                رسیدن به یک پیشنهاد اولیه و بررسی آن توسط مشاور.
              </p>
            </div>

            <ul className="relative mt-10 space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <feature.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{feature.title}</span>
                    <span className="block text-xs text-primary-foreground/70">
                      {feature.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="relative mt-10 text-[11px] text-primary-foreground/60">
              نتیجه این سامانه «پیشنهاد اولیه برای بررسی توسط مشاور» است، نه تصمیم قطعی.
            </p>
          </aside>

          {/* Form panel */}
          <main className="flex flex-col justify-center p-6 sm:p-10">
            <div className={`mx-auto w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
              {/* Compact brand header for small screens */}
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-bold">سامانه هدایت تحصیلی</p>
                  <p className="text-xs text-muted-foreground">متوسطه اول</p>
                </div>
              </div>

              <div className="mb-6 space-y-2">
                {badge && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {badge}
                  </span>
                )}
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && (
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                )}
              </div>

              {children}

              {footer && <div className="mt-6">{footer}</div>}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Small helper used by the auth pages for "back to login" style links.
 */
export function AuthLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      <ArrowRight className="h-4 w-4" />
      {children}
    </Link>
  );
}
