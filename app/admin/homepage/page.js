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
import { Home, ImageIcon, Music2, Video, Upload, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";

const TYPES = {
  IMAGE: { label: "عکس", icon: ImageIcon, accept: "image/*" },
  AUDIO: { label: "صوت", icon: Music2, accept: "audio/*" },
  VIDEO: { label: "ویدیو", icon: Video, accept: "video/*" },
};

const initialForm = { title: "", description: "", type: "IMAGE" };

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}

export default function AdminHomepagePage() {
  const { addToast } = useToast();
  const [items, setItems] = React.useState([]);
  const [form, setForm] = React.useState(initialForm);
  const [file, setFile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const loadItems = React.useCallback(async () => {
    try {
      const response = await fetch("/api/admin/home-media", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "خطا");
      setItems(data.items || []);
    } catch (error) {
      addToast({ title: "خطا", description: error.message || "دریافت فایل‌ها انجام نشد.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => { loadItems(); }, [loadItems]);

  const save = async (event) => {
    event.preventDefault();
    if (!file) {
      addToast({ title: "فایل انتخاب نشده", description: "یک عکس، صوت یا ویدیو انتخاب کنید.", variant: "error" });
      return;
    }
    setSaving(true);
    setProgress(5);
    try {
      const signResponse = await fetch("/api/admin/home-media/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type }),
      });
      const signData = await signResponse.json();
      if (!signResponse.ok) throw new Error(signData.error || "آماده‌سازی آپلود انجام نشد.");
      setProgress(15);

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("api_key", signData.apiKey);
      uploadData.append("timestamp", String(signData.timestamp));
      uploadData.append("folder", signData.folder);
      uploadData.append("signature", signData.signature);

      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/${signData.resourceType}/upload`, { method: "POST", body: uploadData });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploaded.error?.message || "آپلود فایل انجام نشد.");
      setProgress(80);

      const saveResponse = await fetch("/api/admin/home-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, description: form.description, type: form.type, url: uploaded.secure_url, publicId: uploaded.public_id, resourceType: signData.resourceType, mimeType: file.type, bytes: file.size }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error || "ثبت فایل انجام نشد.");

      setItems((current) => [...current, saved.item]);
      setForm(initialForm);
      setFile(null);
      const input = document.getElementById("homepage-media-file");
      if (input) input.value = "";
      setProgress(100);
      addToast({ title: "آپلود شد", description: "فایل با موفقیت در صفحه اصلی منتشر شد.", variant: "success" });
    } catch (error) {
      addToast({ title: "خطا", description: error.message || "آپلود انجام نشد.", variant: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setProgress(0), 700);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("این فایل از صفحه اصلی و فضای ذخیره‌سازی حذف شود؟")) return;
    try {
      const response = await fetch(`/api/admin/home-media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "حذف انجام نشد.");
      setItems((current) => current.filter((item) => item.id !== id));
      addToast({ title: "حذف شد", description: "فایل از صفحه اصلی و فضای ذخیره‌سازی حذف شد.", variant: "success" });
    } catch (error) {
      addToast({ title: "خطا", description: error.message, variant: "error" });
    }
  };

  const toggleActive = async (item) => {
    try {
      const response = await fetch("/api/admin/home-media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, isActive: !item.isActive }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تغییر وضعیت انجام نشد.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data.item : entry));
    } catch (error) {
      addToast({ title: "خطا", description: error.message, variant: "error" });
    }
  };

  const typeInfo = TYPES[form.type];
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-6">
      <PageHeader icon={Home} title="مدیریت فایل‌های صفحه اصلی" description="عکس، صوت و ویدیو را مستقیماً از کامپیوتر یا گوشی آپلود، فعال یا حذف کنید." />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" />افزودن فایل جدید</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>عنوان</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً معرفی سامانه" required /></div>
            <div className="space-y-2"><Label>نوع فایل</Label><select value={form.type} onChange={(e) => { setForm({ ...form, type: e.target.value }); setFile(null); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="IMAGE">🖼️ عکس</option><option value="AUDIO">🎵 صوت</option><option value="VIDEO">🎬 ویدیو</option></select></div>
            <div className="space-y-2 md:col-span-2"><Label>انتخاب فایل از کامپیوتر یا گوشی</Label><Input id="homepage-media-file" type="file" accept={typeInfo.accept} onChange={(e) => setFile(e.target.files?.[0] || null)} required /><p className="text-xs text-muted-foreground">{file ? `${file.name} — ${formatBytes(file.size)}` : `فقط ${typeInfo.label} انتخاب کنید.`}</p></div>
            <div className="space-y-2 md:col-span-2"><Label>توضیحات (اختیاری)</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیح کوتاه برای نمایش در صفحه اصلی" /></div>
            {progress > 0 && <div className="space-y-2 md:col-span-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs text-muted-foreground">{progress < 80 ? "در حال آپلود فایل..." : "در حال ثبت فایل..."}</p></div>}
            <div className="md:col-span-2"><Button type="submit" disabled={saving || !file}><TypeIcon className="ml-2 h-4 w-4" />{saving ? "در حال آپلود..." : "آپلود و انتشار در صفحه اصلی"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">فایل‌های صفحه اصلی</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">در حال دریافت...</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">هنوز فایلی آپلود نشده است.</p> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => {
                const info = TYPES[item.type] || TYPES.IMAGE;
                const Icon = info.icon;
                return <article key={item.id} className={`overflow-hidden rounded-2xl border ${item.isActive ? "bg-card" : "bg-muted/30 opacity-70"}`}>
                  <div className="flex min-h-32 items-center justify-center bg-muted/30 p-3">
                    {item.type === "IMAGE" && <img src={item.url} alt={item.title} className="max-h-56 w-full rounded-xl object-contain" />}
                    {item.type === "VIDEO" && <video src={item.url} controls playsInline preload="metadata" className="max-h-56 w-full rounded-xl bg-black object-contain" />}
                    {item.type === "AUDIO" && <div className="w-full rounded-xl border bg-background p-5"><div className="mb-3 flex items-center gap-3"><Icon className="h-8 w-8 text-primary" /><span className="font-semibold">{item.title}</span></div><audio src={item.url} controls className="w-full" /></div>}
                  </div>
                  <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.title}</h3>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}</div><Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "نمایش" : "مخفی"}</Badge></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => toggleActive(item)}>{item.isActive ? <EyeOff className="ml-1 h-4 w-4" /> : <Eye className="ml-1 h-4 w-4" />}{item.isActive ? "مخفی کردن" : "نمایش دادن"}</Button><Button variant="destructive" size="sm" onClick={() => remove(item.id)}><Trash2 className="ml-1 h-4 w-4" />حذف کامل</Button><span className="mr-auto flex items-center gap-1 text-xs text-muted-foreground"><GripVertical className="h-4 w-4" /> ترتیب {item.sortOrder + 1}</span></div></div>
                </article>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
