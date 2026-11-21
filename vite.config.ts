import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 等子路径部署：VITE_BASE=/仓库名/ pnpm build
const base = process.env.VITE_BASE || '/'
const appBase = base.endsWith('/') ? base : `${base}/`
const isRoot = appBase === '/'
// PWA 在子路径部署时用相对 start_url / scope，scope 会落在仓库子路径下
const pwaRelative = isRoot ? '/' : './'

// https://vitejs.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      // 手动在 main.tsx 里注册（Capacitor APK 内不注册，浏览器 PWA 内注册）
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon-180x180.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        name: '一数复习 · 高中数学 + 高中物理',
        short_name: '一数复习',
        description:
          '一数与黄夫人的高中数学/高中物理视频知识体系与复习打勾进度本：点知识点直接跳 B站 App，看完回来一键打勾。',
        lang: 'zh-CN',
        theme_color: '#FB7299',
        background_color: '#F6F7F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: pwaRelative,
        scope: pwaRelative,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
        navigateFallback: `${appBase}index.html`,
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // B站视频封面（运行时缓存，二次打开离线也能看到）
            urlPattern: /^https:\/\/i[0-2]\.hdslb\.com\/bfs\/.*\.(?:jpg|jpeg|png|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bilibili-covers',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // 允许通过局域网 IP / 临时内网穿透域名访问，方便手机真机安装 PWA
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
