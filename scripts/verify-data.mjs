#!/usr/bin/env node
/**
 * 课程数据完整性校验（v2）
 * 运行：pnpm verify:data
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(resolve(here, '../data/courses.json'), 'utf8'))
const publicData = JSON.parse(readFileSync(resolve(here, '../public/data/courses.json'), 'utf8'))

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

console.log('课程数据校验（v2）：')
check('数据版本 version >= 2', data.version >= 2, `实际 ${data.version}`)
check('up.mid = 14229967', data.up?.mid === 14229967, `实际 ${data.up?.mid}`)
check('系统课 bvid = BV147411K7xu', data.systemCourse?.bvid === 'BV147411K7xu')
check('模块数 = 24', modules.length === 24, `实际 ${modules.length}`)
check('知识点数 = 194', data.systemCourse?.kpCount === 194 && items.length === 194, `实际 ${items.length}`)
check('专题合集数 = 7', topics.length === 7, `实际 ${topics.length}`)
check('专题视频总数 = 320', videos.length === 320, `实际 ${videos.length}`)
check('包含「高中数学大合集」(seasonId 1533671)', topics.some((t) => t.seasonId === 1533671))

// 分P 1:1 唯一映射
const pSet = new Set()
const dupP = []
for (const item of items) {
  if (pSet.has(item.p)) dupP.push(item.p)
  pSet.add(item.p)
}
check('分P号全局唯一（1:1 映射）', dupP.length === 0, dupP.length ? `重复 ${dupP.join(',')}` : '')
check('分P号都在 2..198', items.every((item) => item.p >= 2 && item.p <= 198))

const badCount = modules.filter((module) => module.count !== module.items.length)
check('每个模块 count = items.length', badCount.length === 0, badCount.map((module) => module.name).join(' '))

// 模块顺序与数据一致（首项分P递增）
let ordered = true
for (let i = 1; i < modules.length; i += 1) {
  if ((modules[i].items?.[0]?.p ?? 0) <= (modules[i - 1].items?.[0]?.p ?? 0)) ordered = false
}
check('模块顺序与数据一致（首项分P递增）', ordered)

// 发布时间
check(
  '系统课每个知识点都有发布时间',
  items.every((item) => Number.isFinite(item.pubdate) && item.pubdate > 0),
  items.filter((item) => !(item.pubdate > 0)).slice(0, 3).map((item) => item.name).join('/'),
)
check(
  '专题每条视频都有发布时间',
  videos.every((video) => Number.isFinite(video.pubdate) && video.pubdate > 0),
)
check(
  '发布时间不晚于当前时间',
  [...items.map((item) => item.pubdate), ...videos.map((video) => video.pubdate)].every(
    (pubdate) => pubdate * 1000 <= Date.now() + 86_400_000,
  ),
)

// 时长合法
check('知识点时长均为正数', items.every((item) => Number.isFinite(item.duration) && item.duration > 0))
check('视频时长均为正数', videos.every((video) => Number.isFinite(video.duration) && video.duration > 0))

// 专题数据
const badTopicCount = topics.filter((topic) => topic.count !== topic.videos.length)
check('专题 count = videos.length', badTopicCount.length === 0, badTopicCount.map((topic) => topic.title).join(' '))
check('专题 seasonId 唯一', new Set(topics.map((topic) => topic.seasonId)).size === topics.length)
const bvPattern = /^BV[0-9A-Za-z]{6,}$/
check('专题 bvid 合法', videos.every((video) => bvPattern.test(video.bvid)))
check(
  '封面地址均为 https',
  videos.every((video) => typeof video.cover === 'string' && video.cover.startsWith('https://')),
)
check(
  '专题合集按最新发布时间降序',
  topics.every((topic, index) => {
    if (index === 0) return true
    const latest = (item) => Math.max(...item.videos.map((video) => video.pubdate ?? 0))
    return latest(topics[index - 1]) >= latest(topic)
  }),
)

// 同一视频不在多个合集里重复出现
const videoBvids = new Set()
let duplicateVideo = ''
for (const topic of topics) {
  for (const video of topic.videos) {
    if (videoBvids.has(video.bvid)) duplicateVideo = video.bvid
    videoBvids.add(video.bvid)
  }
}
check(
  '专题视频不跨合集重复',
  duplicateVideo === '',
  duplicateVideo,
)

// 每个合集内按发布时间倒序（新视频在前，配合「已学排后」更好用）
check(
  '合集内视频按发布时间倒序',
  topics.every((topic) =>
    topic.videos.every((video, index) => index === 0 || (topic.videos[index - 1].pubdate ?? 0) >= (video.pubdate ?? 0)),
  ),
)

// 教辅类「一本书/100讲」是单个多P视频，需带 partCount 供卡片显示「N 讲」
const seriesVideos = videos.filter((video) => (video.partCount ?? 1) > 1)
check(
  '教辅类多P合集已识别分P数',
  seriesVideos.length >= 10 && seriesVideos.every((video) => video.partCount >= 2),
  `识别 ${seriesVideos.length} 个`,
)

// 构建时会拷贝到 public/data，保证 PWA 可在同源检查内容更新
check('public/data/courses.json 与 data/courses.json 一致', JSON.stringify(publicData) === JSON.stringify(data))

const systemHours = items.reduce((sum, item) => sum + item.duration, 0) / 3600
console.log(`\n提示：系统课 ${items.length} 个知识点（约 ${systemHours.toFixed(1)} 小时）；专题 ${topics.length} 个合集 / ${videos.length} 条视频。`)
console.log(`      数据生成时间：${data.generatedAt}（version ${data.version}）`)

if (failures > 0) {
  console.error(`\n数据校验失败：${failures} 项不通过`)
  process.exit(1)
}
console.log('\n全部数据校验通过 ✓')
