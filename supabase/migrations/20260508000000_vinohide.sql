-- VinoHide · 隐醺 — baseline schema (Supabase / Postgres + PostGIS)
-- Apply via Supabase SQL editor or `supabase db push` after linking project.

create extension if not exists postgis;

-- Profiles (1:1 auth.users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_handle text not null,
  is_owner boolean not null default false,
  show_owner_badge boolean not null default true,
  shell_mode boolean not null default false,
  membership_tier text not null default 'free'
    check (membership_tier in ('free', 'silver', 'gold', 'diamond')),
  created_at timestamptz not null default now()
);

-- Bars
create table if not exists public.bars (
  id uuid primary key default gen_random_uuid (),
  name text not null,
  address text not null,
  city text not null,
  geom geometry(Point, 4326) not null,
  timezone text not null default 'Asia/Shanghai',
  owner_id uuid references public.profiles (user_id),
  active boolean not null default true,
  noise_level text check (noise_level in ('quiet', 'medium', 'loud')),
  has_na_drinks boolean not null default false,
  tonight_playlist text,
  floor_plan_url text,
  created_at timestamptz not null default now()
);

create index if not exists bars_geom_gix on public.bars using gist (geom);
create index if not exists bars_city_idx on public.bars (city);

-- Menu
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid (),
  bar_id uuid not null references public.bars (id) on delete cascade,
  name text not null,
  description text,
  price_cny numeric(10, 2) not null,
  sort_order int not null default 0,
  active boolean not null default true
);

create index if not exists menu_bar_idx on public.menu_items (bar_id);

-- Visit plans + vibe (蓝图场景光谱)
create table if not exists public.visit_plans (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  bar_id uuid not null references public.bars (id) on delete cascade,
  plan_date date not null,
  vibe text check (vibe in ('alone', 'social', 'celebrate', 'tasting')),
  cancelled_at timestamptz,
  unique (user_id, bar_id, plan_date)
);

create index if not exists visit_bar_date_idx on public.visit_plans (bar_id, plan_date);

-- Drink intents + mood note (漂浮瓶)
create table if not exists public.drink_intents (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  bar_id uuid not null references public.bars (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  intent_date date not null,
  mood_note text,
  cancelled_at timestamptz,
  unique (user_id, bar_id, menu_item_id, intent_date)
);

-- Chat (minimal)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid (),
  type text not null check (type in ('direct', 'group')),
  title text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now ()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now (),
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid (),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now ()
);

create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

-- RLS: enable (policies to be tightened per RPC rollout)
alter table public.profiles enable row level security;
alter table public.bars enable row level security;
alter table public.menu_items enable row level security;
alter table public.visit_plans enable row level security;
alter table public.drink_intents enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Minimal policies (dev-friendly — refine before production)
create policy profiles_self_rw on public.profiles
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create policy bars_read_active on public.bars
  for select using (active = true);

create policy menu_read_active on public.menu_items
  for select using (
    active = true
    and exists (
      select 1 from public.bars b
      where b.id = menu_items.bar_id and b.active = true
    )
  );

create policy visit_own on public.visit_plans
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create policy intent_own on public.drink_intents
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

create policy conv_members_select on public.conversation_members
  for select using (auth.uid () = user_id);

create policy messages_members on public.messages
  for select using (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.user_id = auth.uid ()
        and m.left_at is null
    )
  );

create policy messages_insert_own on public.messages
  for insert with check (
    sender_id = auth.uid ()
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id
        and m.user_id = auth.uid ()
        and m.left_at is null
    )
  );

comment on table public.visit_plans is '今晚计划到店 + 场景光谱 vibe';
comment on column public.drink_intents.mood_note is '蓝图「漂浮瓶」心情短句';

-- ============================================================
-- RPC: 安全聚合统计（SECURITY DEFINER，不泄露 user_id 明细）
-- ============================================================

