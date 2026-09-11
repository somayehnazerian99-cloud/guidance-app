"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsPage(){
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const fetchData = React.useCallback(async()=>{
    try{ const r=await fetch("/api/notifications"); const d=await r.json(); setItems(d.notifications||[]); } finally{ setLoading(false); }
  },[]);
  React.useEffect(()=>{fetchData();},[fetchData]);
  const markRead = async (id)=>{
    await fetch("/api/notifications", {method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({notificationId:id})});
    fetchData();
  };
  if (loading) return <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-20"/>)}</div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">اعلان‌ها</h1><p className="text-muted-foreground mt-1">پیام‌های سیستم برای شما</p></div>
      {items.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">اعلانی وجود ندارد</CardContent></Card> :
      <div className="space-y-3">
        {items.map(n=>(
          <Card key={n.id} className={n.isRead ? "opacity-60":""}><CardContent className="p-4 flex items-start justify-between gap-3">
            <div><div className="font-medium flex items-center gap-2">{n.title} {!n.isRead && <Badge>جدید</Badge>} <Badge variant="outline">{n.type}</Badge></div><p className="text-sm text-muted-foreground mt-1">{n.message}</p><p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString("fa-IR")}</p></div>
            {!n.isRead && <Button size="sm" variant="outline" onClick={()=>markRead(n.id)}>خوانده شد</Button>}
          </CardContent></Card>
        ))}
      </div>}
    </div>
  );
}
