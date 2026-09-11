"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { Plus, Trash2, ExternalLink } from "lucide-react";

export default function AdminVideosPage(){
  const { addToast } = useToast();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title:"", description:"", videoUrl:"", thumbnail:"", category:"" });
  const fetchData = React.useCallback(async()=>{ try{ const r=await fetch("/api/videos"); const d=await r.json(); setItems(d.videos||[]);} finally{setLoading(false);} },[]);
  React.useEffect(()=>{fetchData();},[fetchData]);
  const submit = async (e)=>{
    e.preventDefault();
    const r=await fetch("/api/videos", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form)});
    if (r.ok){ addToast({title:"موفق", description:"ویدئو ایجاد شد", variant:"success"}); setOpen(false); setForm({title:"",description:"",videoUrl:"",thumbnail:"",category:""}); fetchData(); }
    else { const d=await r.json(); addToast({title:"خطا", description:d.error, variant:"error"}); }
  };
  const remove = async (id)=>{
    // Simple delete via direct prisma would need DELETE endpoint; for now we use toggle
    addToast({title:"اطلاع", description:"برای حذف، ویدئو را غیرفعال کنید", variant:"warning"});
  };
  if (loading) return <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64"/><Skeleton className="h-64"/></div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">ویدئوهای آموزشی</h1><p className="text-muted-foreground mt-1">مدیریت ویدئوها — فقط لینک YouTube/Aparat</p></div>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4"/>ویدئو جدید</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>افزودن ویدئو</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>عنوان *</Label><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/></div>
            <div className="space-y-2"><Label>توضیحات</Label><Input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div className="space-y-2"><Label>لینک ویدئو * (YouTube/Aparat)</Label><Input value={form.videoUrl} onChange={e=>setForm({...form,videoUrl:e.target.value})} dir="ltr" placeholder="https://www.aparat.com/v/..." required/></div>
            <div className="space-y-2"><Label>تصویر بندانگشتی (اختیاری)</Label><Input value={form.thumbnail} onChange={e=>setForm({...form,thumbnail:e.target.value})} dir="ltr" placeholder="https://..."/></div>
            <div className="space-y-2"><Label>دسته‌بندی</Label><Input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></div>
            <DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>انصراف</Button><Button type="submit">ایجاد</Button></DialogFooter>
          </form>
        </DialogContent></Dialog>
      </div>
      {items.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">ویدئویی ثبت نشده</CardContent></Card> :
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(v=>(
          <Card key={v.id}><CardHeader><CardTitle className="text-base">{v.title}</CardTitle><CardDescription>{v.description}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary underline break-all"><ExternalLink className="h-4 w-4 shrink-0"/>{v.videoUrl}</a>
            <div className="flex gap-2">{v.category && <Badge variant="secondary">{v.category}</Badge>}<Badge variant={v.isActive?"default":"outline"}>{v.isActive?"فعال":"غیرفعال"}</Badge></div>
          </CardContent></Card>
        ))}
      </div>}
    </div>
  );
}
