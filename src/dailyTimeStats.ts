import type {
  FocusBlock,
  GeneratedPlan,
  Task,
  TaskArea,
  TimeBlock,
  TimeBlockFollowUp,
} from './types'

export interface DailyTimeBlockStat {
  id: string
  source: 'focus' | 'plan'
  time: string
  title: string
  area: TaskArea
  type: string
  status: string
  rawMinutes: number
  countedMinutes: number
  notes: string
}

export interface DailyTimeStatistics {
  focusMinutes: number
  vibeCodingMinutes: number
  cyberMinutes: number
  aiMinutes: number
  englishOutputMinutes: number
  expressionReviewMinutes: number
  jobMinutes: number
  adminMinutes: number
  studyMinutes: number
  recoveryMinutes: number
  completedBlocks: number
  partialBlocks: number
  skippedBlocks: number
  mainFocusArea: string
  usefulOutputSummary: string
  blocks: DailyTimeBlockStat[]
}

interface DailyTimeStatisticsInput {
  plan: GeneratedPlan
  focusBlocks?: FocusBlock[]
  followUps?: TimeBlockFollowUp[]
  tasks?: Task[]
  now?: Date
}

const RECOVERY_TYPES = new Set(['meal', 'break', 'reset', 'recovery', 'buffer'])
const OTHER_FOCUS_TYPES = new Set(['focus', 'project', 'output', 'input', 'review', 'planning', 'admin', 'light', 'class'])

function roundMinutes(value: number): number {
  return Math.max(0, Math.round(value))
}

function hhmmMinutes(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function dateDuration(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000)
}

function plannedDuration(block: TimeBlock): number {
  const estimated = (block as TimeBlock & { minutes?: number; estimatedMinutes?: number }).minutes
    ?? (block as TimeBlock & { estimatedMinutes?: number }).estimatedMinutes
  if (typeof estimated === 'number' && estimated >= 0) return estimated
  const start = hhmmMinutes(block.startTime)
  const end = hhmmMinutes(block.endTime)
  if (start === null || end === null) return 0
  return end >= start ? end - start : 0
}

function inferArea(title: string): TaskArea {
  const value = title.toLowerCase()
  if (/review 5|expression review|chunk bank/.test(value)) return 'Expression Review'
  if (/codex|cursor|coding|deploy|debug|project|\bapp\b|\bui\b/.test(value)) return 'Vibe Coding'
  if (/cyber|cisco|wireshark|gophish|assessment|security/.test(value)) return 'Cyber'
  if (/\bai\b|gemini|gpt|prompt|model|\bapi\b/.test(value)) return 'AI'
  if (/shadowing|english|oral|expression|writing|retelling/.test(value)) return 'English'
  if (/\bjd\b|resume|cover letter|\bjob\b/.test(value)) return 'Job'
  if (/email|bill|form|timesheet/.test(value)) return 'Admin'
  if (/reset|lunch|dinner|break|walk|shower|wash hair/.test(value)) return 'Life reset'
  return 'Other'
}

function categoryFor(area: TaskArea, type: string, title: string): keyof Omit<DailyTimeStatistics, 'focusMinutes' | 'completedBlocks' | 'partialBlocks' | 'skippedBlocks' | 'mainFocusArea' | 'usefulOutputSummary' | 'blocks'> | null {
  const normalizedType = type.toLowerCase()
  if (area === 'Life reset' || RECOVERY_TYPES.has(normalizedType)) return 'recoveryMinutes'
  if (area === 'Vibe Coding') return 'vibeCodingMinutes'
  if (area === 'Cyber') return 'cyberMinutes'
  if (area === 'AI') return 'aiMinutes'
  if (area === 'Expression Review') return 'expressionReviewMinutes'
  if (area === 'Job') return 'jobMinutes'
  if (area === 'Admin') return 'adminMinutes'
  if (area === 'Study') return 'studyMinutes'
  if (area === 'English') {
    const outputTitle = /shadowing|oral|writing|retelling/.test(title.toLowerCase())
    const purelyReading = /read|reading|documentation/.test(title.toLowerCase()) && normalizedType === 'input'
    return normalizedType === 'output' || normalizedType === 'focus' || outputTitle || !purelyReading
      ? 'englishOutputMinutes'
      : 'studyMinutes'
  }
  return null
}

function isFocus(area: TaskArea, type: string): boolean {
  const normalizedType = type.toLowerCase()
  if (area === 'Life reset' || RECOVERY_TYPES.has(normalizedType)) return false
  if (['Cyber', 'AI', 'Vibe Coding', 'English', 'Expression Review', 'Job', 'Admin', 'Study'].includes(area)) return true
  return area === 'Other' && OTHER_FOCUS_TYPES.has(normalizedType)
}

function weightedMinutes(status: string, rawMinutes: number, hasActualDuration: boolean, active = false): number {
  const normalized = status.toLowerCase()
  if (active || normalized === 'done' || normalized === 'followed') return rawMinutes
  if (normalized === 'partial') return rawMinutes * 0.5
  if (normalized === 'changed') return hasActualDuration ? rawMinutes : rawMinutes * 0.5
  return 0
}

