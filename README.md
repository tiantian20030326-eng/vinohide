# VinoHide · 隐醺（Web / PWA）

对应产品文档：[docs/superpowers/specs/2026-05-07-bar-map-pwa-design.md](../docs/superpowers/specs/2026-05-07-bar-map-pwa-design.md) 与桌面上的《VinoHide·隐醺_完整产品蓝图》。

## 本地运行

```bash
cd vinohide
cp .env.example .env
npm install
npm run dev
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `VITE_AMAP_KEY` | 高德开放平台 Web 端 Key（配置域名白名单） |
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |

未配置高德 Key 时，地图页使用「占位 + 酒吧 chips」仍可点选查看详情与酒单涟漪演示。

## Supabase（Slice A：RPC + 演示数据）

按顺序在 SQL Editor 执行（或使用 Supabase CLI `db push`）：

1. [`supabase/migrations/20260508000000_vinohide.sql`](../supabase/migrations/20260508000000_vinohide.sql) — 表与 RLS  
2. [`supabase/migrations/20260508120000_slice_a_rpc.sql`](../supabase/migrations/20260508120000_slice_a_rpc.sql) — `get_nearby_bars`、`get_bar_menu_with_stats`、`handle_new_user` 触发器  
3. [`supabase/migrations/20260508120001_seed_demo_bars.sql`](../supabase/migrations/20260508120001_seed_demo_bars.sql) — 上海附近演示酒吧与酒单  

配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 后，地图页从 RPC 拉取数据；失败时回退 `src/data/mockBars.ts` 并提示。聊天等仍接 Realtime（后续切片）。

**演示数据（二选一）**：执行第 3 步 migration，或在第 1、2 步之后单独运行根目录 [`supabase/seed.sql`](../supabase/seed.sql)（与 migration 种子二选一即可，避免重复店名可只跑一种）。

## 故障排除：`st_x(geometry) does not exist`

Supabase 上 PostGIS 一般在 **`extensions`** 模式。函数 `get_nearby_bars` 若为 `SECURITY DEFINER` 且 **`search_path` 只有 `public`**，会找不到 `ST_X` / `ST_DWithin` 等。

**处理**：在 SQL Editor 执行 [`supabase/migrations/20260508200000_fix_get_nearby_bars_postgis_path.sql`](../supabase/migrations/20260508200000_fix_get_nearby_bars_postgis_path.sql)（或重新执行已更新的 `20260508120000_slice_a_rpc.sql` 里该函数定义）。若仍报错，在 SQL Editor 执行：`create extension if not exists postgis with schema extensions;`

## Slice B：Auth + 真实入库

- 配置 Supabase **Authentication → URL Configuration → Site URL** 为本地地址，例如 `http://localhost:5173`（与 `npm run dev` 端口一致）。Magic Link 邮件中的跳转依赖此项。  
- 填入 `.env` 后，首次打开应用会进入 **邮箱 Magic Link 登录**；登录后「我今天要去」写入 `visit_plans`，酒单点击写入 `drink_intents`，统计仍由 RPC 聚合（不含 `shell_mode` 用户）。  
- 「我的」里 **龟壳模式 / 匿名昵称 / 老板开关** 会同步到 `profiles`。

## 脚本

- `npm run dev` — 开发
- `npm run build` — 生产构建（含 PWA Service Worker）
