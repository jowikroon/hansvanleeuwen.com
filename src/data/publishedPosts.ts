// Public published-posts adapter.
//
// Reads `hvl_blog_articles` (status='published') from Supabase and maps to the
// shape the public /writing and /writing/:slug pages expect.
//
// Anon select is allowed by the "Public read published" RLS policy.

import { supabase } from "@/integrations/supabase/client";
import type { BlogPost } from "./types";

export interface PublishedPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  content_nl: string | null;
  category: string;
  tags: string[];
  status: string;
  hero_image_url: string | null;
  og_image: string | null;
  read_time: string | null;
  word_count: number | null;
  featured: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToBlogPost(r: PublishedPostRow): BlogPost {
  const date = r.published_at ?? r.created_at;
  const image = r.hero_image_url ?? r.og_image ?? undefined;
  const readTime =
    r.read_time ??
    (r.word_count
      ? `${Math.max(1, Math.ceil(r.word_count / 220))} min read`
      : "5 min read");
  // BlogPost.category is "professional" | "personal"; accept anything else as professional
  const category: BlogPost["category"] =
    r.category === "personal" ? "personal" : "professional";
  return {
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    category,
    tags: r.tags ?? [],
    date,
    readTime,
    slug: r.slug,
    image,
    featured: r.featured,
  };
}

const SELECT_COLS =
  "id,title,slug,excerpt,content,content_nl,category,tags,status,hero_image_url,og_image,read_time,word_count,featured,published_at,created_at,updated_at";

export async function fetchPublishedPosts(): Promise<{
  posts: BlogPost[];
  rows: PublishedPostRow[];
}> {
  const { data, error } = await supabase
    .from("hvl_blog_articles")
    .select(SELECT_COLS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as PublishedPostRow[];
  return { posts: rows.map(rowToBlogPost), rows };
}

export async function fetchPublishedPostBySlug(
  slug: string,
): Promise<{ post: BlogPost; row: PublishedPostRow } | null> {
  const { data, error } = await supabase
    .from("hvl_blog_articles")
    .select(SELECT_COLS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PublishedPostRow;
  return { post: rowToBlogPost(row), row };
}
