-- One table. Sticker PNGs live in this database (no Storage bucket).
-- Paste into SQL editor: https://supabase.com/dashboard/project/kehdrricvxstmuqbtfsp/sql

create table if not exists public.stickers (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  png text not null
);

create index if not exists stickers_created_at_idx on public.stickers (created_at desc);

alter table public.stickers enable row level security;

drop policy if exists stickers_select_demo on public.stickers;
create policy stickers_select_demo on public.stickers for select using (true);

drop policy if exists stickers_insert_demo on public.stickers;
create policy stickers_insert_demo on public.stickers for insert with check (true);

drop policy if exists stickers_delete_demo on public.stickers;
create policy stickers_delete_demo on public.stickers for delete using (true);
