import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // 部署到子路径时改成 '/yishu-review/' 之类的值即可
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon-180x180.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        name: '一数复习 · 高中数学知识体系',
        short_name: '一数复习',
        description:
          '一数（B站 UP 主）高中数学视频知识体系与复习打勾进度本：点知识点直接跳 B站 App 对应分P，看完回来一键打勾。',
        lang: 'zh-CN',
        theme_color: '#FB7299',
        background_color: '#F6F7F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // B站视频封面（运行时缓存，二次打开离线也能看到）
            urlPattern: /^https:\/\/i[0-2]\.hdslb\.com\/bfs\/.*\.(?:jpg|jpeg|png|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bilibili-covers',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // 允许通过局域网 IP / 临时内网穿透域名（serveo、localtunnel、pinggy、cloudflared）访问，
  // 方便手机真机安装 PWA；正式部署到自己的域名后可按需删掉。
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.serveousercontent.com', '.loca.lt', '.pinggy.link', '.lhr.life', '.trycloudflare.com'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.serveousercontent.com', '.loca.lt', '.pinggy.link', '.lhr.life', '.trycloudflare.com'],
  },
})
