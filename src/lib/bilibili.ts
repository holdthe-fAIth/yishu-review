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

/** 打开浏览器版 B站（长按菜单「在浏览器打开」/ 桌面端兜底） */
export function openInBrowser(target: PlayTarget): void {
  const { web } = buildPlayLinks(target)
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
 * - Android：优先 intent://（带浏览器兜底）
 * - iOS：优先 bilibili://，1.2s 内没切走则退化浏览器
 * - 桌面：直接新标签页打开网页版（方便验收时点开看 page 参数）
 */
export function openInBilibili(target: PlayTarget): OpenMode {
  const { deep, web } = buildPlayLinks(target)

  if (isAndroid()) {
    const { intent } = buildAndroidIntent(target)
    // intent:// 自带 browser_fallback_url，未安装 App 时自动落到网页版
    window.location.href = intent
    return 'app'
  }

  if (isMobile()) {
    // iOS / HarmonyOS：自定义 scheme 唤起；未安装则 1.2s 后兜底
    window.location.href = deep
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = web
      }
    }, 1200)
    return 'app'
  }

  // 桌面浏览器：验收 / 调试时用网页版，避免误触发协议处理器
  window.open(web, '_blank', 'noopener,noreferrer')
  return 'web'
}

/** 复制用文本：系统课带 page，专题只有 BV 号 */
export function copyTextFor(target: PlayTarget): string {
  return target.bvid
}
