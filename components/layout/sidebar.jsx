"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Settings,
  FileText,
  Video,
  Shield,
  School,
  ClipboardList,
  BarChart3,
  Star,
  Brain,
  MessageSquare,
  Bell,
  User,
  ChevronLeft,
  X,
  LifeBuoy,
} from "lucide-react";

const adminMenuItems = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/admin/students", label: "دانش‌آموزان", icon: GraduationCap },
  { href: "/admin/counselors", label: "مشاوران", icon: User },
  { href: "/admin/support", label: "پشتیبانی", icon: LifeBuoy },
  { href: "/admin/schools", label: "مدارس", icon: School },
  { href: "/admin/classes", label: "کلاس‌ها", icon: BookOpen },
  { href: "/admin/tests", label: "آزمون‌ها", icon: ClipboardList },
  { href: "/admin/grades", label: "نمرات", icon: BarChart3 },
  { href: "/admin/interests", label: "علایق", icon: Star },
  { href: "/admin/abilities", label: "توانایی‌ها", icon: Brain },
  { href: "/admin/parent-opinions", label: "نظر والدین", icon: MessageSquare },
  { href: "/admin/videos", label: "ویدئوها", icon: Video },
  { href: "/admin/reports", label: "گزارش‌ها", icon: FileText },
  { href: "/admin/settings", label: "تنظیمات", icon: Settings },
  { href: "/admin/security-logs", label: "لاگ فعالیت‌ها", icon: Shield },
];

const counselorMenuItems = [
  { href: "/counselor", label: "داشبورد", icon: LayoutDashboard },
  { href: "/counselor/students", label: "دانش‌آموزان من", icon: GraduationCap },
  { href: "/counselor/tests", label: "آزمون‌ها", icon: ClipboardList },
  { href: "/counselor/grades", label: "نمرات", icon: BarChart3 },
  { href: "/counselor/reports", label: "گزارش‌ها", icon: FileText },
  { href: "/counselor/support", label: "پشتیبانی", icon: LifeBuoy },
];

const studentMenuItems = [
  { href: "/student", label: "داشبورد", icon: LayoutDashboard },
  { href: "/student/profile", label: "پروفایل من", icon: User },
  { href: "/student/grades", label: "نمرات من", icon: BarChart3 },
  { href: "/student/tests", label: "آزمون‌ها", icon: ClipboardList },
  { href: "/student/interests", label: "علایق من", icon: Star },
  { href: "/student/abilities", label: "توانایی‌های من", icon: Brain },
  { href: "/student/parent-opinion", label: "نظر والدین", icon: MessageSquare },
  { href: "/student/guidance", label: "نتیجه هدایت", icon: FileText },
  { href: "/student/videos", label: "ویدئوهای آموزشی", icon: Video },
  { href: "/student/notifications", label: "اعلان‌ها", icon: Bell },
  { href: "/student/support", label: "پشتیبانی", icon: LifeBuoy },
  { href: "/student/settings", label: "تنظیمات", icon: Settings },
];

function Sidebar({ role, isOpen, onClose }) {
  const pathname = usePathname();

  const menuItems =
    role === "ADMIN"
      ? adminMenuItems
      : role === "COUNSELOR"
      ? counselorMenuItems
      : studentMenuItems;

  const roleLabels = {
    ADMIN: "پنل مدیریت",
    COUNSELOR: "پنل مشاور",
    STUDENT: "پنل دانش‌آموز",
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-64 bg-card border-l border-border transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-primary">{roleLabels[role]}</h2>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const isActive =
              item.href === `/admin` || item.href === `/counselor` || item.href === `/student`
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export { Sidebar, adminMenuItems, counselorMenuItems, studentMenuItems };
