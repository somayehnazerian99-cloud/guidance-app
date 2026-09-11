import "./globals.css";
import { Vazirmatn } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "هدایت تحصیلی | سیستم هدایت تحصیلی دانش‌آموزان متوسطه اول",
    template: "%s | هدایت تحصیلی",
  },
  description:
    "سیستم جامع هدایت تحصیلی دانش‌آموزان متوسطه اول - ثبت نمرات، علایق، توانایی‌ها و دریافت پیشنهاد هدایت تحصیلی",
  keywords: ["هدایت تحصیلی", "متوسطه اول", "مشاوره", "آموزش", "دانش‌آموز"],
  applicationName: "هدایت تحصیلی",
  authors: [{ name: "سیستم هدایت تحصیلی" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: appUrl,
    siteName: "سیستم هدایت تحصیلی",
    title: "سیستم هدایت تحصیلی دانش‌آموزان متوسطه اول",
    description:
      "ثبت نمرات، علایق و توانایی‌ها و دریافت پیشنهاد هدایت تحصیلی برای دانش‌آموزان پایه هفتم تا نهم",
  },
  twitter: {
    card: "summary_large_image",
    title: "سیستم هدایت تحصیلی دانش‌آموزان متوسطه اول",
    description:
      "ثبت نمرات، علایق و توانایی‌ها و دریافت پیشنهاد هدایت تحصیلی برای دانش‌آموزان پایه هفتم تا نهم",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    shortcut: "/favicon.ico",
  },
  // Private panels must never be indexed. Individual public pages opt back in
  // (see app/page.js).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="Referrer-Policy" content="strict-origin-when-cross-origin" />
        <meta name="theme-color" content="#1e40af" />
      </head>
      <body className="min-h-screen font-[var(--font-vazirmatn)] antialiased" style={{ fontFamily: "var(--font-vazirmatn)" }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
