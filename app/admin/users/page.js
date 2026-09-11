"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Plus, Search, Edit, Trash2, Key } from "lucide-react";

export default function AdminUsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({});
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState(null);
  const [form, setForm] = React.useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "STUDENT",
  });

  // Every state update happens inside a promise continuation, so the mount
  // effect never sets state synchronously (which would cascade renders).
  const fetchUsers = React.useCallback(() => {
    const params = new URLSearchParams({ page, limit: 10, search });

    return fetch(`/api/users?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setUsers(data.users);
        setPagination(data.pagination);
        setLoadError("");
      })
      .catch(() => setLoadError("خطا در دریافت لیست کاربران"))
      .finally(() => setLoading(false));
  }, [page, search]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const body = { ...form };
      if (editingUser && !body.password) delete body.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast({
          title: "موفق",
          description: editingUser ? "کاربر ویرایش شد" : "کاربر ایجاد شد",
          variant: "success",
        });
        setDialogOpen(false);
        setEditingUser(null);
        setForm({ username: "", password: "", firstName: "", lastName: "", email: "", role: "STUDENT" });
        fetchUsers();
      } else {
        const data = await res.json();
        addToast({ title: "خطا", description: data.error || "خطا در عملیات", variant: "error" });
      }
    } catch {
      addToast({ title: "خطا", description: "خطا در ارتباط با سرور", variant: "error" });
    }
  };

  const handleDelete = async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ title: "موفق", description: "کاربر حذف شد", variant: "success" });
        fetchUsers();
      } else {
        const data = await res.json();
        addToast({ title: "خطا", description: data.error, variant: "error" });
      }
    } catch {
      addToast({ title: "خطا", description: "خطا در حذف کاربر", variant: "error" });
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email || "",
      role: user.role,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm({ username: "", password: "", firstName: "", lastName: "", email: "", role: "STUDENT" });
    setDialogOpen(true);
  };

  const roleLabels = { ADMIN: "مدیر", COUNSELOR: "مشاور", STUDENT: "دانش‌آموز" };
  const roleColors = { ADMIN: "destructive", COUNSELOR: "secondary", STUDENT: "success" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
          <p className="text-muted-foreground mt-1">ایجاد، ویرایش و حذف کاربران</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="ml-2 h-4 w-4" />
              کاربر جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "ویرایش کاربر" : "ایجاد کاربر جدید"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "اطلاعات کاربر را ویرایش کنید" : "اطلاعات کاربر جدید را وارد کنید"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">نام</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">نام خانوادگی</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editingUser}
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser ? "رمز عبور جدید (اختیاری)" : "رمز عبور"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingUser}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">ایمیل</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">نقش</Label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ADMIN">مدیر</option>
                  <option value="COUNSELOR">مشاور</option>
                  <option value="STUDENT">دانش‌آموز</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit">{editingUser ? "ذخیره" : "ایجاد"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="جستجو در نام کاربری، نام..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loadError ? (
            <div className="p-8 text-center text-sm text-destructive">{loadError}</div>
          ) : loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              کاربری یافت نشد
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>نام کاربری</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ ایجاد</TableHead>
                  <TableHead className="text-center">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell dir="ltr" className="text-left">{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[user.role]}>{roleLabels[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "success" : "destructive"}>
                        {user.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString("fa-IR")}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>آیا از حذف این کاربر اطمینان دارید؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                این عمل قابل بازگشت نیست. تمام اطلاعات مرتبط با این کاربر حذف خواهد شد.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>انصراف</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive text-destructive-foreground">
                                حذف
                              </AlertDialogAction>
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            قبلی
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحه {page} از {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
    </div>
  );
}