-- get_bar_stats: 返回指定酒吧在指定日期的聚合统计
create or replace function public.get_bar_stats(
  p_bar_id uuid,
  p_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_count bigint;
  v_vibes jsonb;
  v_vibes_raw text[];
  v_dominant_vibe text;
  v_menu_intents jsonb;
begin
  -- 今日计划到店人数（排除龟壳模式用户）
  select count(distinct vp.user_id)
  into v_plan_count
  from public.visit_plans vp
  inner join public.profiles p on p.user_id = vp.user_id
  where vp.bar_id = p_bar_id
    and vp.plan_date = p_date
    and vp.cancelled_at is null
    and p.shell_mode = false;

  -- 氛围光谱聚合（按 vibe 分组计数 → 取 dominant）
  select array_agg(vp.vibe order by cnt desc)
  into v_vibes_raw
  from (
    select vp.vibe, count(*) as cnt
    from public.visit_plans vp
    inner join public.profiles p on p.user_id = vp.user_id
    where vp.bar_id = p_bar_id
      and vp.plan_date = p_date
      and vp.cancelled_at is null
      and p.shell_mode = false
      and vp.vibe is not null
    group by vp.vibe
  ) sub;

  v_dominant_vibe := v_vibes_raw[1];

  -- 各 vibe 详细计数
  select coalesce(jsonb_object_agg(vibe, cnt), '{}'::jsonb)
  into v_vibes
  from (
    select coalesce(vp.vibe, 'none') as vibe, count(*) as cnt
    from public.visit_plans vp
    inner join public.profiles p on p.user_id = vp.user_id
    where vp.bar_id = p_bar_id
      and vp.plan_date = p_date
      and vp.cancelled_at is null
      and p.shell_mode = false
    group by coalesce(vp.vibe, 'none')
  ) sub;

  -- 各酒单单品今日意向人数
  select coalesce(jsonb_object_agg(mi.id, cnt), '{}'::jsonb)
  into v_menu_intents
  from (
    select di.menu_item_id, count(distinct di.user_id) as cnt
    from public.drink_intents di
    inner join public.profiles p on p.user_id = di.user_id
    inner join public.menu_items mi on mi.id = di.menu_item_id
    where di.bar_id = p_bar_id
      and di.intent_date = p_date
      and di.cancelled_at is null
      and p.shell_mode = false
      and mi.active = true
    group by di.menu_item_id
  ) sub;

  return jsonb_build_object(
    'bar_id', p_bar_id,
    'plan_date', p_date,
    'plan_count_today', v_plan_count,
    'dominant_vibe', v_dominant_vibe,
    'vibe_breakdown', v_vibes,
    'menu_intent_counts', v_menu_intents
  );
end;
$$;

-- get_nearby_bars: 返回指定坐标附近的酒吧列表（含基本统计）
create or replace function public.get_nearby_bars(
  p_lng float8,
  p_lat float8,
  p_radius_m float8 default 5000
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  lng float8,
  lat float8,
  timezone text,
  noise_level text,
  has_na_drinks boolean,
  tonight_playlist text,
  floor_plan_url text,
  owner_id uuid,
  distance_m float8,
  plan_count_today bigint,
  dominant_vibe text
)
language sql
security definer
set search_path = 'public'
as $$
  with nearby as (
    select
      b.id,
      b.name,
      b.address,
      b.city,
      st_x(b.geom::geometry) as lng,
      st_y(b.geom::geometry) as lat,
      b.timezone,
      b.noise_level,
      b.has_na_drinks,
      b.tonight_playlist,
      b.floor_plan_url,
      b.owner_id,
      st_distance(b.geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_m
    from public.bars b
    where b.active = true
      and st_dwithin(
        b.geom,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
        p_radius_m
      )
  ),
  today_stats as (
    select
      vp.bar_id,
      count(distinct vp.user_id) as plan_cnt,
      (
        select vp2.vibe
        from public.visit_plans vp2
        inner join public.profiles p2 on p2.user_id = vp2.user_id
        where vp2.bar_id = vp.bar_id
          and vp2.plan_date = current_date
          and vp2.cancelled_at is null
          and p2.shell_mode = false
          and vp2.vibe is not null
        group by vp2.vibe
        order by count(*) desc
        limit 1
      ) as dom_vibe
    from public.visit_plans vp
    inner join public.profiles p on p.user_id = vp.user_id
    where vp.plan_date = current_date
      and vp.cancelled_at is null
      and p.shell_mode = false
    group by vp.bar_id
  )
  select
    n.id,
    n.name,
    n.address,
    n.city,
    n.lng,
    n.lat,
    n.timezone,
    n.noise_level,
    n.has_na_drinks,
    n.tonight_playlist,
    n.floor_plan_url,
    n.owner_id,
    n.distance_m,
    coalesce(ts.plan_cnt, 0) as plan_count_today,
    ts.dom_vibe as dominant_vibe
  from nearby n
  left join today_stats ts on ts.bar_id = n.id
  order by n.distance_m;
$$;

-- get_bar_menu_with_stats: 返回指定酒吧的酒单，含今日各单品意向人数
create or replace function public.get_bar_menu_with_stats(
  p_bar_id uuid
)
returns table (
  menu_item_id uuid,
  name text,
  description text,
  price_cny numeric,
  sort_order int,
  intent_count bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    mi.id as menu_item_id,
    mi.name,
    mi.description,
    mi.price_cny,
    mi.sort_order,
    coalesce(ic.cnt, 0) as intent_count
  from public.menu_items mi
  left join lateral (
    select count(distinct di.user_id) as cnt
    from public.drink_intents di
    inner join public.profiles p on p.user_id = di.user_id
    where di.menu_item_id = mi.id
      and di.intent_date = current_date
      and di.cancelled_at is null
      and p.shell_mode = false
  ) ic on true
  where mi.bar_id = p_bar_id
    and mi.active = true
  order by mi.sort_order;
$$;
