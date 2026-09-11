"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminCounselorsPage(){
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/counselors").then(r=>r.json()).then(d=>setItems(d.counselors||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">مشاوران</h1><p className="text-muted-foreground mt-1">لیست مشاوران ثبت‌شده — برای ایجاد مشاور از بخش کاربران استفاده کنید</p></div>
      <Card><CardContent className="p-0">
        {items.length===0 ? <div className="p-12 text-center text-muted-foreground">مشاوری یافت نشد</div> :
        <Table><TableHeader><TableRow><TableHead>نام</TableHead><TableHead>نام کاربری</TableHead><TableHead>تخصص</TableHead><TableHead>دانش‌آموزان</TableHead><TableHead>وضعیت</TableHead></TableRow></TableHeader>
        <TableBody>{items.map(u=>(
          <TableRow key={u.id}><TableCell className="font-medium">{u.firstName} {u.lastName}</TableCell><TableCell dir="ltr">{u.username}</TableCell><TableCell>{u.counselorProfile?.expertise || "—"}</TableCell><TableCell>{u._count?.assignedStudents ?? 0}</TableCell><TableCell><Badge variant={u.isActive?"default":"destructive"}>{u.isActive?"فعال":"غیرفعال"}</Badge></TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
