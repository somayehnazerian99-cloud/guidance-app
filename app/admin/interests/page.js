"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LABEL = { MATH:"ریاضی", SCIENCE:"علوم", TECHNOLOGY:"فناوری", ART:"هنر", LANGUAGE:"زبان", LITERATURE:"ادبیات", COMPUTER:"کامپیوتر", TECHNICAL:"فنی", SOCIAL:"اجتماعی", ENTREPRENEURSHIP:"کارآفرینی", SPORTS:"ورزش" };

export default function AdminInterestsPage(){
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/interests").then(r=>r.json()).then(d=>setItems(d.interests||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="space-y-4"><Skeleton className="h-12 w-full"/><Skeleton className="h-64 w-full"/></div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">علایق</h1><p className="text-muted-foreground mt-1">علایق ثبت‌شده توسط دانش‌آموزان</p></div>
      <Card><CardContent className="p-0">
        {items.length===0 ? <div className="p-12 text-center text-muted-foreground">موردی ثبت نشده</div> :
        <Table><TableHeader><TableRow><TableHead>دانش‌آموز</TableHead><TableHead>دسته</TableHead><TableHead>سطح</TableHead><TableHead>تاریخ</TableHead></TableRow></TableHeader>
        <TableBody>{items.map(i=>(
          <TableRow key={i.id}><TableCell>{i.student?.user?.firstName} {i.student?.user?.lastName}</TableCell><TableCell><Badge variant="secondary">{LABEL[i.category] || i.category}</Badge></TableCell><TableCell>{i.level} / ۵</TableCell><TableCell>{new Date(i.createdAt).toLocaleDateString("fa-IR")}</TableCell></TableRow>
        ))}</TableBody></Table>}
      </CardContent></Card>
    </div>
  );
}
