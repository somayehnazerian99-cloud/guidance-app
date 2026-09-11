export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login/admin`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/login/counselor`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/login/student`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
