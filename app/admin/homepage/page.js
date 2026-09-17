"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Image, Link2, Video, Plus, Trash2, ExternalLink, Home } from "lucide-react";

const initialForm = { title: "", description: "", type: "LINK", url: "", thumbnail: "" };

export default function AdminHomepagePage() {
  const { addToast } = useToast();
  const [items, setItems] = React.useState([]);
  const [form, setForm] = React.useState(initialForm);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const loadItems = React.useCallback(async () => {
    try {
      const response = await fetch("/api/homepage-content", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(data.items || []);
    } catch {
      addToast({ title: "خطا", description: "دریافت محتوای صفحه اصلی انجام نشد.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/homepage-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا در ذخیره محتوا");
      setItems((current) => [...current, data.item]);
      setForm(initialForm);
      addToast({ title: "ذخیره شد", description: "محتوا به صفحه اصلی اضافه شد.", variant: "success" });
    } catch (error) {
      addToast({ title: "خطا", description: error.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("این محتوا از صفحه اصلی حذف شود؟")) return;
    try {
      const response = await fetch(`/api/homepage-content?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((item) => item.id !== id));
      addToast({ title: "حذف شد", description: "محتوا از صفحه اصلی حذف شد.", variant: "success" });
    } catch {
      addToast({ title: "خطا", description: "حذف محتوا انجام نشد.", variant: "error" });
    }
  };

  const typeLabel = { LINK: "لینک", IMAGE: "تصویر", VIDEO: "ویدیو" };
  const typeIcon = { LINK: Link2, IMAGE: Image, VIDEO: Video };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Home}
        title="مدیریت صفحه اصلی"
        description="محتوای قابل نمایش در صفحه اصلی را از اینجا مدیریت کنید."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" /> افزودن محتوای جدید
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>نوع محتوا</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="LINK">🔗 لینک</option>
                <option value="IMAGE">🖼️ تصویر</option>
                <option value="VIDEO">🎬 ویدیو</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>آدرس محتوا</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
                dir="ltr"
                required
              />
              <p className="text-xs text-muted-foreground">برای تصویر، لینک مستقیم فایل تصویر؛ برای ویدیو، لینک مستقیم فایل ویدیو را وارد کنید.</p>
            </div>
            {form.type !== "LINK" && (
              <div className="space-y-2 md:col-span-2">
                <Label>لینک تصویر بندانگشتی (اختیاری)</Label>
                <Input
                  value={form.thumbnail}
                  onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>
            )}
            <div className="space-y-2 md:col-span-2">
              <Label>توضیحات (اختیاری)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "در حال ذخیره..." : "افزودن به صفحه اصلی"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">محتوای فعلی صفحه اصلی</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">در حال دریافت...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز محتوای مدیریتی اضافه نشده است.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = typeIcon[item.category === "HOMEPAGE" ? (item.thumbnail && item.videoUrl === item.thumbnail ? "IMAGE" : item.videoUrl.endsWith(".mp4") ? "VIDEO" : "LINK") : "LINK"] || Link2;
                const inferredType = item.thumbnail && item.videoUrl === item.thumbnail ? "IMAGE" : item.videoUrl.match(/\.mp4($|\?)/i) ? "VIDEO" : "LINK";
                const TypeIcon = typeIcon[inferredType] || Icon;
                return (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <TypeIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{item.title}</h3>
                          <Badge variant="secondary">{typeLabel[inferredType]}</Badge>
                        </div>
                        {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                        <a href={item.videoUrl} target="_blank" rel="noreferrer" dir="ltr" className="mt-1 block truncate text-xs text-primary hover:underline">
                          {item.videoUrl}
                        </a>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={item.videoUrl} target="_blank" rel="noreferrer"><ExternalLink className="ml-1 h-4 w-4" />مشاهده</a>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => remove(item.id)}>
                        <Trash2 className="ml-1 h-4 w-4" />حذف
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
