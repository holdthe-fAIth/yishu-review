import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// PWA：只在浏览器里注册 Service Worker（离线缓存）；
// Capacitor APK 的资源本身就在本地，注册 SW 反而会报错，所以跳过。
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
}

const container = document.getElementById('root')
if (!container) throw new Error('#root 不存在')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
