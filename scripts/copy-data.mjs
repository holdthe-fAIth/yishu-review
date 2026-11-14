/** 把 data/courses.json 拷贝到 public/data/，让 PWA 能用同源地址检查内容更新 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const source = join(root, 'data', 'courses.json')
const destDir = join(root, 'public', 'data')

mkdirSync(destDir, { recursive: true })
copyFileSync(source, join(destDir, 'courses.json'))
console.log('✓ data/courses.json → public/data/courses.json')
