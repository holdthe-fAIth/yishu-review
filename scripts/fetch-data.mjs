/**
 * 从 B站 重新抓取「一数」主页数据，生成 data/courses.json（v2）。
 *
 * - 系统课：沿用人工整理好的 24 个模块 / 194 个知识点分组（复习顺序不变），
 *   用 B站 分P 接口刷新标题/时长/发布时间（pages[].ctime 即每一集的发布时间）。
 * - 专题课：抓取一数主页全部「合集」，按最新发布时间排序；新增「高中数学大合集」
 *   （187 条独立视频，排除与系统课重复的 BV 本身和预告片）。
 * - 所有封面统一转 https；运行时不请求 B站，本脚本只在开发/更新数据时跑。
 *
 * 用法：pnpm fetch:data
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const MID = 14229967
const SYSTEM_BVID = 'BV147411K7xu'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(url, retries = 8) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
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

function dateText(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
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
    await sleep(900)
  }
  return seasons
}

async function fetchSeasonVideos(seasonId) {
  const videos = []
  for (let pageNum = 1; pageNum <= 30; pageNum += 1) {
    const data = await api(
      `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${MID}&season_id=${seasonId}&page_num=${pageNum}&page_size=30`,
    )
    const items = data?.archives ?? []
    for (const item of items) {
      videos.push({
        bvid: item.bvid,
        title: item.title,
        cover: httpsCover(item.pic),
        duration: item.duration,
        durationText: formatClock(item.duration),
        pubdate: item.pubdate,
        views: item.stat?.view,
      })
    }
    if (videos.length >= (data?.page?.total ?? 0) || items.length === 0) break
    await sleep(900)
  }
  return videos
}

async function main() {
  console.log('读取现有 courses.json（保留人工整理的模块分组）...')
  const old = JSON.parse(readFileSync(join(root, 'data', 'courses.json'), 'utf8'))
  const moduleByP = new Map()
  for (const module of old.systemCourse.modules) {
    for (const item of module.items) moduleByP.set(item.p, module.id)
  }

  console.log('抓取系统课分P列表...')
  const view = await api(`https://api.bilibili.com/x/web-interface/view?bvid=${SYSTEM_BVID}`)
  const pageByNumber = new Map(view.pages.map((page) => [page.page, page]))
  console.log(`  标题：${view.title.slice(0, 40)}...`)
  console.log(`  分P：${view.pages.length}，首集发布时间：${dateText(view.pages[0].ctime)}`)

  let missing = 0
  const modules = old.systemCourse.modules.map((module) => {
    const items = module.items.map((item) => {
      const page = pageByNumber.get(item.p)
      if (!page) {
        missing += 1
        return item
      }
      return {
        ...item,
        name: item.name || page.part,
        duration: page.duration,
        durationText: formatClock(page.duration),
        pubdate: page.ctime,
      }
    })
    return {
      ...module,
      count: items.length,
      durationMin: Math.round(items.reduce((sum, item) => sum + item.duration, 0) / 60),
      items,
    }
  })
  if (missing > 0) throw new Error(`有 ${missing} 个知识点在 B站 分P 里找不到，已中止`)

  const systemDurationMin = modules.reduce((sum, module) => sum + module.durationMin, 0)
  const systemKpCount = modules.reduce((sum, module) => sum + module.items.length, 0)
  console.log(`  知识点：${systemKpCount}，总时长：${systemDurationMin} 分钟`)

  console.log('抓取一数主页合集列表...')
  const rawSeasons = await fetchSeasonsList()
  console.log(`  合集数：${rawSeasons.length}`)

  const collections = []
  for (const season of rawSeasons) {
    const meta = season.meta ?? {}
    const videos = await fetchSeasonVideos(meta.season_id)
    collections.push({
      seasonId: meta.season_id,
      title: String(meta.name || meta.title || '').replace(/^合集·/, ''),
      videos,
      latest: videos.reduce((max, video) => Math.max(max, video.pubdate ?? 0), 0),
    })
    console.log(
      `  ${String(meta.name).padEnd(24)} ${videos.length} 条，最新 ${dateText(
        videos.reduce((max, video) => Math.max(max, video.pubdate ?? 0), 0),
      )}`,
    )
  }

  // 只保留知识型合集；系统课本身在「系统课」里，不再作为专题卡片重复出现；
  // 大合集里的预告片也过滤掉。
  const EXCLUDED_BVIDS = new Set([SYSTEM_BVID])
  const topics = collections
    .filter((collection) => collection.videos.length > 0)
    .sort((a, b) => b.latest - a.latest)
    .map((collection) => {
      const videos = collection.videos
        .filter((video) => !EXCLUDED_BVIDS.has(video.bvid))
        .filter((video) => !/预告/.test(video.title))
        .map((video) => ({
          ...video,
          pubdate: video.pubdate ?? 0,
        }))
        .sort((a, b) => b.pubdate - a.pubdate)
      return {
        id: `t${collection.seasonId}`,
        seasonId: collection.seasonId,
        title: collection.title,
        count: videos.length,
        durationMin: Math.round(videos.reduce((sum, video) => sum + video.duration, 0) / 60),
        videos,
      }
    })

  const totalTopicVideos = topics.reduce((sum, topic) => sum + topic.videos.length, 0)
  console.log(`  专题合集：${topics.length} 个，视频：${totalTopicVideos} 条`)

  // 教辅类「一本书 / 100 讲」是单个多P视频（总时长几百小时）。
  // 取分P数，卡片上显示成「N 讲」而不是 5000+ 分钟，避免误解。
  let seriesChecked = 0
  for (const topic of topics) {
    for (const video of topic.videos) {
      if (video.duration < 5 * 3600) continue
      try {
        const detail = await api(`https://api.bilibili.com/x/web-interface/view?bvid=${video.bvid}`)
        const partCount = Array.isArray(detail.pages) ? detail.pages.length : 1
        if (partCount > 1) video.partCount = partCount
        seriesChecked += 1
        await sleep(900)
      } catch (error) {
        console.warn(`  分P数获取失败 ${video.bvid}: ${error.message}`)
      }
    }
  }
  if (seriesChecked > 0) console.log(`  已识别 ${seriesChecked} 个多P合集视频（显示为「N 讲」）`)

  const next = {
    version: 2,
    generatedAt: new Date().toISOString(),
    up: {
      mid: MID,
      name: '一数',
      space: `https://space.bilibili.com/${MID}`,
    },
    systemCourse: {
      id: 'system',
      bvid: SYSTEM_BVID,
      title: '高中数学基础与解法全集',
      subtitle: `一数 · 大合集（${view.pages.length} 分P / ${systemKpCount} 个知识点）`,
      kpCount: systemKpCount,
      durationMin: systemDurationMin,
      modules,
    },
    topics,
  }

  mkdirSync(join(root, 'public', 'data'), { recursive: true })
  writeFileSync(join(root, 'data', 'courses.json'), JSON.stringify(next, null, 1) + '\n')
  writeFileSync(join(root, 'public', 'data', 'courses.json'), JSON.stringify(next))
  console.log('\n已写入 data/courses.json 与 public/data/courses.json ✓')
}

main().catch((error) => {
  console.error('数据抓取失败：', error)
  process.exit(1)
})
