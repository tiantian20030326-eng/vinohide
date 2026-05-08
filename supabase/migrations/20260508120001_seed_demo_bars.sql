-- Demo seed for Slice A (Shanghai-ish coords). Idempotent via WHERE NOT EXISTS.

insert into public.bars (
  id, name, address, city, geom, timezone,
  noise_level, has_na_drinks, tonight_playlist
)
select * from (values
  (
    'a0000001-0000-4000-8000-000000000001'::uuid,
    'The Hop House',
    '徐汇区某路 88 号',
    '上海',
    st_setsrid (st_makepoint (121.437, 31.2005), 4326),
    'Asia/Shanghai'::text,
    'quiet'::text,
    true,
    '爵士 / Neo-Soul'::text
  ),
  (
    'a0000001-0000-4000-8000-000000000002'::uuid,
    'The Hidden Door',
    '静安区某弄 16 号',
    '上海',
    st_setsrid (st_makepoint (121.451, 31.228), 4326),
    'Asia/Shanghai',
    'medium',
    false,
    '90s Alt Rock'
  ),
  (
    'a0000001-0000-4000-8000-000000000003'::uuid,
    '月下独酌 Lab',
    '黄浦区滨江某段',
    '上海',
    st_setsrid (st_makepoint (121.499, 31.239), 4326),
    'Asia/Shanghai',
    'loud',
    true,
    '电子 / House'
  )
) as v(id, name, address, city, geom, timezone, noise_level, has_na_drinks, tonight_playlist)
where not exists (select 1 from public.bars b where b.id = v.id);

insert into public.menu_items (bar_id, name, description, price_cny, sort_order)
select v.bar_id, v.name, v.description, v.price_cny, v.sort_order
from (values
  ('a0000001-0000-4000-8000-000000000001'::uuid, '西海岸 IPA'::text, null::text, 58::numeric, 10),
  ('a0000001-0000-4000-8000-000000000001'::uuid, '新英格兰浑浊 IPA', null, 62, 20),
  ('a0000001-0000-4000-8000-000000000001'::uuid, '无酒精起泡', null, 38, 30),
  ('a0000001-0000-4000-8000-000000000002'::uuid, '古典鸡尾酒', null, 78, 10),
  ('a0000001-0000-4000-8000-000000000002'::uuid, '隐藏特调 · 午夜蓝', null, 88, 20),
  ('a0000001-0000-4000-8000-000000000003'::uuid, '香槟杯装精酿', null, 48, 10),
  ('a0000001-0000-4000-8000-000000000003'::uuid, 'Shot 三连', null, 66, 20)
) as v(bar_id, name, description, price_cny, sort_order)
where not exists (
  select 1
  from public.menu_items mi
  where mi.bar_id = v.bar_id and mi.name = v.name
);
