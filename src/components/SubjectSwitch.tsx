import { SUBJECT_VIEWS } from '../data'
import { Segmented, type SegmentedItem } from './Segmented'

interface SubjectSwitchProps {
  value: string
  onChange: (subjectId: string) => void
  className?: string
}

/** 一级科目切换：数学 / 物理 */
export function SubjectSwitch({ value, onChange, className = '' }: SubjectSwitchProps) {
  const items: SegmentedItem[] = SUBJECT_VIEWS.map((subject) => ({
    key: subject.info.id,
    label: subject.info.name,
  }))
  return (
    <Segmented
      items={items}
      value={value}
      onChange={onChange}
      className={className}
      ariaLabel="选择科目"
    />
  )
}
