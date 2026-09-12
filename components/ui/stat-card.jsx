import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

const TONES = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

/**
 * A single headline figure on a dashboard.
 * `href` makes the whole card a link to the section that owns the number.
 */
function StatCard({ title, value, hint, icon: Icon, tone = "primary", href }) {
  const body = (
    <CardContent className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            TONES[tone] || TONES.primary
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
    </CardContent>
  );

  if (!href) return <Card>{body}</Card>;

  return (
    <Link
      href={href}
      className="group block rounded-xl transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-md"
    >
      <Card className="transition-colors group-hover:border-primary/40">
        {body}
        <span className="sr-only">
          مشاهده جزئیات
          <ArrowUpRight className="ml-1 inline h-4 w-4" />
        </span>
      </Card>
    </Link>
  );
}

export { StatCard };
