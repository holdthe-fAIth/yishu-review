#!/usr/bin/env node
/**
 * 课程数据完整性校验（v3 多科目）
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

const SUBJECT_EXPECTATIONS = {
  math: {
    name: '数学',
    mid: 14229967,
    systemBvid: 'BV147411K7xu',
    modules: 24,
    items: 194,
    topics: 7,
    videos: 320,
    seasonId: 1533671,
  },
  physics: {
    name: '物理',
    mid: 23630128,
    modules: 36,
    items: 444,
    topics: 2,
    videos: 89,
  },
}

const subjects = data.subjects ?? []
const bvPattern = /^BV[0-9A-Za-z]{6,}$/

function formatHours(seconds) {
  return (seconds / 3600).toFixed(1)
}

function moduleDurationMin(module) {
  return Math.round(
    module.items.reduce((sum, item) => sum + (item.duration ?? 0), 0) / 60,
  )
}

function systemItemKey(subject, module, item) {
  const bvid = item.bvid ?? module.bvid ?? subject.systemCourse?.bvid
  if (typeof item.p === 'number') {
    return subject.systemCourse?.bvid && bvid === subject.systemCourse.bvid
      ? `${subject.id}:s:${item.p}`
      : `${subject.id}:s:${bvid}:${item.p}`
  }
  return `${subject.id}:s:${bvid}`
}

console.log('课程数据校验（v3 多科目）：')
check('数据版本 version >= 3', data.version >= 3, `实际 ${data.version}`)
check('科目数 = 2', subjects.length === 2, `实际 ${subjects.length}`)
check(
  '科目 id 唯一',
  new Set(subjects.map((subject) => subject.id)).size === subjects.length,
)
check(
  '数据生成时间不晚于当前时间',
  typeof data.generatedAt === 'string' &&
    new Date(data.generatedAt).getTime() <= Date.now() + 86_400_000,
  data.generatedAt,
)

const allSystemItems = []
const allTopicVideos = []

for (const [subjectId, expected] of Object.entries(SUBJECT_EXPECTATIONS)) {
  const subject = subjects.find((item) => item.id === subjectId)
  console.log(`\n[${expected.name}] ${subjectId}`)
  if (!check(`${expected.name}科目存在`, Boolean(subject))) continue

  const modules = subject.systemCourse?.modules ?? []
  const items = modules.flatMap((module) => module.items ?? [])
  const topics = subject.topics ?? []
  const videos = topics.flatMap((topic) => topic.videos ?? [])
  const systemBvid = subject.systemCourse?.bvid

  check(`${expected.name} up.mid = ${expected.mid}`, subject.up?.mid === expected.mid, `实际 ${subject.up?.mid}`)
  check(
    `${expected.name} up.space 指向 B站`,
    typeof subject.up?.space === 'string' && subject.up.space.includes('space.bilibili.com'),
  )
  if (expected.systemBvid) {
    check(
      `${expected.name}系统课 bvid = ${expected.systemBvid}`,
      systemBvid === expected.systemBvid,
      `实际 ${systemBvid}`,
    )
  }
  check(`${expected.name}模块数 = ${expected.modules}`, modules.length === expected.modules, `实际 ${modules.length}`)
  check(
    `${expected.name}知识点数 = ${expected.items}`,
    subject.systemCourse?.kpCount === expected.items && items.length === expected.items,
    `kpCount=${subject.systemCourse?.kpCount} items=${items.length}`,
  )
  check(`${expected.name}专题合集数 = ${expected.topics}`, topics.length === expected.topics, `实际 ${topics.length}`)
  check(`${expected.name}专题视频总数 = ${expected.videos}`, videos.length === expected.videos, `实际 ${videos.length}`)
  if (expected.seasonId) {
    check(
      `${expected.name}包含 seasonId ${expected.seasonId}`,
      topics.some((topic) => topic.seasonId === expected.seasonId),
    )
  }

  const badModuleCount = modules.filter((module) => module.count !== module.items.length)
  check(
    `${expected.name}每个模块 count = items.length`,
    badModuleCount.length === 0,
    badModuleCount.map((module) => module.name).join(' '),
  )
  const badModuleDuration = modules.filter(
    (module) => module.durationMin !== moduleDurationMin(module),
  )
  check(
    `${expected.name}每个模块 durationMin 正确`,
    badModuleDuration.length === 0,
    badModuleDuration.map((module) => module.name).join(' '),
  )
  check(
    `${expected.name}每个模块都有 id / name`,
    modules.every((module) => typeof module.id === 'string' && module.id && module.name),
  )
  check(
    `${expected.name}系统课总时长正确`,
    subject.systemCourse?.durationMin ===
      modules.reduce((sum, module) => sum + module.durationMin, 0),
  )

  const badBvid = []
  const unresolved = []
  const badP = []
  for (const module of modules) {
    for (const item of module.items) {
      const bvid = item.bvid ?? module.bvid ?? systemBvid
      if (!bvid || !bvPattern.test(bvid)) {
        unresolved.push(`${module.name}/${item.name}`)
      } else if (item.bvid && !bvPattern.test(item.bvid)) {
        badBvid.push(item.bvid)
      }
      if (typeof item.p !== 'undefined' && (typeof item.p !== 'number' || item.p < 1)) {
        badP.push(`${module.name}/${item.name}`)
      }
    }
  }
  check(`${expected.name}所有知识点都有可用 BV 号`, unresolved.length === 0, unresolved.slice(0, 3).join(' / '))
  check(`${expected.name}知识点自带 bvid 合法`, badBvid.length === 0, badBvid.slice(0, 3).join(','))
  check(`${expected.name}分P号合法（如有）`, badP.length === 0, badP.slice(0, 3).join(' / '))

  if (subjectId === 'math') {
    const pSet = new Set()
    const dupP = []
    for (const item of items) {
      if (pSet.has(item.p)) dupP.push(item.p)
      pSet.add(item.p)
    }
    check('数学分P号全局唯一（1:1 映射）', dupP.length === 0, dupP.length ? `重复 ${dupP.join(',')}` : '')
    check('数学分P号都在 2..198', items.every((item) => item.p >= 2 && item.p <= 198))
    let ordered = true
    for (let i = 1; i < modules.length; i += 1) {
      if ((modules[i].items?.[0]?.p ?? 0) <= (modules[i - 1].items?.[0]?.p ?? 0)) ordered = false
    }
    check('数学模块顺序与数据一致（首项分P递增）', ordered)
  }

  const keys = []
  for (const module of modules) {
    for (const item of module.items) keys.push(systemItemKey(subject, module, item))
  }
  check(`${expected.name}知识点 key 唯一`, new Set(keys).size === keys.length)
  check(
    `${expected.name}系统课每个知识点都有发布时间`,
    items.every((item) => Number.isFinite(item.pubdate) && item.pubdate > 0),
    items.filter((item) => !(item.pubdate > 0)).slice(0, 3).map((item) => item.name).join('/'),
  )
  check(
    `${expected.name}知识点时长均为正数`,
    items.every((item) => Number.isFinite(item.duration) && item.duration > 0),
  )

  const badTopicCount = topics.filter((topic) => topic.count !== topic.videos.length)
  check(
    `${expected.name}专题 count = videos.length`,
    badTopicCount.length === 0,
    badTopicCount.map((topic) => topic.title).join(' '),
  )
  check(
    `${expected.name}专题 seasonId 唯一`,
    new Set(topics.map((topic) => topic.seasonId)).size === topics.length,
  )
  check(
    `${expected.name}专题 bvid 合法`,
    videos.every((video) => bvPattern.test(video.bvid)),
  )
  check(
    `${expected.name}专题封面均为 https`,
    videos.every((video) => typeof video.cover === 'string' && video.cover.startsWith('https://')),
  )
  check(
    `${expected.name}专题视频都有发布时间`,
    videos.every((video) => Number.isFinite(video.pubdate) && video.pubdate > 0),
  )
  check(
    `${expected.name}专题视频时长均为正数`,
    videos.every((video) => Number.isFinite(video.duration) && video.duration > 0),
  )
  check(
    `${expected.name}专题合集按最新发布时间降序`,
    topics.every((topic, index) => {
      if (index === 0) return true
      const latest = (item) => Math.max(...item.videos.map((video) => video.pubdate ?? 0))
      return latest(topics[index - 1]) >= latest(topic)
    }),
  )
  check(
    `${expected.name}合集内视频按发布时间倒序`,
    topics.every((topic) =>
      topic.videos.every(
        (video, index) =>
          index === 0 || (topic.videos[index - 1].pubdate ?? 0) >= (video.pubdate ?? 0),
      ),
    ),
  )

  const videoBvids = new Set()
  let duplicateVideo = ''
  for (const topic of topics) {
    for (const video of topic.videos) {
      if (videoBvids.has(video.bvid)) duplicateVideo = video.bvid
      videoBvids.add(video.bvid)
    }
  }
  check(`${expected.name}专题视频不跨合集重复`, duplicateVideo === '', duplicateVideo)

  allSystemItems.push(...items)
  allTopicVideos.push(...videos)
}

check(
  '专题视频不跨科目重复',
  new Set(allTopicVideos.map((video) => video.bvid)).size === allTopicVideos.length,
)

// 教辅类「一本书/100讲」是单个多P视频，需带 partCount 供卡片显示「N 讲」
const seriesVideos = allTopicVideos.filter((video) => (video.partCount ?? 1) > 1)
check(
  '教辅类多P合集已识别分P数',
  seriesVideos.length >= 10 && seriesVideos.every((video) => video.partCount >= 2),
  `识别 ${seriesVideos.length} 个`,
)

// 构建时会拷贝到 public/data，保证 PWA 可在同源检查内容更新
check(
  'public/data/courses.json 与 data/courses.json 一致',
  JSON.stringify(publicData) === JSON.stringify(data),
)

const mathItems = subjects.find((subject) => subject.id === 'math')?.systemCourse?.modules ?? []
const mathSeconds = mathItems.flatMap((module) => module.items).reduce((sum, item) => sum + item.duration, 0)
const physicsItems = subjects.find((subject) => subject.id === 'physics')?.systemCourse?.modules ?? []
const physicsSeconds = physicsItems.flatMap((module) => module.items).reduce((sum, item) => sum + item.duration, 0)

console.log(
  `\n提示：数学 ${mathItems.flatMap((module) => module.items).length} 个知识点（约 ${formatHours(
    mathSeconds,
  )} 小时）；物理 ${physicsItems.flatMap((module) => module.items).length} 个知识点（约 ${formatHours(
    physicsSeconds,
  )} 小时）。`,
)
console.log(`      数据生成时间：${data.generatedAt}（version ${data.version}）`)

if (failures > 0) {
  console.error(`\n数据校验失败：${failures} 项不通过`)
  process.exit(1)
}
console.log('\n全部数据校验通过 ✓')
