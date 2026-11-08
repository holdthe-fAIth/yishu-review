#!/usr/bin/env node
/**
 * 视觉验收脚本：用 Edge headless + CDP 打开构建产物，注入本地进度数据，
 * 截取 480px 手机视口下各页面（浅色/暗色/返回浮条/搜索）的截图。
 *
 * 前置：先构建并启动预览服务
 *   npm run build
 *   npx vite preview --port 4173
 * 运行：
 *   node scripts/screenshot.mjs
 * 产物：
 *   screenshots/*.png
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const OUT_DIR = join(root, 'screenshots')
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:4173/'
const EDGE_PATH =
  process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const STORAGE_KEY = 'yishu-review:state:v1'
const PORT = 9400 + Math.floor(Math.random() * 300)

const VIEWPORT = { width: 480, height: 900, scale: 2 }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function done(keys) {
  const now = Date.now()
  const record = {}
  keys.forEach((key, index) => {
    record[key] = { at: now - (keys.length - index) * 3_600_000 }
  })
  return record
}

const DONE_KEYS = [
  's:5', 's:6', 's:7', 's:11', 's:12', 's:13', 's:14', 's:18', 's:19', 's:20',
  's:22', 's:31', 's:32', 's:43', 's:44', 's:45', 's:69', 's:70', 's:85', 's:87',
  's:119', 's:130', 's:149', 's:162', 's:183', 's:187', 't:8397438:BV1cE4m1R7YK',
]

function buildState(overrides = {}) {
  return {
    v: 1,
    done: done(DONE_KEYS),
    settings: { confirmBeforeJump: false, returnPrompt: true, theme: 'light' },
    ...overrides,
  }
}

const SCENARIOS = [
  { name: '01-home-fresh', state: null, tab: 0 },
  { name: '02-home-progress', state: buildState(), tab: 0 },
  { name: '03-knowledge', state: buildState(), tab: 1, expandModule: 1 },
  { name: '04-mine', state: buildState(), tab: 2 },
  {
    name: '05-home-dark',
    state: buildState({ settings: { confirmBeforeJump: false, returnPrompt: true, theme: 'dark' } }),
    tab: 0,
  },
  {
    name: '06-return-bar',
    state: buildState({
      pending: { key: 's:8', name: '综合大题练习', at: Date.now() - 31_000 },
    }),
    tab: 0,
  },
  { name: '07-search', state: buildState(), tab: 0, search: '函数' },
  { name: '08-topics', state: buildState(), tab: 0, segmented: 1 },
  {
    name: '09-knowledge-dark',
    state: buildState({
      settings: { confirmBeforeJump: false, returnPrompt: true, theme: 'dark' },
    }),
    tab: 1,
    expandModule: 17,
  },
  { name: '10-mine-dark', state: buildState({ settings: { confirmBeforeJump: false, returnPrompt: true, theme: 'dark' } }), tab: 2 },
]

class PageCDP {
  constructor(url) {
    this.url = url
    this.ws = null
    this.seq = 0
    this.pending = new Map()
    this.listeners = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.url)
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', () => reject(new Error('WS 连接失败')), { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const text = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString()
      const message = JSON.parse(text)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
      } else if (message.method) {
        const handlers = this.listeners.get(message.method) || []
        for (const handler of handlers) handler(message.params)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || []
    handlers.push(handler)
    this.listeners.set(method, handlers)
  }

  off(method, handler) {
    const handlers = this.listeners.get(method) || []
    this.listeners.set(method, handlers.filter((item) => item !== handler))
  }

  once(method, timeout = 20_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(method, handler)
        reject(new Error(`等待事件超时：${method}`))
      }, timeout)
      const handler = (params) => {
        clearTimeout(timer)
        this.off(method, handler)
        resolve(params)
      }
      this.on(method, handler)
    })
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(`页面脚本异常：${JSON.stringify(result.exceptionDetails.exception?.description)}`)
  }
  return result.result?.value
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  await loaded
  await sleep(500)
}

async function loadWithState(cdp, state) {
  await navigate(cdp, APP_URL)
  if (state) {
    const json = JSON.stringify(state)
    await evaluate(
      cdp,
      `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(json)})`,
    )
  } else {
    await evaluate(cdp, `localStorage.removeItem(${JSON.stringify(STORAGE_KEY)})`)
  }
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.reload', { ignoreCache: false })
  await loaded
  await sleep(700)
}

async function screenshot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const path = join(OUT_DIR, `${name}.png`)
  writeFileSync(path, Buffer.from(result.data, 'base64'))
  console.log(`  ✓ ${name}.png`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const userDataDir = join(tmpdir(), `yishu-review-shot-${Date.now()}`)

  const edge = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=' + VIEWPORT.scale,
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let cdp = null
  try {
    let target = null
    for (let attempt = 0; attempt < 120 && !target; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
        const targets = await response.json()
        target = targets.find((item) => item.type === 'page')
      } catch {
        // 浏览器还没起来
      }
      if (!target) await sleep(150)
    }
    if (!target) throw new Error('无法连接 Edge 调试端口')

    cdp = new PageCDP(target.webSocketDebuggerUrl)
    await cdp.connect()
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: VIEWPORT.scale,
      mobile: true,
    })
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

    console.log(`截图目标：${APP_URL}`)
    const only = process.env.SHOT_ONLY ? process.env.SHOT_ONLY.split(',') : null
    const scenarios = only ? SCENARIOS.filter((item) => only.some((key) => item.name.includes(key))) : SCENARIOS
    for (const scenario of scenarios) {
      console.log(`\n[${scenario.name}]`)
      await loadWithState(cdp, scenario.state ?? null)

      if (scenario.tab > 0) {
        await evaluate(
          cdp,
          `document.querySelectorAll('.tabbar__item')[${scenario.tab}]?.click(); true`,
        )
        await sleep(650)
      }

      if (scenario.segmented !== undefined) {
        await evaluate(
          cdp,
          `document.querySelectorAll('.segmented__item')[${scenario.segmented}]?.click(); true`,
        )
        await sleep(650)
      }

      if (scenario.expandModule !== undefined) {
        await evaluate(
          cdp,
          `document.querySelectorAll('.k-module__head')[${scenario.expandModule}]?.click(); true`,
        )
        await sleep(550)
      }

      if (scenario.search) {
        await evaluate(
          cdp,
          `document.querySelector('.page-head .icon-btn')?.click(); true`,
        )
        await sleep(450)
        await evaluate(
          cdp,
          `(() => {
            const input = document.querySelector('.search-page input');
            if (!input) return false;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, ${JSON.stringify(scenario.search)});
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          })()`,
        )
        await sleep(700)
      }

      // 等封面图 / 动画稳定（B站图床偶尔较慢，避免截图捕捉到渐变兜底）
      await sleep(scenario.name.includes('topic') || scenario.segmented !== undefined ? 1800 : 900)

      const coverDebug = await evaluate(
        cdp,
        `(() => {
          const covers = [...document.querySelectorAll('.cp-card .cover--remote')]
          if (!covers.length) return null
          return {
            total: covers.length,
            fallback: covers.filter((cover) => cover.querySelector('.cover__char')).length,
            loaded: covers.filter((cover) => {
              const img = cover.querySelector('img')
              return img && img.complete && img.naturalWidth > 0
            }).length,
            failedTitles: covers
              .filter((cover) => cover.querySelector('.cover__char'))
              .map((cover) => (cover.closest('.cp-card')?.querySelector('.cp-card__title')?.textContent ?? '').slice(0, 12)),
          }
        })()`,
      )
      if (coverDebug && coverDebug.fallback > 0) {
        console.log(`  [debug] 封面未加载: ${JSON.stringify(coverDebug)}`)
      }

      await screenshot(cdp, scenario.name)

      const summary = await evaluate(
        cdp,
        `document.querySelector('main')?.innerText?.slice(0, 500) ?? ''`,
      )
      console.log(
        '  ' +
          String(summary)
            .replace(/\s+/g, ' ')
            .slice(0, 220),
      )
    }

    console.log('\n截图全部完成 → screenshots/')
  } finally {
    if (cdp) cdp.close()
    edge.kill()
    await sleep(300)
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error('截图失败：', error)
  process.exit(1)
})
