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

/**
 * 原生端尝试用 AppLauncher 打开 URL。
 * 注意：@capacitor/app-launcher v6 的 canOpenUrl 内部是 `getPackageInfo(url)`，
 * 只接受**包名**；传 bilibili:// URL 永远返回 false。
 * 所以这里直接 openUrl，并用返回的 completed 判断是否成功。
 */
async function tryOpenNative(url: string): Promise<boolean> {
  try {
    const result = await AppLauncher.openUrl({ url })
    return Boolean((result as { completed?: boolean } | undefined)?.completed)
  } catch {
    return false
  }
}

/** 打开浏览器版 B站（长按菜单「在浏览器打开」/ 桌面端兜底） */
export async function openInBrowser(target: PlayTarget): Promise<void> {
  const { web } = buildPlayLinks(target)
  if (isNativeApp()) {
    if (await tryOpenNative(web)) return
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
 * - Capacitor APK：直接 AppLauncher.openUrl(深链)，失败再试简化深链，最后浏览器
 * - Android 浏览器/PWA：intent://（带浏览器兜底）
 * - iOS：bilibili://，1.2s 内没切走则退化浏览器
 * - 桌面：直接新标签页打开网页版（方便验收 page 参数）
 */
export async function openInBilibili(target: PlayTarget): Promise<OpenMode> {
  const { deep, web } = buildPlayLinks(target)

  // 1) APK 原生容器：不依赖 canOpenUrl（它对 URL 永远返回 false），直接尝试打开
  if (isNativeApp()) {
    const candidates = [deep, `bilibili://video/${target.bvid}`]
    for (const url of candidates) {
      if (await tryOpenNative(url)) return 'app'
    }
    if (await tryOpenNative(web)) return 'web'
    window.open(web, '_blank', 'noopener,noreferrer')
    return 'web'
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

/* ============ 跳转诊断（「我的 → 设置 → 测试 B站 跳转」用） ============ */

export interface DeepLinkDiagnostics {
  environment: 'APK' | '浏览器 / PWA'
  biliInstalled: boolean | null
  deepUrl: string
  webUrl: string
  detail: string
}

export async function diagnoseBilibiliJump(target: PlayTarget): Promise<DeepLinkDiagnostics> {
  const { deep, web } = buildPlayLinks(target)
  if (!isNativeApp()) {
    return {
      environment: '浏览器 / PWA',
      biliInstalled: null,
      deepUrl: deep,
      webUrl: web,
      detail:
        isAndroid()
          ? '当前是浏览器/PWA 环境，会使用 intent:// 尝试唤起 B站 App（未安装则回退网页版）。若被浏览器拦截，请用系统浏览器打开。'
          : '当前不是 Android 环境，点视频会打开网页版 B站（桌面端行为）。手机安装 APK 后可直接跳 B站 App。',
    }
  }

  let biliInstalled: boolean | null = null
  try {
    // 这里的参数是**包名**，canOpenUrl 实际检查该包是否安装
    const result = await AppLauncher.canOpenUrl({ url: 'tv.danmaku.bili' })
    biliInstalled = Boolean((result as { value?: boolean } | undefined)?.value)
  } catch {
    biliInstalled = null
  }

  return {
    environment: 'APK',
    biliInstalled,
    deepUrl: deep,
    webUrl: web,
    detail: biliInstalled
      ? '已检测到 B站 App（tv.danmaku.bili）。点视频时会直接打开 B站对应分P；如仍跳浏览器，请把此页截图发给开发者。'
      : '未检测到 B站 App 包名 tv.danmaku.bili。请确认已安装「哔哩哔哩」；未安装时会打开网页版。',
  }
}
