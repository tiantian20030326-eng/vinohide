-- Slice A: public read RPCs for map + menu stats (no per-user row leakage)

-- New user → profile row (needed for shell_mode / membership joins)
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_handle)
  values (
    new.id,
    '旅人#' || upper(substr(md5(random()::text), 1, 4))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user ();

-- Nearby bars + today's visit aggregate (excludes shell_mode users from counts & vibe)
create or replace function public.get_nearby_bars (
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision default 8000
)
returns table (
  id uuid,
  name text,
  address text,
  city text,
  lng double precision,
  lat double precision,
  timezone text,
  noise_level text,
  has_na_drinks boolean,
  tonight_playlist text,
  floor_plan_url text,
  distance_m double precision,
  plan_count_today bigint,
  dominant_vibe text
)
language sql
stable
security definer
-- Supabase 上 PostGIS 在 extensions 模式；仅 public 时 ST_* 无法解析
set search_path = public, extensions
as $$
  with bar_candidates as (
    select
      b.*,
      st_distance (
        b.geom::geography,
        st_setsrid (st_makepoint (p_lng, p_lat), 4326)::geography
      ) as distance_m
    from public.bars b
    where
      b.active = true
      and st_dwithin (
        b.geom::geography,
        st_setsrid (st_makepoint (p_lng, p_lat), 4326)::geography,
        p_radius_m
      )
  ),
  today_visits as (
    select vp.bar_id, vp.vibe, vp.user_id
    from public.visit_plans vp
    inner join public.profiles pr
      on pr.user_id = vp.user_id
      and pr.shell_mode = false
    inner join bar_candidates bc on bc.id = vp.bar_id
    where
      vp.cancelled_at is null
      and vp.plan_date = (current_timestamp at time zone bc.timezone)::date
  ),
  visit_counts as (
    select tv.bar_id, count(distinct tv.user_id) as plan_count_today
    from today_visits tv
    group by tv.bar_id
  ),
  vibe_rank as (
    select distinct on (v.bar_id)
      v.bar_id,
      v.vibe as dominant_vibe
    from (
      select tv.bar_id, tv.vibe, count(*) as cnt
      from today_visits tv
      where tv.vibe is not null
      group by tv.bar_id, tv.vibe
    ) v
    order by v.bar_id, v.cnt desc
  )
  select
    bc.id,
    bc.name,
    bc.address,
    bc.city,
    st_x (bc.geom::geometry)::double precision as lng,
    st_y (bc.geom::geometry)::double precision as lat,
    bc.timezone,
    bc.noise_level,
    bc.has_na_drinks,
    bc.tonight_playlist,
    bc.floor_plan_url,
    bc.distance_m,
    coalesce(vc.plan_count_today, 0)::bigint as plan_count_today,
    vr.dominant_vibe
  from bar_candidates bc
  left join visit_counts vc on vc.bar_id = bc.id
  left join vibe_rank vr on vr.bar_id = bc.id;
$$;

-- Menu rows + today's intent counts (excludes shell_mode)
create or replace function public.get_bar_menu_with_stats (p_bar_id uuid)
returns table (
  menu_item_id uuid,
  name text,
  description text,
  price_cny numeric,
  sort_order int,
  intent_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bar_tz as (
    select coalesce (timezone, 'UTC') as tz
    from public.bars
    where id = p_bar_id and active = true
  ),
  ref_date as (
    select (current_timestamp at time zone (select tz from bar_tz))::date as d
  )
  select
    mi.id as menu_item_id,
    mi.name,
    mi.description,
    mi.price_cny,
    mi.sort_order,
    coalesce(ic.cnt, 0)::bigint as intent_count
  from public.menu_items mi
  cross join ref_date rd
  left join lateral (
    select count(distinct di.user_id) as cnt
    from public.drink_intents di
    inner join public.profiles pr
      on pr.user_id = di.user_id
      and pr.shell_mode = false
    where
      di.menu_item_id = mi.id
      and di.bar_id = p_bar_id
      and di.cancelled_at is null
      and di.intent_date = rd.d
  ) ic on true
  where
    mi.bar_id = p_bar_id
    and mi.active = true
    and exists (select 1 from bar_tz)
  order by mi.sort_order asc, mi.name asc;
$$;

grant execute on function public.get_nearby_bars (double precision, double precision, double precision)
to anon, authenticated;

grant execute on function public.get_bar_menu_with_stats (uuid)
to anon, authenticated;
