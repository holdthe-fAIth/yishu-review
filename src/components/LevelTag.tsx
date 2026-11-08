export type NormalizedLevel = '基础' | '中档' | '拔高' | ''

const LEVEL_CLASS: Record<string, string> = {
  基础: 'is-basic',
  中档: 'is-mid',
  拔高: 'is-hard',
}

/** 数据里 level 字段为主；缺失时从 difficulty 文案推断 */
export function normalizeLevel(level: string, difficulty = ''): NormalizedLevel {
  if (level === '基础' || level === '中档' || level === '拔高') return level
  const text = `${level} ${difficulty}`
  if (/拔高|稍难|选学|超级/.test(text)) return '拔高'
  if (/中档/.test(text)) return '中档'
  if (/基础|易/.test(text)) return '基础'
  return ''
}

interface LevelTagProps {
  level: string
  difficulty?: string
  className?: string
}

/** 难度标签：基础=绿 / 中档=橙 / 拔高=红 */
export function LevelTag({ level, difficulty = '', className = '' }: LevelTagProps) {
  const normalized = normalizeLevel(level, difficulty)
  if (!normalized) return null
  return (
    <span className={`tag-level ${LEVEL_CLASS[normalized]} ${className}`.trim()}>{normalized}</span>
  )
}
