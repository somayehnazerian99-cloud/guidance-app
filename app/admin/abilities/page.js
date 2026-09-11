"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminAbilitiesPage(){
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/abilities").then(r=>r.json()).then(d=>setItems(d.abilities||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">توانایی‌ها</h1><p className="text-muted-foreground mt-1">توانایی‌های ثبت‌شده</p></div>
      <Card><CardContent className="p-0">
        {items.length===0 ? <div className="p-12 text-center text-muted-foreground">موردی ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>دانش‌آموز</TableHead><TableHead>دسته</TableHead><TableHead>امتیاز</TableHead><TableHead>سطح</TableHead></TableRow></TableHeader>
        <TableBody>{items.map(a=>(
          <TableRow key={a.id}><TableCell>{a.student?.user?.firstName} {a.student?.user?.lastName}</TableCell><TableCell>{a.category}</TableCell><TableCell><Badge>{a.score}</Badge></TableCell><TableCell><Badge variant="outline">{a.level}</Badge></TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
