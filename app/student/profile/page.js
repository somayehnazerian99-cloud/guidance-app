"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const GRADE_LABELS = { 7: "پایه هفتم", 8: "پایه هشتم", 9: "پایه نهم" };

function Field({ label, value, ltr }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function StudentProfilePage() {
  const [student, setStudent] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/students?limit=1");
        if (!res.ok) {
          setError("خطا در دریافت اطلاعات پروفایل");
          return;
        }
        const data = await res.json();
        setStudent(data.students?.[0] || null);
      } catch {
        setError("خطا در ارتباط با سرور");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">پروفایل من</h1>
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">پروفایل من</h1>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            پروفایل دانش‌آموزی برای حساب شما ثبت نشده است. لطفاً با مشاور یا مدیر مدرسه تماس بگیرید.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">پروفایل من</h1>
        <p className="text-muted-foreground mt-1">اطلاعات تحصیلی ثبت‌شده برای شما</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {student.user?.firstName} {student.user?.lastName}
              </CardTitle>
              <CardDescription dir="ltr">{student.studentCode}</CardDescription>
            </div>
            <Badge variant={student.profileComplete ? "default" : "secondary"}>
              {student.profileComplete ? "پرونده کامل" : "پرونده ناقص"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y">
          <Field label="کد دانش‌آموزی" value={student.studentCode} ltr />
          <Field label="پایه" value={GRADE_LABELS[student.grade] || student.grade} />
          <Field label="مدرسه" value={student.school?.name} />
          <Field label="کلاس" value={student.class?.name} />
          <Field label="سال تحصیلی" value={student.schoolYear} ltr />
          <Field
            label="مشاور"
            value={
              student.counselor
                ? `${student.counselor.firstName} ${student.counselor.lastName}`
                : "تعیین نشده"
            }
          />
          <Separator />
          <Field label="تلفن دانش‌آموز" value={student.phone} ltr />
          <Field label="تلفن والدین" value={student.parentPhone} ltr />
          <Field label="نشانی" value={student.address} />
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-4 text-sm text-blue-900 dark:text-blue-100">
          برای اصلاح اطلاعات پروفایل با مشاور خود تماس بگیرید؛ تغییر این اطلاعات از سمت شما ممکن نیست.
        </CardContent>
      </Card>
    </div>
  );
}
