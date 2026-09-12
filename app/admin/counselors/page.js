"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState, EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
import { COUNSELOR_APPROVAL, COUNSELOR_APPROVAL_LABELS } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { Presentation, Check, X, RefreshCw, UserCheck, Clock } from "lucide-react";

const APPROVAL_BADGE = {
  [COUNSELOR_APPROVAL.PENDING]: "secondary",
  [COUNSELOR_APPROVAL.APPROVED]: "default",
  [COUNSELOR_APPROVAL.REJECTED]: "destructive",
};

/**
 * Counselor management.
 *
 * Two jobs in one screen: the approval queue for counselors who registered
 * themselves, and the full list of counselors. Both act through
 * `PATCH /api/counselors/[id]`, which re-checks the administrator role from the
 * session on every call.
 */
export default function AdminCounselorsPage() {
  const { addToast } = useToast();

  const [counselors, setCounselors] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const [decisionTarget, setDecisionTarget] = React.useState(null);
  const [decision, setDecision] = React.useState("APPROVE");
  const [reason, setReason] = React.useState("");

  const fetchCounselors = React.useCallback(() => {
    return apiRequest("/api/counselors")
      .then((response) => {
        if (!response.ok) {
          setLoadError(response.data?.error || "دریافت فهرست مشاوران با خطا مواجه شد.");
          return;
        }
        setCounselors(response.data.counselors || []);
        setLoadError("");
      })
      .catch(() => setLoadError("دریافت فهرست مشاوران با خطا مواجه شد."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchCounselors();
  }, [fetchCounselors]);

  const { loading: deciding, run: submitDecision } = useAsyncSubmit(async () => {
    if (!decisionTarget) return;

    const response = await apiRequest(`/api/counselors/${decisionTarget.id}`, {
      method: "PATCH",
      body: { decision, reason: reason.trim() },
    });

    if (!response.ok) {
      addToast({
        title: "عملیات انجام نشد",
        description: response.data?.error || "لطفاً دوباره تلاش کنید.",
        variant: "error",
      });
      return;
    }

    addToast({
      title: decision === "APPROVE" ? "مشاور تأیید شد" : "ثبت‌نام مشاور رد شد",
      description: response.data?.message,
      variant: "success",
    });

    setDecisionTarget(null);
    setReason("");
    fetchCounselors();
  });

  const pending = counselors.filter(
    (counselor) => counselor.approvalStatus === COUNSELOR_APPROVAL.PENDING
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState description={loadError} onRetry={() => fetchCounselors()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Presentation}
        title="مشاوران"
        description="درخواست‌های ثبت‌نام مشاوران را بررسی کنید و فهرست کامل مشاوران را مدیریت کنید."
        actions={
          <Button variant="outline" onClick={() => fetchCounselors()}>
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
        }
      />

      {/* --- Approval queue --- */}
      <Card className={pending.length > 0 ? "border-amber-500/40" : undefined}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-amber-600" />
            درخواست‌های در انتظار تأیید
          </CardTitle>
          <Badge variant={pending.length > 0 ? "secondary" : "outline"}>
            {pending.length} درخواست
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={UserCheck}
              title="درخواست تأییدنشده‌ای وجود ندارد"
              description="ثبت‌نام‌های جدید مشاوران در این بخش نمایش داده می‌شود."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام و نام خانوادگی</TableHead>
                  <TableHead>نام کاربری</TableHead>
                  <TableHead>تخصص</TableHead>
                  <TableHead>تاریخ ثبت‌نام</TableHead>
                  <TableHead className="text-left">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((counselor) => (
                  <TableRow key={counselor.id}>
                    <TableCell className="font-medium">
                      {counselor.firstName} {counselor.lastName}
                    </TableCell>
                    <TableCell dir="ltr" className="text-left font-mono text-xs">
                      {counselor.username}
                    </TableCell>
                    <TableCell>{counselor.counselorProfile?.expertise || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(counselor.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setDecisionTarget(counselor);
                            setDecision("APPROVE");
                          }}
                        >
                          <Check className="h-4 w-4" />
                          تأیید
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDecisionTarget(counselor);
                            setDecision("REJECT");
                          }}
                        >
                          <X className="h-4 w-4" />
                          رد
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* --- Full list --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">فهرست مشاوران</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {counselors.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={Presentation}
              title="مشاوری ثبت نشده است"
              description="برای ایجاد مشاور از بخش کاربران استفاده کنید یا منتظر ثبت‌نام مشاوران بمانید."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>نام کاربری</TableHead>
                  <TableHead>تخصص</TableHead>
                  <TableHead>دانش‌آموزان</TableHead>
                  <TableHead>وضعیت تأیید</TableHead>
                  <TableHead>وضعیت حساب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counselors.map((counselor) => (
                  <TableRow key={counselor.id}>
                    <TableCell className="font-medium">
                      {counselor.firstName} {counselor.lastName}
                    </TableCell>
                    <TableCell dir="ltr" className="text-left font-mono text-xs">
                      {counselor.username}
                    </TableCell>
                    <TableCell>{counselor.counselorProfile?.expertise || "—"}</TableCell>
                    <TableCell>{counselor._count?.assignedStudents ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={APPROVAL_BADGE[counselor.approvalStatus] || "outline"}>
                        {COUNSELOR_APPROVAL_LABELS[counselor.approvalStatus] || "تأیید شده"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={counselor.isActive ? "default" : "destructive"}>
                        {counselor.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionTarget(null);
            setReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decision === "APPROVE" ? "تأیید حساب مشاور" : "رد ثبت‌نام مشاور"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision === "APPROVE"
                ? `با تأیید «${decisionTarget?.firstName} ${decisionTarget?.lastName}»، این مشاور می‌تواند وارد سامانه شود.`
                : `با رد «${decisionTarget?.firstName} ${decisionTarget?.lastName}»، حساب ایشان غیرفعال می‌شود و نشست‌های فعال خاتمه می‌یابد.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="decision-reason">
              علت{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (اختیاری — در لاگ فعالیت‌ها ثبت می‌شود)
              </span>
            </Label>
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={deciding}
              placeholder={
                decision === "APPROVE"
                  ? "مثال: تأیید مدارک و هماهنگی با مدرسه"
                  : "مثال: اطلاعات هویتی ناقص است"
              }
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deciding}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                submitDecision();
              }}
              disabled={deciding}
            >
              {deciding
                ? "در حال ثبت..."
                : decision === "APPROVE"
                ? "تأیید نهایی"
                : "رد نهایی"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
