#!/usr/bin/env node
/**
 * 课程数据完整性校验（验收清单用）
 * 运行：npm run verify:data
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(here, '../data/courses.json'), 'utf8'))

let failures = 0
function check(name, pass, detail = '') {
  const ok = Boolean(pass)
  if (!ok) failures += 1
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  return ok
}

const modules = data.systemCourse?.modules ?? []
const topics = data.topics ?? []
const items = modules.flatMap((m) => m.items ?? [])
const videos = topics.flatMap((t) => t.videos ?? [])

console.log('课程数据校验：')
check('up.mid = 14229967', data.up?.mid === 14229967, `实际 ${data.up?.mid}`)
check('系统课 bvid = BV147411K7xu', data.systemCourse?.bvid === 'BV147411K7xu')
check('模块数 = 24', modules.length === 24, `实际 ${modules.length}`)
check('知识点数 = 194（systemCourse.kpCount）', data.systemCourse?.kpCount === 194)
check('知识点条目数 = 194', items.length === 194, `实际 ${items.length}`)
check('专题合集数 = 6', topics.length === 6, `实际 ${topics.length}`)
check('专题视频数 = 134', videos.length === 134, `实际 ${videos.length}`)

// 分P 1:1 唯一映射
const pSet = new Set()
const dupP = []
for (const it of items) {
  if (pSet.has(it.p)) dupP.push(it.p)
  pSet.add(it.p)
}
check('分P号全局唯一（1:1 映射）', dupP.length === 0, dupP.length ? `重复 ${dupP.join(',')}` : '')
check('分P号都在 2..198', items.every((it) => it.p >= 2 && it.p <= 198))

// 模块 count 与实际条目一致（m105/m187 的 count 是数据源给的模块知识点数）
const badCount = modules.filter((m) => m.count !== m.items.length)
check(
  '每个模块 count = items.length',
  badCount.length === 0,
  badCount.map((m) => `${m.name}:${m.count}≠${m.items.length}`).join(' '),
)

// 模块首项分P递增（复习顺序不被重排）——只校验模块之间，模块内顺序保持原样
let ordered = true
for (let i = 1; i < modules.length; i += 1) {
  const prev = modules[i - 1]
  const cur = modules[i]
  if ((cur.items?.[0]?.p ?? 0) <= (prev.items?.[0]?.p ?? 0)) ordered = false
}
check('模块顺序与数据一致（首项分P递增）', ordered)

// 时长合法
check(
  '知识点时长均为正数',
  items.every((it) => Number.isFinite(it.duration) && it.duration > 0),
)
check(
  '视频时长均为正数',
  videos.every((v) => Number.isFinite(v.duration) && v.duration > 0),
)

// 专题数据
const badTopicCount = topics.filter((t) => t.count !== t.videos.length)
check(
  '专题 count = videos.length',
  badTopicCount.length === 0,
  badTopicCount.map((t) => `${t.title}:${t.count}≠${t.videos.length}`).join(' '),
)
check(
  '专题 seasonId 唯一',
  new Set(topics.map((t) => t.seasonId)).size === topics.length,
)
const bvPattern = /^BV[0-9A-Za-z]{6,}$/
check('专题 bvid 合法', videos.every((v) => bvPattern.test(v.bvid)), '')
check(
  '封面地址均可升级为 https',
  videos.every((v) => typeof v.cover === 'string' && /^https?:\/\//.test(v.cover)),
  '',
)

// 预计总时长（可选提示）
const systemHours = items.reduce((s, it) => s + it.duration, 0) / 3600
console.log(
  `\n提示：系统课 ${items.length} 个知识点，合计约 ${systemHours.toFixed(1)} 小时；` +
    `专题 ${videos.length} 条视频。`,
)

if (failures > 0) {
  console.error(`\n数据校验失败：${failures} 项不通过`)
  process.exit(1)
}
console.log('\n全部数据校验通过 ✓')
