"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { apiRequest } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { ShieldCheck, Search, RefreshCw, ChevronRight, ChevronLeft, Globe } from "lucide-react";

const TONE_VARIANTS = {
  success: "default",
  warning: "secondary",
  danger: "destructive",
  info: "outline",
  neutral: "secondary",
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Audit trail (لاگ فعالیت‌ها).
 *
 * The API already renders each row as a Persian sentence, so this page only
 * lays them out. Every value shown comes from the server; the client never
 * decides what happened.
 */
export default function AdminAuditLogPage() {
  const [logs, setLogs] = React.useState([]);
  const [actions, setActions] = React.useState([]);
  const [pagination, setPagination] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = React.useState({ action: "", search: "" });
  const [appliedFilters, setAppliedFilters] = React.useState({ action: "", search: "" });
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const fetchLogs = React.useCallback(
    (currentPage = page, currentFilters = appliedFilters) => {
      const params = new URLSearchParams({ page: String(currentPage), limit: "20" });
      if (currentFilters.action) params.set("action", currentFilters.action);
      if (currentFilters.search) params.set("search", currentFilters.search);

      return apiRequest(`/api/audit-logs?${params}`)
        .then((response) => {
          if (!response.ok) {
            setLoadError(response.data?.error || "دریافت لاگ فعالیت‌ها با خطا مواجه شد.");
            return;
          }
          setLogs(response.data.logs || []);
          setActions(response.data.actions || []);
          setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
          setLoadError("");
        })
        .catch(() => setLoadError("دریافت لاگ فعالیت‌ها با خطا مواجه شد."))
        .finally(() => setLoading(false));
    },
    [page, appliedFilters]
  );

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const applyFilters = (event) => {
    event.preventDefault();
    const next = { ...filters };
    setAppliedFilters(next);
    setPage(1);
    setLoading(true);
    fetchLogs(1, next);
  };

  const resetFilters = () => {
    const cleared = { action: "", search: "" };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
    setLoading(true);
    fetchLogs(1, cleared);
  };

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages) return;
    setPage(nextPage);
    setLoading(true);
    fetchLogs(nextPage, appliedFilters);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="لاگ فعالیت‌ها و رویدادهای امنیتی"
        description="تمام عملیات مهم سامانه به‌همراه کاربر، زمان و نشانی شبکه ثبت می‌شود."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              fetchLogs();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <form onSubmit={applyFilters} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="audit-search">جست‌وجو</Label>
              <Input
                id="audit-search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, search: event.target.value }))
                }
                placeholder="نام کاربر، نام کاربری یا متن رویداد"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-action">نوع رویداد</Label>
              <select
                id="audit-action"
                className={selectClass}
                value={filters.action}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, action: event.target.value }))
                }
              >
                <option value="">همه رویدادها</option>
                {actions.map((entry) => (
                  <option key={entry.action} value={entry.action}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="flex-1">
                <Search className="h-4 w-4" />
                اعمال فیلتر
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters}>
                حذف فیلتر
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState rows={6} />
      ) : loadError ? (
        <ErrorState description={loadError} onRetry={() => fetchLogs()} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="رویدادی با این فیلتر یافت نشد"
          description="با تغییر نوع رویداد یا حذف فیلترها، نتایج بیشتری خواهید دید."
        />
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TONE_VARIANTS[log.tone] || "secondary"}>
                        {log.actionLabel}
                      </Badge>
                      <p className="text-sm leading-6">{log.sentence}</p>
                    </div>
                    {log.ipAddress && log.ipAddress !== "unknown" && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        نشانی شبکه: <span dir="ltr">{log.ipAddress}</span>
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              مجموع {pagination.total} رویداد — صفحه {pagination.page} از {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                <ChevronRight className="h-4 w-4" />
                قبلی
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= pagination.totalPages}
              >
                بعدی
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
