-- 修复：get_nearby_bars 报错 function st_x(public.geometry) does not exist
-- 原因：SECURITY DEFINER + search_path=public 时找不到 extensions 里的 PostGIS 函数。
-- 已在 20260508120000 中改正；若你更早部署过旧版，执行本文件即可覆盖函数定义。

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
