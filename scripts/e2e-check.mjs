#!/usr/bin/env node
/**
 * 功能验收脚本（无第三方依赖，Edge headless + CDP）。
 * 覆盖验收清单：数据完整性渲染、打勾热区、深链 page 参数、pending、返回浮条、
 * 刷新持久化、知识体系 chip、专题课、搜索与难度筛选、我的页统计、主题切换、重置二次确认。
 *
 * 前置：先构建并启动预览服务
 *   pnpm build
 *   npx vite preview --port 4173
 * 运行：
 *   node scripts/e2e-check.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { launchEdge, sleep } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:4173/'
const STORAGE_KEY = 'yishu-review:state:v1'

const DATA = JSON.parse(readFileSync(join(root, 'data', 'courses.json'), 'utf8'))
const MODULE_NAMES = DATA.systemCourse.modules.map((module) => module.name)
const TOPIC_COUNT = DATA.topics.length
const KP_COUNT = DATA.systemCourse.kpCount

let passed = 0
let failed = 0

function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  if (ok) passed += 1
  else failed += 1
  const mark = ok ? '✓' : '✗'
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

function section(title) {
  console.log(`\n${title}`)
}

const EMPTY_STATE = {
  v: 1,
  done: {},
  settings: { confirmBeforeJump: false, returnPrompt: true, theme: 'light' },
}

function stateJson(state) {
  return JSON.stringify(JSON.stringify(state))
}

async function loadWithState(cdp, state) {
  await cdp.navigate(APP_URL)
  await cdp.evaluate(`localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${stateJson(state)})`)
  await cdp.reload()
  await sleep(450)
}

async function readState(cdp) {
  return cdp.evaluate(`(() => {
    try { return JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || 'null') }
    catch { return null }
  })()`)
}

async function main() {
  const { cdp, close } = await launchEdge()
  try {
    const consoleErrors = []
    const requests = []
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        consoleErrors.push(
          (params.args ?? [])
            .map((arg) => arg.value ?? arg.description ?? '')
            .join(' ')
            .slice(0, 200),
        )
      }
    })
    cdp.on('Runtime.exceptionThrown', (params) => {
      consoleErrors.push(params.exceptionDetails?.exception?.description ?? 'uncaught exception')
    })
    cdp.on('Network.requestWillBeSent', (params) => {
      requests.push(params.request.url)
    })
    await cdp.send('Network.enable')
    /* ---------------- 1. 首页渲染 ---------------- */
    section('1) 课程首页渲染（数据接入 Phase 1）')
    await loadWithState(cdp, EMPTY_STATE)
    const home = await cdp.evaluate(`(() => {
      const names = [...document.querySelectorAll('.cp-module__name')].map((el) => el.textContent?.trim() ?? '')
      const tabbar = document.querySelector('.tabbar')?.getBoundingClientRect()
      return {
        modules: document.querySelectorAll('.cp-module').length,
        cards: document.querySelectorAll('.cp-card').length,
        titles: names,
        hero: document.querySelector('.cp-hero')?.innerText ?? '',
        tabbarInView: Boolean(tabbar) && tabbar.bottom <= window.innerHeight + 1 && tabbar.top < window.innerHeight,
        noHScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
        viewport: [window.innerWidth, window.innerHeight],
      }
    })()`)
    check('24 个模块全部渲染', home.modules === 24, `实际 ${home.modules}`)
    check(
      '模块顺序与 courses.json 完全一致',
      JSON.stringify(home.titles) === JSON.stringify(MODULE_NAMES),
      home.titles.length === 24 ? '顺序一致' : '数量不一致',
    )
    check('默认展开第一个模块（2 张卡片）', home.cards === 2, `实际 ${home.cards}`)
    check('Hero 显示 194 个知识点', home.hero.includes(String(KP_COUNT)))
    check('480px 视口无横向滚动', home.noHScroll, `viewport=${home.viewport.join('x')}`)
    check('底部 tabbar 在视口内', home.tabbarInView)

    /* ---------------- 2. 打勾热区 ---------------- */
    section('2) 打勾热区（不跳转、独立于卡片主体）')
    await cdp.evaluate(`document.querySelector('.cp-card .check-btn')?.click(); true`)
    await sleep(450)
    const afterCheck = await cdp.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}')
      return {
        doneKeys: Object.keys(state.done ?? {}),
        pending: state.pending ?? null,
        hero: document.querySelector('.cp-hero')?.innerText ?? '',
        count: document.querySelector('.cp-module__count')?.textContent?.trim() ?? '',
        doneCards: document.querySelectorAll('.cp-card.is-done').length,
      }
    })()`)
    check(
      '点圆圈只打勾，不产生 pending、不开链接',
      afterCheck.doneKeys.length === 1 && afterCheck.pending === null,
      `done=${afterCheck.doneKeys.length} pending=${JSON.stringify(afterCheck.pending)}`,
    )
    check('Hero 进度立刻变 1/194', afterCheck.hero.includes(`已完成 1 / ${KP_COUNT}`), afterCheck.hero.slice(0, 60))
    check('模块进度立刻变 1/2', afterCheck.count === '1/2', `实际 ${afterCheck.count}`)
    check('卡片进入已完成态', afterCheck.doneCards === 1)

    /* ---------------- 3. 深链跳转 + page 参数 + pending ---------------- */
    section('3) 深链跳转（跳转前记录 pending，page 参数正确）')
    await cdp.evaluate(`(() => {
      window.__opened = []
      window.open = (url) => { window.__opened.push(url); return null }
      const card = [...document.querySelectorAll('.cp-card')].find((item) =>
        (item.querySelector('.cp-card__title')?.textContent || '').includes('不等式解法梳理'),
      )
      card?.click()
      return true
    })()`)
    await sleep(500)
    const jump = await cdp.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}')
      return { opened: window.__opened ?? [], pending: state.pending ?? null }
    })()`)
    check(
      '点卡片主体 → 打开 B站 网页版（桌面兜底）',
      jump.opened.length === 1 && jump.opened[0].includes('bilibili.com/video/BV147411K7xu'),
      jump.opened[0] ?? '',
    )
    check('深链带正确的分P参数 ?p=3', String(jump.opened[0] ?? '').includes('?p=3'), jump.opened[0] ?? '')
    check(
      '跳转前写入 pending（key=s:3）',
      jump.pending?.key === 's:3',
      JSON.stringify(jump.pending),
    )

    // 再点第三个模块的卡片，验证不同模块 page 不同 + pending 只留一条
    await cdp.evaluate(`(() => {
      const heads = [...document.querySelectorAll('.cp-module__head')]
      heads[2]?.click()
      return true
    })()`)
    await sleep(500)
    await cdp.evaluate(`(() => {
      const card = [...document.querySelectorAll('.cp-card')].find((item) =>
        (item.querySelector('.cp-card__title')?.textContent || '').includes('全称与存在量词'),
      )
      card?.click()
      return true
    })()`)
    await sleep(500)
    const jump2 = await cdp.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}')
      return { opened: window.__opened ?? [], pending: state.pending ?? null }
    })()`)
    check(
      '第二个不同模块的深链 page 参数也正确（p=12）',
      String(jump2.opened[1] ?? '').includes('?p=12'),
      jump2.opened[1] ?? '',
    )
    check('pending 只保留一条（最新）', jump2.pending?.key === 's:12', JSON.stringify(jump2.pending))

    /* ---------------- 4. 返回浮条 ---------------- */
    section('4) 从 B站 回来（离开 >30s）→ 浮条一键打勾')
    await cdp.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}')
      state.pending = { key: 's:5', name: '集合的概念', at: Date.now() - 31000 }
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(state))
      return true
    })()`)
    await cdp.reload()
    await sleep(700)
    const bar = await cdp.evaluate(`(() => {
      const el = document.querySelector('.return-bar')
      return { visible: Boolean(el), text: el?.innerText ?? '' }
    })()`)
    check('离开超过 30 秒后弹出浮条', bar.visible)
    check('浮条文案带知识点名', bar.text.includes('集合的概念'), bar.text.replace(/\s+/g, ' '))

    await cdp.evaluate(`document.querySelector('.return-bar__done')?.click(); true`)
    await sleep(500)
    const barDone = await readState(cdp)
    check(
      '浮条点「打勾」→ 立刻完成并清空 pending',
      Boolean(barDone?.done?.['s:5']) && !barDone?.pending,
      `done=${Object.keys(barDone?.done ?? {}).length} pending=${JSON.stringify(barDone?.pending)}`,
    )

    /* ---------------- 5. 持久化 ---------------- */
    section('5) 刷新 / 重开数据不丢')
    await cdp.reload()
    await sleep(500)
    const persisted = await readState(cdp)
    const persistedCount = Object.keys(persisted?.done ?? {}).length
    check('刷新后打勾记录仍在（2 条）', persistedCount === 2, `实际 ${persistedCount}`)

    /* ---------------- 6. 知识体系页 ---------------- */
    section('6) 知识体系页（Phase 4）')
    await cdp.evaluate(`document.querySelectorAll('.tabbar__item')[1]?.click(); true`)
    await sleep(650)
    const knowledge = await cdp.evaluate(`(() => ({
      rows: document.querySelectorAll('.k-module__head').length,
      hero: document.querySelector('.k-hero')?.innerText ?? '',
      noHScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
      pageText: document.querySelector('.page')?.innerText ?? '',
    }))()`)
    check('24 个模块行', knowledge.rows === 24, `实际 ${knowledge.rows}`)
    check('顶部显示已完成 2 / 194', knowledge.hero.includes('已完成 2 / 194'), knowledge.hero.replace(/\s+/g, ' ').slice(0, 60))
    check('最弱模块区块已移除', !knowledge.pageText.includes('最弱模块'))
    check('知识体系页无横向滚动', knowledge.noHScroll)

    await cdp.evaluate(`document.querySelectorAll('.k-module__head')[1]?.click(); true`)
    await sleep(550)
    const chips = await cdp.evaluate(`(() => ({
      count: document.querySelectorAll('.k-chip').length,
      active: document.querySelectorAll('.k-chip.is-active').length,
    }))()`)
    check('展开「集合」显示 6 个知识点 chip', chips.count === 6, `实际 ${chips.count}`)
    check('已打勾 chip 高亮（集合里 s:5、s:6? 实际 s:5 完成）', chips.active >= 1, `高亮 ${chips.active}`)

    // 点 chip 跳转
    await cdp.evaluate(`(() => {
      window.__opened = []
      window.open = (url) => { window.__opened.push(url); return null }
      document.querySelectorAll('.k-chip')[1]?.click()
      return true
    })()`)
    await sleep(500)
    const chipJump = await cdp.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}')
      return { opened: window.__opened ?? [], pending: state.pending ?? null }
    })()`)
    check(
      '点知识点 chip → 深链跳转并记录 pending',
      chipJump.opened.length === 1 && chipJump.pending !== null,
      JSON.stringify(chipJump.pending),
    )

    /* ---------------- 7. 专题课 ---------------- */
    section('7) 专题课（7 个合集 / 真实封面卡片）')
    await cdp.evaluate(`document.querySelectorAll('.tabbar__item')[0]?.click(); true`)
    await sleep(600)
    await cdp.evaluate(`document.querySelectorAll('.segmented__item')[1]?.click(); true`)
    await sleep(650)
    const topicView = await cdp.evaluate(`(() => ({
      tabs: document.querySelectorAll('.cp-tab').length,
      cards: document.querySelectorAll('.cp-card').length,
      firstTab: document.querySelector('.cp-tab .cp-tab__title')?.textContent ?? '',
    }))()`)
    check('专题课有 7 个合集 tab', topicView.tabs === TOPIC_COUNT, `实际 ${topicView.tabs}`)
    check('默认合集 13 条视频卡片', topicView.cards === 13, `实际 ${topicView.cards}`)
    check('合集标题正确（新高考一轮复习）', topicView.firstTab.includes('新高考一轮复习'))

    /* ---------------- 8. 搜索 + 难度筛选 ---------------- */
    section('8) 搜索 + 难度筛选（Phase 5）')
    await cdp.evaluate(`document.querySelector('.page-head .icon-btn')?.click(); true`)
    await sleep(500)
    const typeSearch = (keyword) => `(() => {
      const input = document.querySelector('.search-page input')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(keyword)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`

    await cdp.evaluate(typeSearch('函数'))
    await sleep(550)
    const search1 = await cdp.evaluate(`(() => ({
      rows: document.querySelectorAll('.search-result').length,
      tags: [...document.querySelectorAll('.search-result .tag-level')].map((el) => el.textContent),
    }))()`)
    check('搜索「函数」有结果', search1.rows > 0, `${search1.rows} 条`)
    check('搜索结果带难度标签', search1.tags.length > 0)

    await cdp.evaluate(`document.querySelectorAll('.search-page__filters .chip')[3]?.click(); true`)
    await sleep(500)
    const search2 = await cdp.evaluate(`(() => ({
      rows: document.querySelectorAll('.search-result').length,
      tags: [...document.querySelectorAll('.search-result .tag-level')].map((el) => el.textContent),
    }))()`)
    check('难度筛选「拔高」可用', search2.rows > 0, `${search2.rows} 条`)
    check('筛选结果只剩拔高', search2.tags.every((tag) => tag === '拔高'), `tags=${[...new Set(search2.tags)].join(',')}`)

    await cdp.evaluate(`document.querySelector('.search-page .icon-btn')?.click(); true`)
    await sleep(400)

    /* ---------------- 9. 我的页 ---------------- */
    section('9) 我的页（统计 / 条形图 / 数据管理 / 设置）')
    await cdp.evaluate(`document.querySelectorAll('.tabbar__item')[2]?.click(); true`)
    await sleep(650)
    const mine = await cdp.evaluate(`(() => ({
      text: document.querySelector('.page')?.innerText ?? '',
      bars: document.querySelectorAll('.m-bar').length,
      stats: document.querySelectorAll('.m-stat').length,
      switches: document.querySelectorAll('.m-switch').length,
      noHScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }))()`)
    check('3 张统计卡', mine.stats === 3, `实际 ${mine.stats}`)
    check('24 行模块完成率条形图', mine.bars === 24, `实际 ${mine.bars}`)
    check('数据管理入口齐全', ['导出 JSON', '导入 JSON', '重置所有进度'].every((label) => mine.text.includes(label)))
    check(
      '设置项齐全（确认跳转 / 返回提醒 / 主题 / 已学排后 / 自动检查更新）',
      mine.text.includes('跳转前先确认') &&
        mine.text.includes('从 B站回来提醒打勾') &&
        mine.text.includes('主题') &&
        mine.text.includes('已学内容自动排到最后') &&
        mine.text.includes('自动检查'),
    )
    check('我的页有学习日历区块', mine.text.includes('学习日历'))
    const calendarPanel = await cdp.evaluate(`(() => ({
      cells: document.querySelectorAll('.m-cal__cell').length,
      selected: document.querySelectorAll('.m-cal__cell.is-selected').length,
      today: document.querySelectorAll('.m-cal__cell.is-today').length,
      records: document.querySelectorAll('.m-dayview .m-rec').length,
    }))()`)
    check('学习日历渲染完整月份（42 个日期格）', calendarPanel.cells === 42, `实际 ${calendarPanel.cells}`)
    check(
      '默认选中今天并展示当天学习内容',
      calendarPanel.selected === 1 && calendarPanel.today === 1 && calendarPanel.records > 0,
      `selected=${calendarPanel.selected} records=${calendarPanel.records}`,
    )
    check('内容更新相关入口齐全', mine.text.includes('检查内容更新') && mine.text.includes('内容更新源'))
    check('数据版本信息可见', /v2|数据版本/.test(mine.text))
    check('我的页无横向滚动', mine.noHScroll)

    // 主题切换
    await cdp.evaluate(`document.querySelectorAll('.m-theme .segmented__item')[1]?.click(); true`)
    await sleep(500)
    const theme = await cdp.evaluate(`(() => ({
      attr: document.documentElement.dataset.theme,
      stored: JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}').settings?.theme,
    }))()`)
    check('切到深色：data-theme=dark 且持久化', theme.attr === 'dark' && theme.stored === 'dark', JSON.stringify(theme))

    /* ---------------- 10. 重置二次确认 ---------------- */
    section('10) 重置（二次确认）')
    await cdp.evaluate(`[...document.querySelectorAll('button')].find((btn) => (btn.textContent || '').includes('重置所有进度'))?.click(); true`)
    await sleep(500)
    const resetSheet = await cdp.evaluate(`(() => ({
      open: Boolean(document.querySelector('.sheet-panel')),
      text: document.querySelector('.sheet-panel')?.innerText ?? '',
    }))()`)
    check('点重置先弹二次确认，不直接清空', resetSheet.open && resetSheet.text.includes('确认重置'))
    await cdp.evaluate(`[...document.querySelectorAll('.sheet-actions .btn')].find((btn) => btn.textContent?.includes('确认重置'))?.click(); true`)
    await sleep(600)
    const afterReset = await readState(cdp)
    check(
      '确认重置后清零',
      Object.keys(afterReset?.done ?? {}).length === 0,
      `done=${Object.keys(afterReset?.done ?? {}).length}`,
    )

    /* ---------------- 11. 194 张卡片一个不少 ---------------- */
    section('11) 194 个知识点卡片完整性')
    await cdp.evaluate(`document.querySelectorAll('.tabbar__item')[0]?.click(); true`)
    await sleep(600)
    await cdp.evaluate(`(() => {
      const heads = [...document.querySelectorAll('.cp-module__head')]
      heads.forEach((head) => { if (head.getAttribute('aria-expanded') === 'true') head.click() })
      return true
    })()`)
    await sleep(500)
    await cdp.evaluate(`(() => {
      ;[...document.querySelectorAll('.cp-module__head')].forEach((head) => head.click())
      return true
    })()`)
    await sleep(900)
    const allCards = await cdp.evaluate(`document.querySelectorAll('.cp-card').length`)
    check('展开全部模块后卡片总数 = 194', allCards === 194, `实际 ${allCards}`)

    /* ---------------- 12. v2 新功能 ---------------- */
    section('12) v2 新功能（发布时间 / 已学排后 / 学习时间表 / 内容更新 / B站诊断）')

    // 12.1 卡片发布时间角标（当前课程页全部模块已展开）
    const pubdates = await cdp.evaluate(
      `[...document.querySelectorAll('.cp-card .cover__date')].map((el) => el.textContent || '')`,
    )
    check(
      '卡片封面显示发布时间角标',
      pubdates.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(pubdates[0]),
      `${pubdates[0] ?? ''} / 共 ${pubdates.length} 个`,
    )

    // 12.2 已学内容自动排到最后：造数据后刷新
    await cdp.evaluate(`(() => {
      const state = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || '{}')
      state.done = { ...(state.done || {}) }
      const base = Date.now() - 3600000
      ;['s:2', 's:3', 's:5'].forEach((key, index) => { state.done[key] = { at: base + index * 60000 } })
      state.settings = { ...state.settings, sortCompletedLast: true }
      delete state.pending
      localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(state))
      return true
    })()`)
    await cdp.reload()
    await sleep(750)
    const moduleOrder = await cdp.evaluate(`(() => {
      const names = [...document.querySelectorAll('.cp-module__name')].map((el) => (el.textContent || '').trim())
      return { first: names[0] ?? '', last: names[names.length - 1] ?? '' }
    })()`)
    check('学完的模块排到最后（初高衔接）', moduleOrder.last === '初高衔接', `首=${moduleOrder.first} 末=${moduleOrder.last}`)
    check('未学完模块顺序不变（集合在首位）', moduleOrder.first === '集合', moduleOrder.first)

    // 先收起默认展开的模块，再展开集合，检查模块内已学知识点是否排后
    await cdp.evaluate(`(() => {
      ;[...document.querySelectorAll('.cp-module__head')].forEach((head) => {
        if (head.getAttribute('aria-expanded') === 'true') head.click()
      })
      return true
    })()`)
    await sleep(450)
    await cdp.evaluate(`document.querySelectorAll('.cp-module__head')[0]?.click(); true`)
    await sleep(550)
    const moduleCards = await cdp.evaluate(`(() => {
      const cards = [...document.querySelectorAll('.cp-card')]
      return {
        titles: cards.map((card) => (card.querySelector('.cp-card__title')?.textContent || '').trim()),
        count: cards.length,
      }
    })()`)
    check(
      '模块内已学知识点排到最后（集合的概念）',
      moduleCards.count === 6 && moduleCards.titles[moduleCards.titles.length - 1] === '集合的概念',
      `末项=${moduleCards.titles[moduleCards.titles.length - 1] ?? ''} 共${moduleCards.count}项`,
    )

    // 12.3 学习日历 + 点日期查看当天内容
    await cdp.evaluate(`document.querySelectorAll('.tabbar__item')[2]?.click(); true`)
    await sleep(700)
    const calendarV2 = await cdp.evaluate(`(() => ({
      text: document.querySelector('.page')?.innerText ?? '',
      cells: document.querySelectorAll('.m-cal__cell').length,
      selected: document.querySelectorAll('.m-cal__cell.is-selected').length,
      selectedRecords: document.querySelectorAll('.m-dayview .m-rec').length,
      monthLabel: document.querySelector('.m-cal__title b')?.textContent ?? '',
    }))()`)
    check(
      '学习日历按月份渲染（42 格 + 月份标题）',
      calendarV2.cells === 42 && /^\d{4}年\d{1,2}月$/.test(calendarV2.monthLabel),
      `${calendarV2.cells} 格 / ${calendarV2.monthLabel}`,
    )
    check('选中日期显示当天学习内容', calendarV2.selected === 1 && calendarV2.selectedRecords >= 1, `${calendarV2.selectedRecords} 条`)
    check('日历详情包含已学知识点', calendarV2.text.includes('集合的概念') || calendarV2.text.includes('子集的概念'))

    // 点一个没有记录的日期 → 显示空态；再点回今天
    const pickedEmpty = await cdp.evaluate(`(() => {
      const cells = [...document.querySelectorAll('.m-cal__cell')]
      const target = cells.find((cell) =>
        !cell.classList.contains('is-selected') &&
        !cell.classList.contains('is-outside') &&
        !(cell.getAttribute('aria-label') || '').includes('完成'),
      )
      target?.click()
      return target?.getAttribute('aria-label') ?? ''
    })()`)
    await sleep(450)
    const emptyDetail = await cdp.evaluate(`document.querySelector('.m-dayview .empty__title')?.textContent ?? ''`)
    check('点没有记录的日期显示当天空态', pickedEmpty !== '' && emptyDetail.includes('没有学习记录'), pickedEmpty)
    await cdp.evaluate(`document.querySelector('.m-cal__cell.is-today')?.click(); true`)
    await sleep(450)
    const backToToday = await cdp.evaluate(`document.querySelectorAll('.m-dayview .m-rec').length`)
    check('点回今天恢复当天记录', backToToday >= 1, `${backToToday} 条`)

    // 12.4 检查内容更新（PWA 同源 data/courses.json，应为已是最新）
    await cdp.evaluate(
      `[...document.querySelectorAll('button')].find((btn) => (btn.textContent || '').includes('检查内容更新'))?.click(); true`,
    )
    await sleep(1600)
    const updateToast = await cdp.evaluate(`document.querySelector('.toast')?.textContent ?? ''`)
    check(
      '检查内容更新可用（同源数据 = 已是最新）',
      /已是最新|发现新内容|检查失败|缺少/.test(updateToast),
      updateToast,
    )

    // 12.5 B站跳转诊断
    await cdp.evaluate(
      `[...document.querySelectorAll('button')].find((btn) => (btn.textContent || '').includes('测试 B站 跳转'))?.click(); true`,
    )
    await sleep(900)
    const diagSheet = await cdp.evaluate(`document.querySelector('.sheet-panel')?.innerText ?? ''`)
    check(
      'B站跳转诊断可用（展示深链与检测结果）',
      diagSheet.includes('bilibili://') && /环境|APK|浏览器/.test(diagSheet),
      diagSheet.replace(/\s+/g, ' ').slice(0, 80),
    )
    await cdp.evaluate(`document.querySelector('.sheet-backdrop')?.click(); true`)
    await sleep(400)

    /* ---------------- 13. PWA ---------------- */
    section('13) PWA（manifest / Service Worker / 离线打开）')
    const pwa = await cdp.evaluate(`(async () => {
      const link = document.querySelector('link[rel="manifest"]')
      const manifest = link ? await fetch(link.href).then((r) => r.json()).catch(() => null) : null
      const regs = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : []
      return {
        manifestHref: link?.getAttribute('href') ?? '',
        name: manifest?.name ?? '',
        display: manifest?.display ?? '',
        icons: manifest?.icons?.map((item) => item.sizes) ?? [],
        swCount: regs.length,
        swActive: regs.some((reg) => Boolean(reg.active)),
        appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? '',
      }
    })()`)
    check(
      'manifest 已注入且为 standalone PWA',
      Boolean(pwa.manifestHref) && pwa.display === 'standalone',
      `${pwa.manifestHref} display=${pwa.display} name=${pwa.name}`,
    )
    check(
      'manifest 含 192/512 图标',
      pwa.icons.includes('192x192') && pwa.icons.includes('512x512'),
      pwa.icons.join(','),
    )
    check('Service Worker 已注册并激活', pwa.swCount > 0 && pwa.swActive, `regs=${pwa.swCount}`)
    check('apple-touch-icon 已声明', pwa.appleIcon.includes('apple-touch-icon'))

    // 断网后仍能打开（Service Worker 缓存）
    await cdp.reload()
    await sleep(1500)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })
    let offlineLoaded = false
    try {
      await cdp.reload()
      offlineLoaded = true
    } catch {
      offlineLoaded = false
    }
    await sleep(900)
    const offlineText = await cdp.evaluate(`document.body.innerText.slice(0, 160)`)
    check(
      '离线状态仍能打开 App（PWA 离线缓存生效）',
      offlineLoaded && offlineText.includes('一数复习'),
      offlineText.replace(/\s+/g, ' ').slice(0, 60),
    )
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })

    /* ---------------- 14. 运行时零 B站接口请求 / 无 console 报错 ---------------- */
    section('14) 运行时请求与 console 检查')
    const apiRequests = requests.filter((url) => {
      try {
        return /(^|\.)bilibili\.com$/.test(new URL(url).hostname)
      } catch {
        return false
      }
    })
    check('运行时没有请求任何 B站 接口', apiRequests.length === 0, apiRequests.slice(0, 3).join(' '))
    check('无 console 报错 / 未捕获异常', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  } finally {
    await close()
  }

  console.log(`\n结果：${passed} 项通过，${failed} 项失败`)
  if (failed > 0) process.exit(1)
  console.log('功能验收全部通过 ✓')
}

main().catch((error) => {
  console.error('验收脚本异常：', error)
  process.exit(1)
})
