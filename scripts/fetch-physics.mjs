#!/usr/bin/env node
/**
 * 抓取「黄夫人」的高中物理合集，写入 data/courses.json（v3 多科目结构）。
 * - 系统课：高一高二（上篇/下篇）+ 选修，按人工规则拆成 36 个模块
 * - 专题课：补充合集 + 试卷讲解
 * - 只在开发/更新数据时运行；App 运行时只读静态 JSON，不请求 B站
 *
 * 用法：pnpm fetch:physics
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const MID = 23630128
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SYSTEM_SEASONS = [2045, 2181, 2182]
const TOPIC_SEASONS = [2216020, 2183]

const MODULE_RULES = {
  2045: [
    ['运动的描述', '运动的描述'],
    ['匀变速直线运动', '匀变速直线运动'],
    ['弹簧专题', '弹簧专题'],
    ['力学', '相互作用与受力分析'],
    ['动态平衡', '动态平衡'],
    ['牛二板块', '板块模型'],
    ['传送带', '传送带模型'],
    ['牛二', '牛顿运动定律'],
    ['曲线运动', '曲线运动'],
    ['平抛运动', '平抛运动'],
    ['圆周运动', '圆周运动'],
    ['天体运动', '天体运动'],
    ['万有引力与航天', '万有引力与航天'],
  ],
  2181: [
    ['功与能', '功与能'],
    ['汽车启动', '汽车启动'],
    ['动能定理', '动能定理'],
    ['机械能守恒', '机械能守恒'],
    ['动量守恒', '动量守恒'],
    ['匀强电场', '匀强电场'],
    ['静电屏蔽', '静电屏蔽'],
    ['电场', '电场'],
    ['高中电路', '恒定电流'],
    ['磁场', '磁场'],
    ['安培力', '安培力'],
    ['洛伦兹力', '洛伦兹力'],
    ['选修3-2电磁感应', '电磁感应'],
  ],
  2182: [
    ['选修3-2交流电', '交变电流'],
    ['简谐运动', '简谐运动'],
    ['机械波', '机械波'],
    ['光', '光'],
    ['分子动理论', '分子动理论'],
    ['物态及其物态变化', '物态与物态变化'],
    ['理想气体状态方程', '理想气体状态方程'],
    ['理想气体', '理想气体'],
    ['热力学三大定律', '热力学定律'],
    ['选修3-5完结', '原子物理'],
    ['选修3-5', '原子物理'],
  ],
}

async function api(url, retries = 8) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: `https://space.bilibili.com/${MID}` },
      })
      const json = await response.json()
      if (json.code === 0) return json.data
      if (json.code === -799 || json.code === -352) {
        await sleep(3000 * (attempt + 1))
        continue
      }
      throw new Error(`code=${json.code} msg=${json.message} url=${url}`)
    } catch (error) {
      if (attempt === retries - 1) throw error
      await sleep(1500)
    }
  }
  throw new Error('unreachable')
}

function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const httpsCover = (url) => String(url || '').replace(/^http:\/\//, 'https://')

/** 去掉标题里的序号和【章节】前缀，只留卡片上显示的知识点名 */
function cleanTitle(title) {
  let text = String(title || '')
  text = text.replace(/^\d+\./, '')
  text = text.replace(/^(?:【[^】]+】)+/, '')
  text = text.replace(/^\d+\./, '')
  return text.trim() || String(title || '')
}

function tagsOf(title) {
  return [...String(title || '').matchAll(/【([^】]+)】/g)].map((match) => match[1])
}

function mathSubjectOf(current) {
  if (Array.isArray(current.subjects)) {
    const math = current.subjects.find((subject) => subject.id === 'math')
    if (math) return math
    throw new Error('当前 courses.json 缺少数学科目')
  }
  // 兼容旧 v2 数据
  return {
    id: 'math',
    name: '数学',
    up: current.up,
    systemCourse: current.systemCourse,
    topics: current.topics,
  }
}

async function fetchSeasonsList() {
  const seasons = []
  for (let pageNum = 1; pageNum <= 5; pageNum += 1) {
    const data = await api(
      `https://api.bilibili.com/x/polymer/web-space/seasons_series_list?mid=${MID}&page_num=${pageNum}&page_size=20`,
    )
    const items = data?.items_lists?.seasons_list ?? []
    seasons.push(...items)
    if (seasons.length >= (data?.items_lists?.page?.total ?? 0)) break
    await sleep(800)
  }
  return seasons
}

async function fetchSeasonVideos(seasonId) {
  const videos = []
  let total = 0
  for (let pageNum = 1; pageNum <= 30; pageNum += 1) {
    const data = await api(
      `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${MID}&season_id=${seasonId}&page_num=${pageNum}&page_size=30`,
    )
    total = data?.page?.total ?? 0
    const archives = data?.archives ?? []
    for (const item of archives) {
      videos.push({
        bvid: item.bvid,
        title: item.title,
        cover: httpsCover(item.pic),
        duration: item.duration,
        pubdate: item.pubdate,
        views: item.stat?.view,
      })
    }
    if (videos.length >= total || archives.length === 0) break
    await sleep(800)
  }
  if (videos.length !== total) {
    throw new Error(`合集 ${seasonId} 视频数量不一致：${videos.length}/${total}`)
  }
  return videos
}

