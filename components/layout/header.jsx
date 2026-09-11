"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, LogOut, User, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Header({ user, onMenuToggle }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  const roleLabels = {
    ADMIN: "مدیر سیستم",
    COUNSELOR: "مشاور",
    STUDENT: "دانش‌آموز",
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-md hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted transition-colors">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[user?.role]}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`/${user?.role?.toLowerCase()}/settings`}>
              <User className="ml-2 h-4 w-4" />
              <span>تنظیمات</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="ml-2 h-4 w-4" />
            <span>{loggingOut ? "در حال خروج..." : "خروج"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export { Header };
