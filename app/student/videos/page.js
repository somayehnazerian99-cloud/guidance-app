"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function toEmbed(url){
  try{
    const u=new URL(url);
    if (u.hostname.includes("youtu.be")) { const id=u.pathname.slice(1); return `https://www.youtube.com/embed/${id}`; }
    if (u.hostname.includes("youtube.com")) { const id=u.searchParams.get("v"); if (id) return `https://www.youtube.com/embed/${id}`; }
    if (u.hostname.includes("aparat.com")) return url; // aparat embed needs special handling, show link
    return null;
  }catch{return null;}
}

export default function StudentVideosPage(){
  const [videos, setVideos] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(()=>{ fetch("/api/videos").then(r=>r.json()).then(d=>setVideos(d.videos||[])).finally(()=>setLoading(false)); },[]);
  if (loading) return <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(i=><Skeleton key={i} className="h-64"/> )}</div>;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">ویدئوهای آموزشی</h1><p className="text-muted-foreground mt-1">ویدئوهای راهنمای انتخاب رشته</p></div>
      {videos.length===0 ? <Card><CardContent className="p-12 text-center text-muted-foreground">ویدئویی موجود نیست</CardContent></Card> :
      <div className="grid gap-4 md:grid-cols-2">
        {videos.map(v=>{
          const embed = toEmbed(v.videoUrl);
          return (
            <Card key={v.id} className="overflow-hidden">
              {/* Thumbnails are arbitrary admin-provided URLs, so next/image cannot be used
                  without an exhaustive remotePatterns allowlist. Lazy loading keeps LCP in check. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v.thumbnail && <img src={v.thumbnail} alt={v.title} loading="lazy" decoding="async" className="h-40 w-full object-cover"/>}
              {embed && v.videoUrl.includes("youtube") ? (
                <div className="aspect-video"><iframe src={embed} title={v.title} className="h-full w-full" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
              ) : (
                <div className="p-3 text-sm"><a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{v.videoUrl}</a></div>
              )}
              <CardHeader><CardTitle className="text-base">{v.title}</CardTitle><CardDescription>{v.description}</CardDescription></CardHeader>
              {v.category && <CardContent><Badge variant="secondary">{v.category}</Badge></CardContent>}
            </Card>
          );
        })}
      </div>}
    </div>
  );
}
