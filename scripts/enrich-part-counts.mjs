/** 为教辅类「多P 合集」视频补充 partCount（卡片显示「N 讲」） */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchView(bvid, retries = 6) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
        headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com/' },
      })
      const json = await response.json()
      if (json.code === 0) return json.data
      if (json.code === -799 || json.code === -352) {
        console.log(`  限流 -${json.code}，等待... (${bvid})`)
        await sleep(5000 * (attempt + 1))
        continue
      }
      throw new Error(`code=${json.code} ${json.message}`)
    } catch (error) {
      if (attempt === retries - 1) throw error
      await sleep(2500 * (attempt + 1))
    }
  }
  throw new Error('unreachable')
}

async function main() {
  const dataPath = join(root, 'data', 'courses.json')
  const publicPath = join(root, 'public', 'data', 'courses.json')
  const data = JSON.parse(readFileSync(dataPath, 'utf8'))
  const videos = data.topics.flatMap((topic) => topic.videos)
  const candidates = videos.filter((video) => video.duration >= 5 * 3600)
  console.log(`需要补充分P数的视频：${candidates.length} 条`)

  let updated = 0
  for (const video of candidates) {
    try {
      const view = await fetchView(video.bvid)
      const partCount = Array.isArray(view.pages) ? view.pages.length : 1
      if (partCount > 1) {
        video.partCount = partCount
        updated += 1
        console.log(`  ✓ ${partCount} 讲 · ${video.title.slice(0, 30)}`)
      } else {
        console.log(`  - 单P，跳过 · ${video.title.slice(0, 30)}`)
      }
    } catch (error) {
      console.warn(`  ✗ 获取失败 ${video.bvid}: ${error.message}`)
    }
    await sleep(2200)
  }

  if (updated > 0) {
    writeFileSync(dataPath, JSON.stringify(data, null, 1) + '\n')
    writeFileSync(publicPath, JSON.stringify(data))
    console.log(`\n已写入：${updated} 个视频补充分P数 ✓`)
  } else {
    console.log('\n没有更新（可能被限流，稍后重试）')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('补全失败：', error)
  process.exit(1)
})
