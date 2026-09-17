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
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
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

/**
 * Turn a failed save into something the administrator can act on.
 *
 * When the storage asset had to be removed because the record could not be
 * written, the server reports `cleanup: "deleted"` — saying so stops the admin
 * from wondering whether a broken file is now publicly visible.
 */
function saveFailureMessage(data) {
  const base = data?.error || "ثبت فایل انجام نشد.";
  if (data?.cleanup === "deleted") {
    return `${base} فایل نیمه‌کاره از فضای ذخیره‌سازی پاک شد؛ لطفاً دوباره تلاش کنید.`;
  }
  if (data?.cleanup === "delete-failed" || data?.cleanup === "not-configured") {
    return `${base} توجه: فایل در فضای ذخیره‌سازی باقی مانده است.`;
  }
  return base;
}

export default function AdminHomepagePage() {
  const { addToast } = useToast();
  const [items, setItems] = React.useState([]);
  const [form, setForm] = React.useState(initialForm);
  const [file, setFile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const [busyId, setBusyId] = React.useState(null);

  // A plain (non-async) callback returning a promise chain: the other admin
  // screens use the same shape, and it keeps the effect free of synchronous
  // setState calls.
  const loadItems = React.useCallback(
    () =>
      apiRequest("/api/admin/home-media")
        .then((response) => {
          if (!response.ok) {
            setLoadError(response.data?.error || "دریافت فایل‌های صفحه اصلی با خطا مواجه شد.");
            return;
          }
          setItems(response.data?.items || []);
          setLoadError("");
        })
        .catch(() => setLoadError("دریافت فایل‌های صفحه اصلی با خطا مواجه شد."))
        .finally(() => setLoading(false)),
    []
  );

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

  const upload = useAsyncSubmit(async () => {
    if (!file) {
      addToast({ title: "فایل انتخاب نشده", description: "یک عکس، صوت یا ویدیو انتخاب کنید.", variant: "error" });
      return;
    }

    setProgress(5);

    // 1) Ask the server for a short-lived signature. The Cloudinary secret never
    //    leaves the server.
    const signResponse = await apiRequest("/api/admin/home-media/sign", {
      method: "POST",
      body: { type: form.type },
    });
    if (!signResponse.ok) {
      throw new Error(signResponse.data?.error || "آماده‌سازی آپلود انجام نشد.");
    }

    const signData = signResponse.data;
    setProgress(15);

    // 2) Upload straight to Cloudinary from the browser, so a large file never
    //    has to pass through the serverless function body limit.
    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("api_key", signData.apiKey);
    uploadData.append("timestamp", String(signData.timestamp));
    uploadData.append("folder", signData.folder);
    uploadData.append("signature", signData.signature);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${signData.cloudName}/${signData.resourceType}/upload`,
      { method: "POST", body: uploadData }
    );
    const uploaded = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) {
      throw new Error(uploaded?.error?.message || "آپلود فایل انجام نشد.");
    }
    setProgress(80);

    // 3) Persist the metadata. The upload is deliberately *not* deduplicated:
    //    each attempt produces a distinct Cloudinary asset, so two concurrent
    //    saves must not be merged.
    const saveResponse = await fetch("/api/admin/home-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        type: form.type,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        resourceType: signData.resourceType,
        mimeType: file.type,
        bytes: file.size,
      }),
    });
    const saved = await saveResponse.json().catch(() => ({}));
    if (!saveResponse.ok) {
      throw new Error(saveFailureMessage(saved));
    }

    setItems((current) => [...current, saved.item]);
    setForm(initialForm);
    setFile(null);
    const input = document.getElementById("homepage-media-file");
    if (input) input.value = "";
    setProgress(100);
    addToast({ title: "آپلود شد", description: "فایل با موفقیت در صفحه اصلی منتشر شد.", variant: "success" });
  });

  const save = async (event) => {
    event.preventDefault();
    try {
      await upload.run();
    } catch (error) {
      addToast({ title: "خطا", description: error.message || "آپلود انجام نشد.", variant: "error" });
    } finally {
      setTimeout(() => setProgress(0), 700);
    }
  };

  const remove = async (id) => {
    if (busyId) return;
    if (!window.confirm("این فایل از صفحه اصلی و فضای ذخیره‌سازی حذف شود؟")) return;

    setBusyId(id);
    const response = await apiRequest(`/api/admin/home-media?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusyId(null);

    if (!response.ok) {
      addToast({ title: "خطا", description: response.data?.error || "حذف انجام نشد.", variant: "error" });
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
    addToast({
      title: "حذف شد",
      description:
        response.data?.storageRemoved === false
          ? "فایل از صفحه اصلی حذف شد، اما پاک‌سازی فضای ذخیره‌سازی انجام نشد."
          : "فایل از صفحه اصلی و فضای ذخیره‌سازی حذف شد.",
      variant: "success",
    });
  };

  const toggleActive = async (item) => {
    if (busyId) return;
    setBusyId(item.id);
    const response = await apiRequest("/api/admin/home-media", {
      method: "PATCH",
      body: { id: item.id, isActive: !item.isActive },
    });
    setBusyId(null);

    if (!response.ok) {
      addToast({ title: "خطا", description: response.data?.error || "تغییر وضعیت انجام نشد.", variant: "error" });
      return;
    }

    setItems((current) => current.map((entry) => (entry.id === item.id ? response.data.item : entry)));
  };

  const saving = upload.loading;
  const typeInfo = TYPES[form.type];
  const TypeIcon = typeInfo.icon;

  return (
    <div className="space-y-6">
      <PageHeader icon={Home} title="مدیریت فایل‌های صفحه اصلی" description="عکس، صوت و ویدیو را مستقیماً از کامپیوتر یا گوشی آپلود، فعال یا حذف کنید." />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5 text-primary" />افزودن فایل جدید</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="homepage-media-title">عنوان</Label><Input id="homepage-media-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً معرفی سامانه" required /></div>
            <div className="space-y-2"><Label htmlFor="homepage-media-type">نوع فایل</Label><select id="homepage-media-type" value={form.type} onChange={(e) => { setForm({ ...form, type: e.target.value }); setFile(null); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="IMAGE">🖼️ عکس</option><option value="AUDIO">🎵 صوت</option><option value="VIDEO">🎬 ویدیو</option></select></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="homepage-media-file">انتخاب فایل از کامپیوتر یا گوشی</Label><Input id="homepage-media-file" type="file" accept={typeInfo.accept} onChange={(e) => setFile(e.target.files?.[0] || null)} required /><p className="text-xs text-muted-foreground">{file ? `${file.name} — ${formatBytes(file.size)}` : `فقط ${typeInfo.label} انتخاب کنید.`}</p></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="homepage-media-description">توضیحات (اختیاری)</Label><Textarea id="homepage-media-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="توضیح کوتاه برای نمایش در صفحه اصلی" /></div>
            {progress > 0 && <div className="space-y-2 md:col-span-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs text-muted-foreground">{progress < 80 ? "در حال آپلود فایل..." : "در حال ثبت فایل..."}</p></div>}
            <div className="md:col-span-2"><Button type="submit" disabled={saving || !file}><TypeIcon className="ml-2 h-4 w-4" />{saving ? "در حال آپلود..." : "آپلود و انتشار در صفحه اصلی"}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">فایل‌های صفحه اصلی</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">در حال دریافت...</p> : loadError ? <div className="space-y-3"><p className="text-sm text-destructive">{loadError}</p><Button variant="outline" size="sm" onClick={loadItems}>تلاش دوباره</Button></div> : items.length === 0 ? <p className="text-sm text-muted-foreground">هنوز فایلی آپلود نشده است.</p> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => {
                const info = TYPES[item.type] || TYPES.IMAGE;
                const Icon = info.icon;
                const busy = busyId === item.id;
                return <article key={item.id} className={`overflow-hidden rounded-2xl border ${item.isActive ? "bg-card" : "bg-muted/30 opacity-70"}`}>
                  <div className="flex min-h-32 items-center justify-center bg-muted/30 p-3">
                    {item.type === "IMAGE" && <img src={item.url} alt={item.title} className="max-h-56 w-full rounded-xl object-contain" />}
                    {item.type === "VIDEO" && <video src={item.url} controls playsInline preload="metadata" className="max-h-56 w-full rounded-xl bg-black object-contain" />}
                    {item.type === "AUDIO" && <div className="w-full rounded-xl border bg-background p-5"><div className="mb-3 flex items-center gap-3"><Icon className="h-8 w-8 text-primary" /><span className="font-semibold">{item.title}</span></div><audio src={item.url} controls className="w-full" /></div>}
                  </div>
                  <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.title}</h3>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}</div><Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "نمایش" : "مخفی"}</Badge></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => toggleActive(item)}>{item.isActive ? <EyeOff className="ml-1 h-4 w-4" /> : <Eye className="ml-1 h-4 w-4" />}{item.isActive ? "مخفی کردن" : "نمایش دادن"}</Button><Button variant="destructive" size="sm" disabled={busy} onClick={() => remove(item.id)}><Trash2 className="ml-1 h-4 w-4" />حذف کامل</Button><span className="mr-auto flex items-center gap-1 text-xs text-muted-foreground"><GripVertical className="h-4 w-4" /> ترتیب {item.sortOrder + 1}</span></div></div>
                </article>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
