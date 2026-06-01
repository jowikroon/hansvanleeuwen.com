-- Migration: Sprint B — Search Console opportunities table
-- Additive only. The n8n workflow blog-sc-opportunities upserts into this
-- table daily; the frontend rail reads from it to render the briefs cards.

create table if not exists hvl_seo_opportunities (
  id uuid primary key default gen_random_uuid(),
  query text not null unique,
  page_url text,
  current_position numeric(5,2) not null,
  target_position int not null,
  impressions int not null,
  ctr numeric(6,4) not null,
  estimated_uplift_sessions int not null,
  action text not null check (action in ('refresh', 'new')),
  target_post_slug text,
  target_post_id uuid references hvl_blog_articles(id) on delete set null,
  brief text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'shipped', 'dismissed')),
  refreshed_at timestamptz not null default now(),
  shipped_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hvl_seo_opp_action_status_idx on hvl_seo_opportunities(action, status);
create index if not exists hvl_seo_opp_uplift_idx on hvl_seo_opportunities(estimated_uplift_sessions desc);

alter table hvl_seo_opportunities enable row level security;
drop policy if exists "seo_opp_authed_all" on hvl_seo_opportunities;
create policy "seo_opp_authed_all" on hvl_seo_opportunities
  for all using (auth.role() = 'authenticated');
