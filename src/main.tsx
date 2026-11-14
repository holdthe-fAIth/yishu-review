import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import './index.css'

// PWA：只在浏览器里注册 Service Worker（离线缓存）；
// Capacitor APK 的资源本身就在本地，注册 SW 反而会报错，所以跳过。
// 注意：这里不 import 'virtual:pwa-register'（它依赖 workbox-window，会让 CI 安装不完整时构建失败），
// 直接手动注册构建产物里的 sw.js，路径用 BASE_URL 兼容 GitHub Pages 子路径部署。
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    void navigator.serviceWorker.register(swUrl).catch(() => {
      // 注册失败不影响主流程（例如本地 http 非 localhost）
    })
  })
}

const container = document.getElementById('root')
if (!container) throw new Error('#root 不存在')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
