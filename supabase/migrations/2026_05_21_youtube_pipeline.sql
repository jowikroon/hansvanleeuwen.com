-- Migration: YouTube → Article pipeline
-- Run order: after Phase B shell migrations, before wiring the live n8n
-- orchestrator at /webhook/blog-youtube-analyze.
--
-- Both statements are additive — no existing column or row is touched.
-- Safe to run on the live hvl_blog_articles table.

-- ─── 1. Source-of-truth cache for YouTube videos ─────────────────────
create table if not exists hvl_youtube_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  video_id text not null,
  title text,
  channel text,
  duration_seconds int,
  published_at timestamptz,
  thumbnail_url text,
  transcript_text text,
  transcript_segments jsonb,
  transcript_source text check (transcript_source in ('youtube-captions', 'whisper', 'gemini')),
  topics jsonb,
  beats jsonb,
  cost_usd numeric(10,4) default 0,
  fetched_at timestamptz not null default now()
);
create index if not exists hvl_youtube_sources_video_id_idx on hvl_youtube_sources(video_id);

alter table hvl_youtube_sources enable row level security;

drop policy if exists "youtube_sources_select_authed" on hvl_youtube_sources;
create policy "youtube_sources_select_authed" on hvl_youtube_sources
  for select using (auth.role() = 'authenticated');

drop policy if exists "youtube_sources_insert_authed" on hvl_youtube_sources;
create policy "youtube_sources_insert_authed" on hvl_youtube_sources
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "youtube_sources_update_authed" on hvl_youtube_sources;
create policy "youtube_sources_update_authed" on hvl_youtube_sources
  for update using (auth.role() = 'authenticated');

-- ─── 2. Link from blog articles back to the source video ─────────────
alter table hvl_blog_articles
  add column if not exists source_youtube_id uuid references hvl_youtube_sources(id) on delete set null;

create index if not exists hvl_blog_articles_source_youtube_id_idx
  on hvl_blog_articles(source_youtube_id) where source_youtube_id is not null;

-- ─── 3. Optional: backfill audit table ───────────────────────────────
-- A small log of YouTube analyses for cost/observability.
create table if not exists hvl_youtube_analyses (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references hvl_youtube_sources(id) on delete cascade,
  post_id uuid references hvl_blog_articles(id) on delete set null,
  triggered_by uuid references auth.users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_steps int not null default 10,
  completed_steps int not null default 0,
  failed_step text,
  total_cost_usd numeric(10,4) default 0,
  status text not null default 'running' check (status in ('running','done','failed','cancelled'))
);
alter table hvl_youtube_analyses enable row level security;
drop policy if exists "youtube_analyses_owner_all" on hvl_youtube_analyses;
create policy "youtube_analyses_owner_all" on hvl_youtube_analyses
  for all using (auth.role() = 'authenticated');
