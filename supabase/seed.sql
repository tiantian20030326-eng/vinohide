-- VinoHide · 隐醺 — 种子数据（上海示例酒吧）
-- 在 Supabase SQL Editor 中运行，或在 migration 之后以 `supabase db push` 部署。

-- 注意：此文件依赖 migration 已建表；请在 migration 之后执行。

-- 示例酒吧（GCJ-02 坐标，与高德地图一致）
insert into public.bars (id, name, address, city, geom, timezone, noise_level, has_na_drinks, tonight_playlist)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'The Hop House',
    '徐汇区某路 88 号',
    '上海',
    st_setsrid(st_makepoint(121.437, 31.2005), 4326),
    'Asia/Shanghai',
    'quiet',
    true,
    '爵士 / Neo-Soul'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'The Hidden Door',
    '静安区某弄 16 号',
    '上海',
    st_setsrid(st_makepoint(121.451, 31.228), 4326),
    'Asia/Shanghai',
    'medium',
    false,
    '90s Alt Rock'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '月下独酌 Lab',
    '黄浦区滨江某段',
    '上海',
    st_setsrid(st_makepoint(121.499, 31.239), 4326),
    'Asia/Shanghai',
    'loud',
    true,
    '电子 / House'
  )
on conflict (id) do nothing;

-- 示例酒单
insert into public.menu_items (bar_id, name, price_cny, sort_order)
values
  ('a0000000-0000-0000-0000-000000000001', '西海岸 IPA', 58, 1),
  ('a0000000-0000-0000-0000-000000000001', '新英格兰浑浊 IPA', 62, 2),
  ('a0000000-0000-0000-0000-000000000001', '无酒精起泡', 38, 3),
  ('a0000000-0000-0000-0000-000000000002', '古典鸡尾酒', 78, 1),
  ('a0000000-0000-0000-0000-000000000002', '隐藏特调 · 午夜蓝', 88, 2),
  ('a0000000-0000-0000-0000-000000000003', '香槟杯装精酿', 48, 1),
  ('a0000000-0000-0000-0000-000000000003', 'Shot 三连', 66, 2)
on conflict do nothing;
