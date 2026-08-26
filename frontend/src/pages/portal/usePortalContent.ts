import { useEffect, useState } from "react";
import { api, type ContentItem } from "../../api";
import { news as staticNews, publications as staticPubs, type News, type Publication } from "../../data/portal";

/*
 * Ambil konten publik (berita & publikasi) dari API dengan fallback ke data
 * statis portal.ts. API jalan duluan; jika gagal (backend down, page statis)
 * landing tetap tampil dari data statis.
 */
function toNews(c: ContentItem): News {
  return {
    slug: c.slug,
    title: c.title,
    excerpt: c.excerpt,
    image: c.image,
    category: c.category,
    author: c.author,
    date: c.date,
    content: c.content,
    gallery: c.gallery,
  };
}

function toPublication(c: ContentItem): Publication {
  return {
    slug: c.slug,
    title: c.title,
    excerpt: c.excerpt,
    image: c.image,
    category: c.category,
    author: c.author,
    date: c.date,
    documentUrl: c.document_url,
    documentName: c.document_name,
    content: c.content,
  };
}

export function usePortalContent() {
  const [apiNews, setApiNews] = useState<News[]>([]);
  const [apiPubs, setApiPubs] = useState<Publication[]>([]);

  useEffect(() => {
    let alive = true;
    api.content()
      .then((items) => {
        if (!alive) return;
        setApiNews(items.filter((i) => i.type === "news").map(toNews));
        setApiPubs(items.filter((i) => i.type === "publication").map(toPublication));
      })
      .catch(() => {
        /* fallback ke data statis */
      });
    return () => { alive = false; };
  }, []);

  const effectiveNews = apiNews.length > 0 ? apiNews : staticNews;
  const effectivePubs = apiPubs.length > 0 ? apiPubs : staticPubs;
  return { news: effectiveNews, publications: effectivePubs };
}
