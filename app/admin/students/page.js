"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import Link from "next/link";

export default function AdminStudentsPage() {
  const { addToast } = useToast();
  const [students, setStudents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({});
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName: "", lastName: "", studentCode: "", grade: "7", schoolYear: "1402-1403",
    phone: "", parentPhone: "",
  });

  // Every state update happens inside a promise continuation, so the mount
  // effect never sets state synchronously (which would cascade renders).
  const fetchStudents = React.useCallback(() => {
    const params = new URLSearchParams({ page, limit: 10, search });

    return fetch(`/api/students?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setStudents(data.students);
        setPagination(data.pagination);
        setLoadError("");
      })
      .catch(() => setLoadError("خطا در دریافت لیست دانش‌آموزان"))
      .finally(() => setLoading(false));
  }, [page, search]);

  React.useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, grade: Number(form.grade) }),
      });
      if (res.ok) {
        const data = await res.json();
        addToast({
          title: "موفق",
          description: `دانش‌آموز ایجاد شد. نام کاربری: ${data.initialCredentials?.username} — رمز عبور اولیه (فقط همین یک بار نمایش داده می‌شود): ${data.initialCredentials?.password}`,
          variant: "success",
          duration: 15000,
        });
        setDialogOpen(false);
        fetchStudents();
      } else {
        const data = await res.json();
        addToast({ title: "خطا", description: data.error, variant: "error" });
      }
    } catch {
      addToast({ title: "خطا", description: "خطا در ایجاد دانش‌آموز", variant: "error" });
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ title: "موفق", description: "دانش‌آموز حذف شد", variant: "success" });
        fetchStudents();
      }
    } catch {
      addToast({ title: "خطا", description: "خطا در حذف", variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مدیریت دانش‌آموزان</h1>
          <p className="text-muted-foreground mt-1">ایجاد و مدیریت پروفایل دانش‌آموزان</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({
              firstName: "", lastName: "", studentCode: "", grade: "7", schoolYear: "1402-1403",
              phone: "", parentPhone: "",
            })}>
              <Plus className="ml-2 h-4 w-4" />
              دانش‌آموز جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ایجاد دانش‌آموز جدید</DialogTitle>
              <DialogDescription>اطلاعات دانش‌آموز جدید را وارد کنید</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نام</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>نام خانوادگی</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>کد دانش‌آموزی</Label>
                  <Input value={form.studentCode} onChange={(e) => setForm({ ...form, studentCode: e.target.value })} dir="ltr" required />
                </div>
                <div className="space-y-2">
                  <Label>پایه</Label>
                  <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="7">هفتم</option>
                    <option value="8">هشتم</option>
                    <option value="9">نهم</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>سال تحصیلی</Label>
                <Input value={form.schoolYear} onChange={(e) => setForm({ ...form, schoolYear: e.target.value })} dir="ltr" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تلفن</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>تلفن والدین</Label>
                  <Input value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} dir="ltr" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
                <Button type="submit">ایجاد</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="جستجو..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loadError ? (
            <div className="p-8 text-center text-sm text-destructive">{loadError}</div>
          ) : loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">دانش‌آموزی یافت نشد</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>کد دانش‌آموزی</TableHead>
                  <TableHead>پایه</TableHead>
                  <TableHead>سال تحصیلی</TableHead>
                  <TableHead>مشاور</TableHead>
                  <TableHead className="text-center">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.user?.firstName} {s.user?.lastName}</TableCell>
                    <TableCell dir="ltr">{s.studentCode}</TableCell>
                    <TableCell>{["", "", "", "هفتم", "هشتم", "نهم"][s.grade] || s.grade}</TableCell>
                    <TableCell dir="ltr">{s.schoolYear}</TableCell>
                    <TableCell>{s.counselor ? `${s.counselor.firstName} ${s.counselor.lastName}` : "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/students/${s.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف دانش‌آموز</AlertDialogTitle>
                              <AlertDialogDescription>آیا از حذف این دانش‌آموز اطمینان دارید؟</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>انصراف</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</Button>
          <span className="text-sm text-muted-foreground">صفحه {page} از {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>بعدی</Button>
        </div>
      )}
    </div>
  );
}
