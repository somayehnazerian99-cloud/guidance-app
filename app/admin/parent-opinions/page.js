"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminParentOpinionsPage(){
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/parent-opinions").then(r=>r.json()).then(d=>setItems(d.opinions||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full"/><Skeleton className="h-32 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">نظر والدین</h1><p className="text-muted-foreground mt-1">دیدگاه والدین درباره فرزندان</p></div>
      {items.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">نظری ثبت نشده</CardContent></Card> :
      <div className="grid gap-4">
        {items.map(o=>(
          <Card key={o.id}><CardHeader><CardTitle className="text-base">{o.student?.user?.firstName} {o.student?.user?.lastName} — {o.parentName || "والد"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.fieldInterest && <div><Badge variant="secondary">رشته پیشنهادی والد: {o.fieldInterest}</Badge></div>}
            {o.interests && <p><span className="font-medium">علایق: </span>{o.interests}</p>}
            {o.abilities && <p><span className="font-medium">توانایی‌ها: </span>{o.abilities}</p>}
            {o.behavioral && <p><span className="font-medium">رفتاری: </span>{o.behavioral}</p>}
            {o.generalNotes && <p className="text-muted-foreground">{o.generalNotes}</p>}
            <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("fa-IR")}</p>
          </CardContent></Card>
        ))}
      </div>}
    </div>
  );
}
