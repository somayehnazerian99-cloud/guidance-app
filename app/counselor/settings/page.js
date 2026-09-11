"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export default function CounselorSettingsPage() {
  const { addToast } = useToast();
  const [form, setForm] = React.useState({ currentPassword: "", newPassword: "" });
  const [saving, setSaving] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ title: "موفق", description: data.message, variant: "success" });
        setForm({ currentPassword: "", newPassword: "" });
      } else {
        addToast({ title: "خطا", description: data.error, variant: "error" });
      }
    } catch {
      addToast({ title: "خطا", description: "خطا در ارتباط با سرور", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات</h1>
        <p className="text-muted-foreground mt-1">امنیت حساب کاربری</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تغییر رمز عبور</CardTitle>
          <CardDescription>
            رمز عبور باید حداقل ۸ کاراکتر و شامل حروف بزرگ، کوچک و عدد باشد.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">رمز عبور جدید</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                dir="ltr"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
