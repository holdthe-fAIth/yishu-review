/**
 * 轻量 CDP 客户端 + Edge headless 启动器（零第三方依赖，Node 24 内置 WebSocket）。
 * 供 scripts/screenshot.mjs 与 scripts/e2e-check.mjs 复用。
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class PageCDP {
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
      this.ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')), {
        once: true,
      })
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
    this.listeners.set(
      method,
      handlers.filter((item) => item !== handler),
    )
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

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      throw new Error(
        `页面脚本异常：${JSON.stringify(result.exceptionDetails.exception?.description ?? result.exceptionDetails)}`,
      )
    }
    return result.result?.value
  }

  async navigate(url) {
    const loaded = this.once('Page.loadEventFired')
    await this.send('Page.navigate', { url })
    await loaded
    await sleep(450)
  }

  async reload() {
    const loaded = this.once('Page.loadEventFired')
    await this.send('Page.reload', { ignoreCache: false })
    await loaded
    await sleep(450)
  }

  async screenshotBase64() {
    const result = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    return result.data
  }

  close() {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }
}

export const DEFAULT_EDGE_PATH =
  process.env.EDGE_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

/**
 * 启动 headless Edge（480×900 手机视口，DPR=2）并连上第一个 page target。
 * @returns {Promise<{ cdp: PageCDP, close: () => Promise<void> }>}
 */
export async function launchEdge({ width = 480, height = 900, scale = 2 } = {}) {
  const port = 9400 + Math.floor(Math.random() * 400)
  const userDataDir = join(tmpdir(), `yishu-review-edge-${Date.now()}`)

  const edge = spawn(
    DEFAULT_EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${width},${height}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let target = null
  for (let attempt = 0; attempt < 120 && !target; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await response.json()
      target = targets.find((item) => item.type === 'page')
    } catch {
      // 浏览器还没启动完
    }
    if (!target) await sleep(150)
  }

  if (!target) {
    edge.kill()
    throw new Error('无法连接 Edge 调试端口（检查 EDGE_PATH）')
  }

  const cdp = new PageCDP(target.webSocketDebuggerUrl)
  await cdp.connect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: true,
  })
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

  const close = async () => {
    cdp.close()
    edge.kill()
    await sleep(300)
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }

  return { cdp, close }
}
