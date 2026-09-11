"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SecurityLogsPage(){
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{
    // Audit logs are exposed via reports dashboard recentActivity; fetch directly if available
    fetch("/api/reports?type=dashboard").then(r=>r.json()).then(d=>setLogs(d.recentActivity||[])).finally(()=>setLoading(false));
  },[]);
  if (loading) return <div className="space-y-3">{[1,2,3,4,5].map(i=><Skeleton key={i} className="h-16"/>)}</div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">لاگ امنیتی</h1><p className="text-muted-foreground mt-1">آخرین رویدادهای امنیتی سیستم</p></div>
      {logs.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">لاگی ثبت نشده</CardContent></Card> :
      <div className="space-y-2">
        {logs.map(l=>(
          <Card key={l.id}><CardContent className="p-4 flex items-start justify-between gap-3">
            <div><div className="font-medium text-sm flex items-center gap-2"><Badge variant={l.action.includes("FAILED")?"destructive": l.action==="LOGIN"?"default":"secondary"}>{l.action}</Badge> {l.user ? `${l.user.firstName} ${l.user.lastName}` : "سیستم"}</div>
            {l.details && <p className="text-xs text-muted-foreground mt-1 break-all">{l.details}</p>}
            {l.ipAddress && <p className="text-xs text-muted-foreground">IP: {l.ipAddress}</p>}</div>
            <span className="text-xs text-muted-foreground shrink-0">{new Date(l.createdAt).toLocaleString("fa-IR")}</span>
          </CardContent></Card>
        ))}
      </div>}
    </div>
  );
}
