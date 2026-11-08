import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置：把 Vite 构建产物（dist/）打包成 Android App。
 * - 构建 APK：pnpm build && npx cap sync android && cd android && ./gradlew assembleDebug
 * - App 内部资源全部本地，断网可用；点知识点通过 @capacitor/app-launcher 唤起 B站 App
 */
const config: CapacitorConfig = {
  appId: 'com.yishu.review',
  appName: '一数复习',
  webDir: 'dist',
  android: {
    // B站封面与深链都是 https，禁用明文流量
    allowMixedContent: false,
  },
}

export default config