async function main() {
  const current = JSON.parse(readFileSync(join(root, 'data', 'courses.json'), 'utf8'))
  const math = mathSubjectOf(current)

  console.log('抓取黄夫人主页合集列表...')
  const rawSeasons = await fetchSeasonsList()
  const seasonById = new Map(rawSeasons.map((season) => [season.meta.season_id, season]))
  console.log(`  合集数：${rawSeasons.length}`)

  const videosBySeason = new Map()
  for (const seasonId of [...SYSTEM_SEASONS, ...TOPIC_SEASONS]) {
    const season = seasonById.get(seasonId)
    if (!season) throw new Error(`找不到合集 ${seasonId}（可能改名或被删除）`)
    const videos = await fetchSeasonVideos(seasonId)
    videosBySeason.set(seasonId, videos)
    console.log(`  ${season.meta.title}：${videos.length} 条`)
    await sleep(700)
  }

  const modules = []
  let moduleIndex = 0
  for (const seasonId of SYSTEM_SEASONS) {
    const rules = MODULE_RULES[seasonId]
    const videos = videosBySeason.get(seasonId)
    const moduleNames = [...new Set(rules.map(([, name]) => name))]
    const buckets = new Map(moduleNames.map((name) => [name, []]))
    for (const video of videos) {
      const tags = tagsOf(video.title)
      const rule = rules.find(([tag]) => tags.includes(tag))
      if (!rule) throw new Error(`未匹配视频：${video.bvid} ${video.title}`)
      buckets.get(rule[1]).push(video)
    }
    for (const name of moduleNames) {
      const items = buckets.get(name)
      if (!items.length) continue
      moduleIndex += 1
      const moduleItems = items.map((video, index) => ({
        bvid: video.bvid,
        no: index + 1,
        name: cleanTitle(video.title),
        difficulty: '',
        level: '',
        duration: video.duration,
        durationText: formatClock(video.duration),
        pubdate: video.pubdate,
      }))
      modules.push({
        id: `ph-${String(moduleIndex).padStart(2, '0')}`,
        name,
        count: moduleItems.length,
        durationMin: Math.round(
          moduleItems.reduce((sum, item) => sum + item.duration, 0) / 60,
        ),
        items: moduleItems,
      })
    }
  }

  const topics = TOPIC_SEASONS.map((seasonId) => {
    const season = seasonById.get(seasonId)
    const videos = videosBySeason
      .get(seasonId)
      .slice()
      .sort((a, b) => b.pubdate - a.pubdate)
      .map((video) => ({
        bvid: video.bvid,
        title: cleanTitle(video.title),
        cover: video.cover,
        duration: video.duration,
        durationText: formatClock(video.duration),
        pubdate: video.pubdate,
        views: video.views,
      }))
    return {
      id: `pt-${seasonId}`,
      seasonId,
      title: season.meta.title,
      count: videos.length,
      durationMin: Math.round(videos.reduce((sum, video) => sum + video.duration, 0) / 60),
      videos,
    }
  }).sort((a, b) => {
    const latest = (topic) => Math.max(...topic.videos.map((video) => video.pubdate ?? 0))
    return latest(b) - latest(a)
  })

  const systemItems = modules.flatMap((module) => module.items)
  const physics = {
    id: 'physics',
    name: '物理',
    up: {
      mid: MID,
      name: '黄夫人',
      space: `https://space.bilibili.com/${MID}`,
    },
    systemCourse: {
      id: 'physics-system',
      title: '高中物理 · 黄夫人',
      subtitle: `高一高二上/下篇 + 选修 · ${systemItems.length} 讲`,
      kpCount: systemItems.length,
      durationMin: modules.reduce((sum, module) => sum + module.durationMin, 0),
      modules,
    },
    topics,
  }

  const extras = (current.subjects ?? []).filter(
    (subject) => subject.id !== 'math' && subject.id !== 'physics',
  )
  const next = {
    version: 3,
    generatedAt: new Date().toISOString(),
    subjects: [math, physics, ...extras],
  }

  mkdirSync(join(root, 'public', 'data'), { recursive: true })
  writeFileSync(join(root, 'data', 'courses.json'), JSON.stringify(next, null, 1) + '\n')
  writeFileSync(join(root, 'public', 'data', 'courses.json'), JSON.stringify(next))

  console.log(`\n物理：${modules.length} 模块 / ${systemItems.length} 知识点 / ${topics.length} 专题合集`)
  console.log('已写入 data/courses.json ✓')
}

main().catch((error) => {
  console.error('物理数据抓取失败：', error)
  process.exit(1)
})