function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`
  if (minutes >= 60) return `${Number((minutes / 60).toFixed(1))}h`
  return `${minutes}m`
}

function usefulSummary(stats: DailyTimeStatistics): string {
  const minutesByArea: Record<string, number> = {
    'Vibe Coding': stats.vibeCodingMinutes,
    Cyber: stats.cyberMinutes,
    AI: stats.aiMinutes,
    'English Output': stats.englishOutputMinutes,
    'Expression Review': stats.expressionReviewMinutes,
    Job: stats.jobMinutes,
    Admin: stats.adminMinutes,
    Study: stats.studyMinutes,
    Recovery: stats.recoveryMinutes,
    'None recorded': 0,
  }
  const parts = [`Main focus: ${stats.mainFocusArea} ${formatDuration(minutesByArea[stats.mainFocusArea] ?? 0)}.`]
  if (stats.englishOutputMinutes > 0 && stats.mainFocusArea !== 'English Output') parts.push(`English output: ${formatDuration(stats.englishOutputMinutes)}.`)
  if (stats.recoveryMinutes > 0) parts.push(`Recovery: ${formatDuration(stats.recoveryMinutes)}.`)
  parts.push(`Completed ${stats.completedBlocks} blocks, partial ${stats.partialBlocks}.`)
  return parts.join(' ')
}

export function calculateDailyTimeStatistics({
  plan,
  focusBlocks = [],
  followUps = [],
  tasks = [],
  now = new Date(),
}: DailyTimeStatisticsInput): DailyTimeStatistics {
  const taskById = new Map(tasks.map(task => [task.id, task]))
  const followUpByKey = new Map(followUps.map(item => [item.blockKey, item]))
  const blocks: DailyTimeBlockStat[] = []
  const actualTaskIds = new Set<string>()
  const actualTitles = new Set<string>()

  focusBlocks.forEach(focusBlock => {
    const actualDuration = dateDuration(focusBlock.startTime, focusBlock.actualEndTime)
    const focusStart = new Date(focusBlock.startTime).getTime()
    const activeDuration = focusBlock.status === 'Doing' && !Number.isNaN(focusStart)
      ? Math.min(focusBlock.minutes, Math.max(0, (now.getTime() - focusStart) / 60000))
      : null
    const raw = actualDuration ?? activeDuration ?? focusBlock.minutes ?? 0
    const counted = weightedMinutes(focusBlock.status, raw, actualDuration !== null, focusBlock.status === 'Doing' && raw > 0)
    const type = focusBlock.mode.toLowerCase()
    blocks.push({
      id: focusBlock.id, source: 'focus',
      time: `${new Date(focusBlock.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`,
      title: focusBlock.taskTitle, area: focusBlock.area, type, status: focusBlock.status,
      rawMinutes: roundMinutes(raw), countedMinutes: roundMinutes(counted), notes: focusBlock.notes,
    })
    if (counted > 0) {
      actualTaskIds.add(focusBlock.taskId)
      actualTitles.add(focusBlock.taskTitle.trim().toLowerCase())
    }
  })

  plan.timeBlocks.forEach((planBlock, index) => {
    const title = planBlock.title || planBlock.label
    if ((planBlock.taskId && actualTaskIds.has(planBlock.taskId)) || actualTitles.has(title.trim().toLowerCase())) return
    const legacyKey = [planBlock.startTime ?? 'no-start', planBlock.endTime ?? 'no-end', planBlock.period, planBlock.type ?? 'block', title, index].join('|')
    const followUp = followUpByKey.get(planBlock.id ?? '') ?? followUpByKey.get(legacyKey)
    const status = followUp?.status || planBlock.status || 'Planned'
    const raw = plannedDuration(planBlock)
    const counted = weightedMinutes(status, raw, false)
    const area = (planBlock as TimeBlock & { area?: TaskArea }).area
      ?? (planBlock.taskId ? taskById.get(planBlock.taskId)?.area : undefined)
      ?? inferArea(title)
    blocks.push({
      id: planBlock.id ?? legacyKey, source: 'plan',
      time: planBlock.startTime && planBlock.endTime ? `${planBlock.startTime}-${planBlock.endTime}` : planBlock.label,
      title, area, type: planBlock.type ?? 'focus', status,
      rawMinutes: roundMinutes(raw), countedMinutes: roundMinutes(counted),
      notes: followUp?.notes || planBlock.notes || '',
    })
  })

  const stats: DailyTimeStatistics = {
    focusMinutes: 0, vibeCodingMinutes: 0, cyberMinutes: 0, aiMinutes: 0,
    englishOutputMinutes: 0, expressionReviewMinutes: 0, jobMinutes: 0,
    adminMinutes: 0, studyMinutes: 0, recoveryMinutes: 0,
    completedBlocks: 0, partialBlocks: 0, skippedBlocks: 0,
    mainFocusArea: 'None recorded', usefulOutputSummary: '', blocks,
  }

  blocks.forEach(item => {
    const normalizedStatus = item.status.toLowerCase()
    if (normalizedStatus === 'done' || normalizedStatus === 'followed') stats.completedBlocks += 1
    if (normalizedStatus === 'partial') stats.partialBlocks += 1
    if (normalizedStatus === 'skipped') stats.skippedBlocks += 1
    const category = categoryFor(item.area, item.type, item.title)
    if (category) stats[category] += item.countedMinutes
    if (isFocus(item.area, item.type)) stats.focusMinutes += item.countedMinutes
  })

  const productive: Array<[string, number]> = [
    ['Vibe Coding', stats.vibeCodingMinutes], ['Cyber', stats.cyberMinutes],
    ['AI', stats.aiMinutes], ['English Output', stats.englishOutputMinutes],
    ['Expression Review', stats.expressionReviewMinutes], ['Job', stats.jobMinutes],
    ['Admin', stats.adminMinutes], ['Study', stats.studyMinutes],
  ]
  const main = productive.sort((a, b) => b[1] - a[1])[0]
  stats.mainFocusArea = main && main[1] > 0 ? main[0] : stats.recoveryMinutes > 0 ? 'Recovery' : 'None recorded'
  stats.usefulOutputSummary = usefulSummary(stats)
  return stats
}
