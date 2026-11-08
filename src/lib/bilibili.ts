import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'
import type { PlayTarget } from '../types'

/**
 * ⚠️ 分P 起算点：数据里的 p 从 1 开始（p=2 是合集第 2 个分P）。
 * B站 App 深链 `bilibili://video/{bvid}?page=N` 实测多数版本是 1 基（page=1 第一集）。
 *
 * 真机校准方法（提示词要求）：
 *   1. 在手机上点 page=1 和 page=2 各一次，看打开的是第几集；
 *   2. 如果 page=0 才是第一集（0 基），把 PAGE_OFFSET 改成 -1；
 *   3. 如果 page=1 就是第一集，保持 0。
 * 全站只有这一处偏移量，改这里即可。
 */
export const PAGE_OFFSET = 0

export interface PlayLinks {
  /** bilibili:// 深链，唤起 B站 App */
  deep: string
  /** 浏览器兜底地址 */
  web: string
  /** 实际传给 B站的 page 参数（含偏移） */
  page?: number
}

/** 根据跳转目标生成深链 / 网页兜底链接（系统课必须带 page） */
export function buildPlayLinks(target: PlayTarget): PlayLinks {
  const page = typeof target.p === 'number' ? target.p + PAGE_OFFSET : undefined
  const bvid = target.bvid
  const web =
    page !== undefined
      ? `https://www.bilibili.com/video/${bvid}?p=${page}`
      : `https://www.bilibili.com/video/${bvid}`
  const deep = page !== undefined ? `bilibili://video/${bvid}?page=${page}` : `bilibili://video/${bvid}`
  return { deep, web, page }
}

/** Android Chrome / WebView 里最稳的 intent 方案：失败会自动走 browser_fallback_url */
export function buildAndroidIntent(target: PlayTarget): { intent: string; web: string } {
  const { web, page } = buildPlayLinks(target)
  const path = page !== undefined ? `video/${target.bvid}?page=${page}` : `video/${target.bvid}`
  const intent =
    `intent://${path}#Intent;scheme=bilibili;` +
    `package=tv.danmaku.bili;` +
    `S.browser_fallback_url=${encodeURIComponent(web)};end`
  return { intent, web }
}

/** 是否运行在 Capacitor 原生容器（APK）里 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** 打开浏览器版 B站（长按菜单「在浏览器打开」/ 桌面端兜底） */
export async function openInBrowser(target: PlayTarget): Promise<void> {
  const { web } = buildPlayLinks(target)
  if (isNativeApp()) {
    try {
      await AppLauncher.openUrl({ url: web })
      return
    } catch {
      // 落到 window.open
    }
  }
  window.open(web, '_blank', 'noopener,noreferrer')
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|HarmonyOS|Mobile|MicroMessenger/i.test(navigator.userAgent)
}

export type OpenMode = 'app' | 'web'

/**
 * 唤起 B站 App 播放对应视频：
 * - Capacitor APK：@capacitor/app-launcher 原生唤起（Android 11+ 需要 Manifest 包可见性）
 * - Android 浏览器/PWA：intent://（带浏览器兜底）
 * - iOS：bilibili://，1.2s 内没切走则退化浏览器
 * - 桌面：直接新标签页打开网页版（方便验收 page 参数）
 */
export async function openInBilibili(target: PlayTarget): Promise<OpenMode> {
  const { deep, web } = buildPlayLinks(target)

  // 1) APK 原生容器：用 AppLauncher（WebView 里不能直接跳 intent://）
  if (isNativeApp()) {
    try {
      const { value } = await AppLauncher.canOpenUrl({ url: deep })
      if (value) {
        await AppLauncher.openUrl({ url: deep })
        return 'app'
      }
    } catch {
      // canOpenUrl 异常时继续尝试网页兜底
    }
    try {
      await AppLauncher.openUrl({ url: web })
      return 'web'
    } catch {
      window.open(web, '_blank', 'noopener,noreferrer')
      return 'web'
    }
  }

  // 2) Android 浏览器 / PWA
  if (isAndroid()) {
    const { intent } = buildAndroidIntent(target)
    window.location.href = intent
    return 'app'
  }

  // 3) iOS / HarmonyOS 浏览器
  if (isMobile()) {
    window.location.href = deep
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = web
      }
    }, 1200)
    return 'app'
  }

  // 4) 桌面浏览器
  window.open(web, '_blank', 'noopener,noreferrer')
  return 'web'
}

/** 复制用文本：系统课带 page，专题只有 BV 号 */
export function copyTextFor(target: PlayTarget): string {
  return target.bvid
}
