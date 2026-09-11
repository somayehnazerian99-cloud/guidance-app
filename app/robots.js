export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/counselor", "/student", "/api"] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sitemap.xml`,
  };
}
