import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'VinoHide · 隐醺',
        short_name: '隐醺',
        description: '夜色中的匿名酒吧地图与轻社交',
        theme_color: '#1a1a2e',
        background_color: '#12121c',
        display: 'standalone',
        lang: 'zh-CN',
      },
    }),
  ],
})
