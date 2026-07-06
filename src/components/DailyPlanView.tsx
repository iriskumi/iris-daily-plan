import { useEffect, useMemo, useState } from 'react'
import {
  Copy,
  Check,
  Zap,
  Sparkles,
  Sun,
  Cloud,
  Moon,
  Heart,
  LogOut,
  Briefcase,
  CreditCard,
  XCircle,
  Shield,
  BookOpen,
  Pencil,
  CopyPlus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Play,
  Wrench,
} from 'lucide-react'
import type { DailyLog, GeneratedPlan, TimeBlock, TimeBlockFollowUp } from '../types'
import {
  getLatestStartPlanForDate,
  loadBills,
  loadCalendarEvents,
  loadCheckin,
  loadDailyLog,
  loadFocusBlocksForDate,
  loadFocusSessions,
  loadOpportunities,
  loadTasks,
  loadTimeBlockFollowUps,
  saveDailyLog,
  saveFocusBlock,
  saveTasks,
  saveTimeBlockFollowUp,
} from '../storage'
import { formatFocusStatsMarkdown, getFocusStats, getLocalDateKey } from '../focus'
import {
  formatCarryOverSuggestions,
  getCarryOverSuggestions,
  getRealityCheck,
} from '../productivity'
import {
  checkNotionSchema,
  createMissingNotionProperties,
  exportPlanToNotion,
} from '../services/notionService'
import { summarizeToday } from '../services/aiService'
import FocusGarden from './FocusGarden'
import { calculateDailyTimeStatistics } from '../dailyTimeStats'
import {
  NOTION_SCHEMA_MANUAL_INSTRUCTIONS,
  type NotionSchemaCheckResult,
} from '../notionSchema'

const PERIOD_ICONS: Record<TimeBlock['period'], React.ReactNode> = {
  morning: <Sun size={13} />,
  afternoon: <Cloud size={13} />,
  evening: <Moon size={13} />,
  recovery: <Heart size={13} />,
  shutdown: <LogOut size={13} />,
}

function getTimeBlockTitle(block: TimeBlock): string {
  return block.title || block.label
}

function getTimeBlockRange(block: TimeBlock): string | null {
  if (!block.startTime || !block.endTime) return null
  return `${block.startTime}-${block.endTime}`
}

function getTimeBlockKey(block: TimeBlock, index: number): string {
  if (block.id) return block.id
  return [
    block.startTime ?? 'no-start',
    block.endTime ?? 'no-end',
    block.period,
    block.type ?? 'block',
    block.title ?? block.label,
    index,
  ].join('|')
}

const BLOCK_TYPES: NonNullable<TimeBlock['type']>[] = [
  'meal', 'reset', 'focus', 'light', 'admin', 'class', 'break', 'recovery',
  'buffer', 'project', 'output', 'input', 'review', 'planning',
]

function minutesFromTime(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatMinutes(value: number): string {
  const wrapped = ((value % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

function periodFromTime(value?: string): TimeBlock['period'] {
  const minutes = minutesFromTime(value)
  if (minutes === null || minutes < 12 * 60) return 'morning'
  if (minutes < 17 * 60) return 'afternoon'
  return 'evening'
}

function blockWarnings(block: TimeBlock, blocks: TimeBlock[]): string[] {
  const start = minutesFromTime(block.startTime)
  const end = minutesFromTime(block.endTime)
  const warnings: string[] = []
  if (start !== null && end !== null && end <= start) warnings.push('End time is before the start time.')
  if (start !== null && end !== null && end > start) {
    const overlaps = blocks.some(other => {
      if (other.id === block.id) return false
      const otherStart = minutesFromTime(other.startTime)
      const otherEnd = minutesFromTime(other.endTime)
      return otherStart !== null && otherEnd !== null && otherEnd > otherStart && start < otherEnd && end > otherStart
    })
    if (overlaps) warnings.push('This block overlaps another block.')
  }
  return warnings
}

const FOLLOW_UP_OPTIONS = [
  { value: 'followed', label: 'Followed' },
  { value: 'partial', label: 'Partial' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'changed', label: 'Changed' },
] as const

const IRIS_GROUNDING_LINE = '不要把今天和理想中的自己比较，只要把今天和半年前的自己比较。'

function getPlanSourceLabel(plan: GeneratedPlan): string {
  if (plan.aiUsed && plan.provider === 'gemini') return 'Gemini'
  if (plan.aiUsed && plan.provider === 'deepseek') return 'DeepSeek'
  if (plan.aiUsed && plan.provider === 'openai') return 'OpenAI'
  return 'Local'
}

function todayString() {
  return getLocalDateKey()
}

function morningPriorityLines(date = getLocalDateKey()) {
  const checkin = loadCheckin(date)
  if (!checkin) return []
  const rankedTasks = (checkin.rankedTasks ?? [])
    .filter(task => task.title.trim())
    .sort((a, b) => a.orderIndex - b.orderIndex)
  if (rankedTasks.length > 0) {
    return rankedTasks.map((task, index) =>
      `${index + 1}. ${task.title.trim()} · ${task.area} · ${task.estimatedMinutes} min`,
    )
  }
  return [
    checkin.morningMainTask?.trim() ? `Main: ${checkin.morningMainTask.trim()}` : '',
    checkin.morningSecondaryTask1?.trim() ? `Secondary 1: ${checkin.morningSecondaryTask1.trim()}` : '',
    checkin.morningSecondaryTask2?.trim() ? `Secondary 2: ${checkin.morningSecondaryTask2.trim()}` : '',
    checkin.morningSmallLifeTask?.trim() ? `Small life: ${checkin.morningSmallLifeTask.trim()}` : '',
  ].filter(Boolean)
}

function logHasContent(log: DailyLog): boolean {
  return [
    log.actualDone,
    log.whatChanged,
    log.energyAfterDoing,
    log.notes,
    log.carryOverToTomorrow,
  ].some(value => value.trim())
}

function dailyLogMarkdown(log: DailyLog): string {
  if (!logHasContent(log)) {
    return [
      '## Actual Done & Notes',
      '- Actual Done: ',
      '- What changed?: ',
      '- Energy after doing: ',
      '- Notes: ',
      '- Carry over to tomorrow: ',
    ].join('\n')
  }

  return [
    '## Actual Done & Notes',
    `### Actual Done\n${log.actualDone.trim() || '- Not recorded'}`,
    `### What changed?\n${log.whatChanged.trim() || '- Not recorded'}`,
    `### Energy after doing\n${log.energyAfterDoing.trim() || '- Not recorded'}`,
    `### Notes\n${log.notes.trim() || '- Not recorded'}`,
    `### Carry over to tomorrow\n${log.carryOverToTomorrow.trim() || '- Not recorded'}`,
  ].join('\n\n')
}

function planMarkdownWithDailyLog(plan: GeneratedPlan, dailyLog: DailyLog): string {
  return [
    plan.notionMarkdown,
    dailyLogMarkdown(dailyLog),
    formatFocusStatsMarkdown(getFocusStats(loadFocusSessions())),
  ].join('\n\n')
}

function followUpsMarkdown(plan: GeneratedPlan, followUps: Record<string, TimeBlockFollowUp>): string {
  const lines = plan.timeBlocks.map((block, index) => {
    const blockKey = getTimeBlockKey(block, index)
    const followUp = followUps[blockKey]
    const range = getTimeBlockRange(block) ?? block.label
    const status = followUp?.status || 'not recorded'
    const notes = followUp?.notes.trim() ? ` - ${followUp.notes.trim()}` : ''
    return `- ${range} ${getTimeBlockTitle(block)}: ${status}${notes}`
  })
  return ['## Time Block Follow-up', ...lines].join('\n')
}

function startPlanMarkdown(planDate: string): string {
  const startPlan = getLatestStartPlanForDate(planDate)
  if (!startPlan) return ''
  return [
    '## Start Now',
    `- Did I start?: ${startPlan.markedStarted ? 'Yes' : 'Not yet'}`,
    `- What helped me start?: ${startPlan.firstTinyAction}`,
    `- Body reset: ${startPlan.bodyReset}`,
    `- Opened: ${startPlan.openThis}`,
    `- Timer: ${startPlan.timerMinutes} min`,
  ].join('\n')
}

function focusBlocksMarkdown(planDate: string): string {
  const blocks = loadFocusBlocksForDate(planDate)
  if (blocks.length === 0) return ''
  return [
    '## Focus Blocks',
    ...blocks.map(block => {
      const time = new Date(block.startTime).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const notes = block.notes.trim() ? ` - ${block.notes.trim()}` : ''
      return `- ${time} · ${block.minutes}m · ${block.taskTitle} · ${block.area} · ${block.status}${notes}`
    }),
  ].join('\n')
}

function morningPrioritiesMarkdown(): string {
  const lines = morningPriorityLines()
  if (lines.length === 0) return ''
  return ["## Today's to-do", ...lines.map(line => `- ${line}`)].join('\n')
}

interface Props {
  plan: GeneratedPlan | null
  onGenerate: () => void
  onRegenerate: (feedback: string) => void
  onGoToCheckin: () => void
  onReducePlan: () => void
  onPlanChange: (plan: GeneratedPlan) => void
}

export default function DailyPlanView({
  plan,
  onGenerate,
  onRegenerate,
  onGoToCheckin,
  onReducePlan,
  onPlanChange,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [notionStatus, setNotionStatus] = useState<string | null>(null)
  const [notionUrl, setNotionUrl] = useState<string | null>(null)
  const [pushingNotion, setPushingNotion] = useState(false)
  const [finishingDay, setFinishingDay] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [blockDraft, setBlockDraft] = useState<{ index: number; block: TimeBlock } | null>(null)
  const [editingPriorities, setEditingPriorities] = useState(false)
  const [blockActionMessage, setBlockActionMessage] = useState<string | null>(null)
  const [notionSchema, setNotionSchema] = useState<NotionSchemaCheckResult | null>(null)
  const [notionSchemaMessage, setNotionSchemaMessage] = useState<string | null>(null)
  const [checkingNotionSchema, setCheckingNotionSchema] = useState(false)
  const [followUps, setFollowUps] = useState(() =>
    plan ? loadTimeBlockFollowUps(plan.date) : {},
  )
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(() =>
    plan ? loadDailyLog(plan.date) : null,
  )

  useEffect(() => {
    setDailyLog(plan ? loadDailyLog(plan.date) : null)
    setFollowUps(plan ? loadTimeBlockFollowUps(plan.date) : {})
  }, [plan?.date])

  const markdownForCopy = useMemo(() => {
    if (!plan) return ''
    return [
      planMarkdownWithDailyLog(plan, dailyLog ?? loadDailyLog(plan.date)),
      startPlanMarkdown(plan.date),
      focusBlocksMarkdown(plan.date),
      morningPrioritiesMarkdown(),
      followUpsMarkdown(plan, followUps),
    ].filter(Boolean).join('\n\n')
  }, [plan, dailyLog, followUps])

  const carryOverSuggestions = useMemo(() => {
    if (!plan) return []
    return getCarryOverSuggestions(loadTasks(), dailyLog ?? loadDailyLog(plan.date))
  }, [plan, dailyLog])

  async function handleCopy() {
    if (!plan) return
    await navigator.clipboard.writeText(markdownForCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function updateDailyLog<K extends keyof DailyLog>(key: K, value: DailyLog[K]) {
    if (!dailyLog) return
    const updated = {
      ...dailyLog,
      [key]: value,
    }
    setDailyLog(updated)
    saveDailyLog(updated)
  }

  function updateFollowUp(
    block: TimeBlock,
    index: number,
    patch: Partial<Pick<TimeBlockFollowUp, 'status' | 'notes'>>,
  ) {
    if (!plan) return
    const blockKey = getTimeBlockKey(block, index)
    const current = followUps[blockKey] ?? {
      date: plan.date,
      blockKey,
      status: '',
      notes: '',
      updatedAt: new Date().toISOString(),
    }
    const next = {
      ...current,
      ...patch,
      date: plan.date,
      blockKey,
      updatedAt: new Date().toISOString(),
    }
    setFollowUps(prev => ({ ...prev, [blockKey]: next }))
    saveTimeBlockFollowUp(next)
    const followUpStatus = patch.status
    if (followUpStatus) {
      const statusByFollowUp: Record<Exclude<TimeBlockFollowUp['status'], ''>, NonNullable<TimeBlock['status']>> = {
        followed: 'Followed', partial: 'Partial', skipped: 'Skipped', changed: 'Changed',
      }
      persistPlan({
        ...plan,
        timeBlocks: plan.timeBlocks.map(item => item.id === block.id
          ? { ...item, status: statusByFollowUp[followUpStatus], updatedAt: new Date().toISOString() }
          : item),
      })
    }
  }

  function persistPlan(next: GeneratedPlan) {
    onPlanChange(next)
  }

  function beginBlockEdit(block: TimeBlock, index: number) {
    const identity = block.id ?? getTimeBlockKey(block, index)
    const details = block.bullets ?? block.items ?? (block.details ? block.details.split('\n') : [])
    setEditingBlockId(identity)
    setBlockDraft({
      index,
      block: { ...block, id: identity, items: [...details], bullets: [...details] },
    })
  }

  function updateBlockDraft(patch: Partial<TimeBlock>) {
    setBlockDraft(current => current ? { ...current, block: { ...current.block, ...patch } } : current)
  }

  function cancelBlockEdit() {
    setEditingBlockId(null)
    setBlockDraft(null)
  }

  function saveBlockEdit() {
    if (!plan || !blockDraft) return
    const items = (blockDraft.block.bullets ?? blockDraft.block.items ?? [])
      .map(item => item.trim())
      .filter(Boolean)
    const original = plan.timeBlocks[blockDraft.index]
    if (!original) return
    const savedBlock: TimeBlock = {
      ...original,
      ...blockDraft.block,
      id: original.id ?? blockDraft.block.id ?? crypto.randomUUID(),
      date: plan.date,
      period: periodFromTime(blockDraft.block.startTime),
      label: blockDraft.block.startTime && blockDraft.block.endTime
        ? `${blockDraft.block.startTime}-${blockDraft.block.endTime}`
        : blockDraft.block.label,
      items,
      bullets: items,
      details: blockDraft.block.details === undefined ? undefined : items.join('\n'),
      manualEdited: true,
      updatedAt: new Date().toISOString(),
    }
    persistPlan({
      ...plan,
      timeBlocks: plan.timeBlocks.map((block, index) => index === blockDraft.index ? savedBlock : block),
    })
    setEditingBlockId(null)
    setBlockDraft(null)
    setBlockActionMessage(`Saved changes to ${getTimeBlockTitle(savedBlock)}`)
  }

  function insertBlock(index: number, block: TimeBlock) {
    if (!plan) return
    const next = [...plan.timeBlocks]
    next.splice(index, 0, block)
    persistPlan({ ...plan, timeBlocks: next })
  }

  function duplicateBlock(index: number) {
    if (!plan) return
    const source = plan.timeBlocks[index]
    const now = new Date().toISOString()
    insertBlock(index + 1, {
      ...source,
      id: crypto.randomUUID(),
      title: `${getTimeBlockTitle(source)} copy`,
      source: 'manual',
      manualEdited: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  function addBlockAfter(index: number) {
    if (!plan) return
    const previous = plan.timeBlocks[index]
    const startTime = previous.endTime ?? previous.startTime ?? '09:00'
    const start = minutesFromTime(startTime) ?? 9 * 60
    const now = new Date().toISOString()
    const block: TimeBlock = {
      id: crypto.randomUUID(), date: plan.date, period: periodFromTime(startTime),
      label: `${startTime}-${formatMinutes(start + 25)}`, startTime,
      endTime: formatMinutes(start + 25), title: 'New block', type: 'focus',
      items: [], bullets: [], source: 'manual', status: 'Planned', notes: '',
      manualEdited: true, createdAt: now, updatedAt: now,
    }
    insertBlock(index + 1, block)
    beginBlockEdit(block, index + 1)
  }

  function deleteBlock(index: number) {
    if (!plan || !window.confirm('Delete this time block?')) return
    persistPlan({ ...plan, timeBlocks: plan.timeBlocks.filter((_, itemIndex) => itemIndex !== index) })
    if (blockDraft?.index === index) cancelBlockEdit()
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (!plan) return
    const target = index + direction
    if (target < 0 || target >= plan.timeBlocks.length) return
    const blocks = [...plan.timeBlocks]
    ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
    persistPlan({ ...plan, timeBlocks: blocks })
  }

  function startBlockAsFocus(block: TimeBlock) {
    if (!plan) return
    const start = new Date()
    const duration = Math.max(5, (minutesFromTime(block.endTime) ?? 0) - (minutesFromTime(block.startTime) ?? -25))
    saveFocusBlock({
      id: crypto.randomUUID(), date: plan.date, startTime: start.toISOString(),
      plannedEndTime: new Date(start.getTime() + duration * 60000).toISOString(),
      minutes: duration, taskId: block.taskId ?? block.id ?? crypto.randomUUID(),
      taskTitle: getTimeBlockTitle(block), area: block.type === 'project' ? 'Vibe Coding' : block.type === 'admin' ? 'Admin' : 'Study',
      mode: block.type === 'admin' ? 'Admin' : block.type === 'recovery' ? 'Recovery' : block.type === 'light' ? 'Light' : 'Focus',
      energy: duration >= 60 ? 'High' : duration >= 25 ? 'Medium' : 'Low',
      firstTinyAction: block.items[0] ?? `Begin ${getTimeBlockTitle(block)}`,
      status: 'Doing', notes: block.notes ?? '', createdAt: start.toISOString(), updatedAt: start.toISOString(),
    })
    setBlockActionMessage(`Focus block started: ${getTimeBlockTitle(block)}`)
  }

  function updatePriority(index: number, patch: Partial<GeneratedPlan['top3'][number]>) {
    if (!plan) return
    persistPlan({
      ...plan,
      top3: plan.top3.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
      prioritiesManualEdited: true,
    })
  }

  function movePriority(index: number, direction: -1 | 1) {
    if (!plan) return
    const target = index + direction
    if (target < 0 || target >= plan.top3.length) return
    const top3 = [...plan.top3]
    ;[top3[index], top3[target]] = [top3[target], top3[index]]
    persistPlan({ ...plan, top3, prioritiesManualEdited: true })
  }

  function fixObviousTimes() {
    if (!plan || !window.confirm('Move non-sleep blocks between 00:00 and 05:00 forward by 12 hours?')) return
    const now = new Date().toISOString()
    persistPlan({
      ...plan,
      timeBlocks: plan.timeBlocks.map(block => {
        const start = minutesFromTime(block.startTime)
        const end = minutesFromTime(block.endTime)
        if (start === null || start >= 300 || block.type === 'recovery') return block
        return { ...block, startTime: formatMinutes(start + 720), endTime: end === null ? block.endTime : formatMinutes(end + 720), period: periodFromTime(formatMinutes(start + 720)), manualEdited: true, updatedAt: now }
      }),
    })
  }

  function handleRegenerate() {
    const trimmed = feedback.trim()
    if (!trimmed) return
    onRegenerate(trimmed)
  }

  async function handlePushNotion() {
    if (!plan) return
    setPushingNotion(true)
    setNotionStatus(null)
    setNotionUrl(null)
    const result = await exportPlanToNotion(
      plan,
      dailyLog ?? loadDailyLog(plan.date),
      getFocusStats(loadFocusSessions()),
      {
        checkin: loadCheckin(plan.date),
        tasks: loadTasks(),
        calendarEvents: loadCalendarEvents(),
        opportunities: loadOpportunities(),
        bills: loadBills(),
        markdown: markdownForCopy,
        followUps: Object.values(followUps),
        focusBlocks: loadFocusBlocksForDate(plan.date),
      },
    )
    setPushingNotion(false)
    setNotionStatus(result.message)
    setNotionUrl(result.data?.pageUrl ?? null)
  }

  async function handleNotionSchema(createMissing = false) {
    setCheckingNotionSchema(true)
    const result = createMissing
      ? await createMissingNotionProperties()
      : await checkNotionSchema()
    setCheckingNotionSchema(false)
    setNotionSchema(result.data)
    setNotionSchemaMessage(result.message)
  }

  async function handleFinishDay() {
    if (!plan) return
    setFinishingDay(true)
    setNotionStatus(null)
    setNotionUrl(null)
    const currentLog = dailyLog ?? loadDailyLog(plan.date)
    const focusStatsNow = getFocusStats(loadFocusSessions())
    const response = await summarizeToday({
      plan,
      tasks: loadTasks(),
      bills: loadBills(),
      opportunities: loadOpportunities(),
      calendarEvents: loadCalendarEvents(),
      dailyLog: currentLog,
      focusStats: focusStatsNow,
    })
    const updatedLog = {
      ...currentLog,
      eveningSummary: response.data ?? response.message,
    }
    setDailyLog(updatedLog)
    saveDailyLog(updatedLog)
    const result = await exportPlanToNotion(
      plan,
      updatedLog,
      focusStatsNow,
      {
        checkin: loadCheckin(plan.date),
        tasks: loadTasks(),
        calendarEvents: loadCalendarEvents(),
        opportunities: loadOpportunities(),
        bills: loadBills(),
        markdown: [
          planMarkdownWithDailyLog(plan, updatedLog),
          startPlanMarkdown(plan.date),
          focusBlocksMarkdown(plan.date),
          morningPrioritiesMarkdown(),
          followUpsMarkdown(plan, followUps),
        ].filter(Boolean).join('\n\n'),
        followUps: Object.values(followUps),
        focusBlocks: loadFocusBlocksForDate(plan.date),
      },
    )
    setFinishingDay(false)
    setNotionStatus(result.message)
    setNotionUrl(result.data?.pageUrl ?? null)
  }

  function handleApplyCarryOverSuggestions() {
    if (!dailyLog) return
    const suggestions = getCarryOverSuggestions(loadTasks(), dailyLog)
    const updatedTasks = loadTasks().map(task => {
      const suggestion = suggestions.find(item => item.taskId === task.id)
      if (!suggestion) return task
      if (suggestion.classification === 'reduce') {
        return {
          ...task,
          estimatedMinutes: Math.min(task.estimatedMinutes, 25),
          nextAction: suggestion.suggestedAction,
        }
      }
      if (suggestion.classification === 'postpone') {
        return { ...task, urgency: 'low' as const }
      }
      if (suggestion.classification === 'delete-ignore') {
        return { ...task, done: true }
      }
      return task
    })
    saveTasks(updatedTasks)
    const updatedLog = {
      ...dailyLog,
      carryOverToTomorrow: formatCarryOverSuggestions(suggestions),
    }
    setDailyLog(updatedLog)
    saveDailyLog(updatedLog)
  }

  if (!plan) {
    return (
      <div className="page">
        <div className="empty-state" style={{ paddingTop: '4rem' }}>
          <span className="empty-state-emoji">📋</span>
          <h3>No plan generated yet</h3>
          <p>
            Fill in your check-in, add tasks and bills, then generate today's plan.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onGoToCheckin}>
              Go to Check-in
            </button>
            <button className="btn btn-secondary" onClick={onGenerate}>
              <Zap size={14} />
              Generate anyway
            </button>
          </div>
        </div>
      </div>
    )
  }

  const planDate = new Date(plan.date + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const generatedTime = new Date(plan.generatedAt).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const sourceLabel = getPlanSourceLabel(plan)
  const log = dailyLog ?? loadDailyLog(plan.date)
  const latestStartPlan = getLatestStartPlanForDate(plan.date)
  const focusBlocksToday = loadFocusBlocksForDate(plan.date)
  const isStalePlan = plan.date < todayString()
  const focusStats = getFocusStats(loadFocusSessions())
  const realityCheck = getRealityCheck(plan)
  const morningPriorities = morningPriorityLines(plan.date)
  const isEveningMode = new Date().getHours() >= 17
  const notionTimeStats = calculateDailyTimeStatistics({
    plan,
    focusBlocks: focusBlocksToday,
    followUps: Object.values(followUps),
    tasks: loadTasks(),
  })

  return (
    <div className="page plan-page">
      <div className="page-header plan-page-header">
        <div>
          <h2 className="page-title">Daily Plan</h2>
          {isStalePlan && (
            <div className="stale-plan-warning">
              <span>This plan is from yesterday — regenerate for today?</span>
              <button onClick={onGenerate}>Regenerate</button>
            </div>
          )}
        </div>
        <div className="plan-source-pill">
          <Sparkles size={11} />
          {sourceLabel}
        </div>
      </div>

      <div className="grounding-banner">
        <p className="today-note-quote-cn" lang="zh-Hans">{IRIS_GROUNDING_LINE}</p>
        {plan.dailyPlanBase === 'english-ai-cyber-growth' && (
          <span>
            {isEveningMode
              ? 'Evening mode: quiet input and light review.'
              : 'This is your default growth-day scaffold. Add today’s real tasks into the blocks.'}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="plan-header">
        <div className="plan-date-label">{planDate}</div>
        <div className="plan-theme">{plan.theme}</div>
        <div className="plan-meta">Generated at {generatedTime}</div>
        {plan.fallbackReason && (
          <div className="plan-fallback-note">
            ⚠ Using local planner · Gemini unavailable
          </div>
        )}
      </div>

      {realityCheck && (
        <div className={`reality-card ${realityCheck.load === 'Too much' ? 'too-much' : ''}`}>
          <div>
            <div className="plan-section-title">Reality Check</div>
            <div className="reality-load">Today load: {realityCheck.load}</div>
            <div className="reality-meta">
              {realityCheck.estimatedFocusBlocks} focus blocks · {realityCheck.estimatedFocusMinutes} focus minutes
            </div>
            <ul className="plan-list">
              {realityCheck.riskNotes.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div className="reality-actions">
            {realityCheck.load === 'Too much' && (
              <button className="btn btn-primary" onClick={onReducePlan}>
                Reduce plan
              </button>
            )}
            <button className="btn btn-secondary" onClick={onReducePlan}>
              Low Energy Mode
            </button>
          </div>
        </div>
      )}

      {morningPriorities.length > 0 && (
        <div className="plan-section">
          <div className="plan-section-title">Today’s to-do</div>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <ul className="plan-list">
              {morningPriorities.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Top 3 Priorities */}
      {plan.top3.length > 0 && (
        <div className="plan-section">
          <div className="plan-section-heading-row">
            <div className="plan-section-title">
              <Shield size={12} />
              Top {plan.top3.length} Priorities
            </div>
            <button className="plan-text-action" onClick={() => setEditingPriorities(value => !value)}>
              <Pencil size={13} /> {editingPriorities ? 'Done' : 'Edit'}
            </button>
          </div>
          <div className="top3-list">
            {plan.top3.map((item, i) => (
              <div key={i} className="top3-item">
                <div className="top3-num">priority {i + 1}</div>
                {editingPriorities ? (
                  <div className="priority-edit-form">
                    <input aria-label={`Priority ${i + 1} title`} value={item.task} onChange={event => updatePriority(i, { task: event.target.value })} />
                    <textarea aria-label={`Priority ${i + 1} next action`} value={item.nextAction} onChange={event => updatePriority(i, { nextAction: event.target.value })} />
                    <div className="plan-inline-actions">
                      <button onClick={() => movePriority(i, -1)} disabled={i === 0} aria-label="Move priority up"><ArrowUp size={14} /></button>
                      <button onClick={() => movePriority(i, 1)} disabled={i === plan.top3.length - 1} aria-label="Move priority down"><ArrowDown size={14} /></button>
                      <button onClick={() => persistPlan({ ...plan, top3: plan.top3.filter((_, index) => index !== i), prioritiesManualEdited: true })}><Trash2 size={14} /> Remove</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="top3-task">{item.task}</div>
                    <div className="top3-action">{item.nextAction}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Blocks */}
      <div className="plan-section">
        <div className="plan-section-heading-row">
          <div className="plan-section-title">
            <Sun size={12} />
            Time Blocks
          </div>
          {plan.timeBlocks.some(block => {
            const start = minutesFromTime(block.startTime)
            return start !== null && start < 300 && block.type !== 'recovery'
          }) && (
            <button className="plan-text-action" onClick={fixObviousTimes}><Wrench size={13} /> Fix obvious times</button>
          )}
        </div>
        {blockActionMessage && <div className="plan-action-message">{blockActionMessage}</div>}
        {plan.timeBlocks.map((block, i) => {
          const blockKey = getTimeBlockKey(block, i)
          const isEditing = editingBlockId === (block.id ?? blockKey)
          const draftBlock = isEditing && blockDraft?.index === i ? blockDraft.block : null
          const blocksForValidation = draftBlock
            ? plan.timeBlocks.map((item, index) => index === i ? draftBlock : item)
            : plan.timeBlocks
          const warnings = blockWarnings(draftBlock ?? block, blocksForValidation)
          const outputHeavyEvening =
            block.outputLevel === 'high' &&
            Boolean(block.startTime && block.startTime >= '17:00')
          const followUp = followUps[blockKey] ?? {
            date: plan.date,
            blockKey,
            status: '',
            notes: '',
            updatedAt: '',
          }
          return (
          <div key={block.id ?? i} className={`time-block time-block-${block.type ?? 'default'}`}>
            <div className="time-block-header">
              <span className="time-block-icon">{PERIOD_ICONS[block.period]}</span>
              {getTimeBlockRange(block) && (
                <span className="time-block-range">{getTimeBlockRange(block)}</span>
              )}
              <span>{getTimeBlockTitle(block)}</span>
              {block.type && (
                <span className={`time-block-type time-block-type-${block.type}`}>
                  {block.type}
                </span>
              )}
            </div>
            <div className="time-block-body">
              <div className="time-block-actions" aria-label={`Actions for ${getTimeBlockTitle(block)}`}>
                <button type="button" disabled={isEditing} onClick={event => { event.stopPropagation(); beginBlockEdit(block, i) }}><Pencil size={13} /> Edit</button>
                <button type="button" onClick={() => duplicateBlock(i)}><CopyPlus size={13} /> Duplicate</button>
                <button type="button" onClick={() => deleteBlock(i)}><Trash2 size={13} /> Delete</button>
                <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} aria-label="Move block up"><ArrowUp size={13} /></button>
                <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === plan.timeBlocks.length - 1} aria-label="Move block down"><ArrowDown size={13} /></button>
                <button type="button" onClick={() => addBlockAfter(i)}><Plus size={13} /> Add after</button>
                <button type="button" onClick={() => startBlockAsFocus(block)}><Play size={13} /> Start focus</button>
              </div>
              {draftBlock ? (
                <div className="time-block-edit-form">
                  <label>Start time<input type="time" value={draftBlock.startTime ?? ''} onChange={event => updateBlockDraft({ startTime: event.target.value })} /></label>
                  <label>End time<input type="time" value={draftBlock.endTime ?? ''} onChange={event => updateBlockDraft({ endTime: event.target.value })} /></label>
                  <label className="edit-field-wide">Title<input value={draftBlock.title ?? draftBlock.label} onChange={event => updateBlockDraft({ title: event.target.value })} /></label>
                  <label>Type<select value={draftBlock.type ?? 'focus'} onChange={event => updateBlockDraft({ type: event.target.value as TimeBlock['type'] })}>{BLOCK_TYPES.map(type => <option key={type} value={type}>{type.toUpperCase()}</option>)}</select></label>
                  <label className="edit-field-wide">Bullets / details<textarea value={(draftBlock.bullets ?? draftBlock.items ?? []).join('\n')} onChange={event => updateBlockDraft({ bullets: event.target.value.split('\n') })} placeholder="One detail per line" /></label>
                  <label className="edit-field-wide">Location or link<input value={draftBlock.location ?? ''} onChange={event => updateBlockDraft({ location: event.target.value })} /></label>
                  <label className="edit-field-wide">Plan notes<textarea value={draftBlock.notes ?? ''} onChange={event => updateBlockDraft({ notes: event.target.value })} /></label>
                  <div className="edit-field-wide block-edit-buttons">
                    <button type="button" className="btn btn-primary" onClick={saveBlockEdit}>Save</button>
                    <button type="button" className="btn btn-secondary" onClick={cancelBlockEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <ul>{block.items.map((item, j) => item.trim() && <li key={j}>{item}</li>)}</ul>
                  {block.location && <a className="time-block-location" href={/^https?:\/\//.test(block.location) ? block.location : undefined} target="_blank" rel="noreferrer">{block.location}</a>}
                  {block.notes && <p className="time-block-plan-note">{block.notes}</p>}
                </>
              )}
              {warnings.map(warning => <div className="time-block-warning" key={warning}>{warning}</div>)}
              {outputHeavyEvening && (
                <div className="evening-output-warning">
                  This is an output-heavy task. Evening mode is usually quieter.
                </div>
              )}
              <div className="time-block-follow-up">
                <div className="follow-up-options" role="group" aria-label={`Follow-up for ${getTimeBlockTitle(block)}`}>
                  {FOLLOW_UP_OPTIONS.map(option => (
                    <button
                      type="button"
                      key={option.value}
                      className={`follow-up-option-${option.value} ${followUp.status === option.value ? 'active' : ''}`}
                      onClick={() => updateFollowUp(block, i, { status: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <textarea
                  placeholder="Notes: what actually happened in this block?"
                  value={followUp.notes}
                  onChange={e => updateFollowUp(block, i, { notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {/* Must-do + Optional */}
      {plan.mustDo.length > 0 && (
        <div className="plan-section">
          <div className="plan-section-title">Must-do today</div>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <ul className="plan-list">
              {plan.mustDo.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {plan.optional.length > 0 && (
        <div className="plan-section">
          <div className="plan-section-title">Optional (if energy allows)</div>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <ul className="plan-list">
              {plan.optional.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Work Leads */}
      <div className="plan-section">
        <div className="plan-section-title">
          <Briefcase size={12} />
          Work reminders
        </div>
        <div className="card" style={{ padding: '0.875rem 1rem' }}>
          {plan.workLeadsToday.length > 0 ? (
            <ul className="plan-list">
              {plan.workLeadsToday.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No urgent leads today.</p>
          )}
        </div>
      </div>

      {/* Bills */}
      {plan.billsToday.length > 0 && (
        <div className="plan-section">
          <div className="plan-section-title" style={{ color: 'var(--amber)' }}>
            <CreditCard size={12} />
            Bills to handle today
          </div>
          <div
            className="card"
            style={{ padding: '0.875rem 1rem', borderColor: 'var(--amber-border)', background: 'var(--amber-bg)' }}
          >
            <ul className="plan-list">
              {plan.billsToday.map((b, i) => (
                <li key={i} style={{ color: 'var(--amber)' }}>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Do Not Today */}
      {plan.doNotToday.length > 0 && (
        <div className="plan-section">
          <div className="plan-section-title" style={{ color: 'var(--text-3)' }}>
            <XCircle size={12} />
            Do not do today
          </div>
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <ul className="plan-list plan-list-doNot">
              {plan.doNotToday.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Minimum Viable Day */}
      <div className="plan-section">
        <div className="plan-mvd">
          <div className="plan-mvd-title">Minimum Viable Day</div>
          <ul className="plan-mvd">
            {plan.minimumViableDay.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="plan-section">
        <div className="plan-section-title">Daily Reality</div>
        <div className="actual-log-card">
          <FocusGarden stats={focusStats} compact />
          {latestStartPlan && (
            <div className="start-now-evening-card">
              <div className="plan-section-title">Start Now reflection</div>
              <div className="start-now-evening-grid">
                <div>
                  <span>Did I start?</span>
                  <strong>{latestStartPlan.markedStarted ? 'Yes' : 'Not yet'}</strong>
                </div>
                <div>
                  <span>What helped me start?</span>
                  <strong>{latestStartPlan.firstTinyAction}</strong>
                </div>
              </div>
            </div>
          )}
          {focusBlocksToday.length > 0 && (
            <div className="start-now-evening-card">
              <div className="plan-section-title">Today’s Focus Blocks</div>
              <div className="evening-block-list">
                {focusBlocksToday.map(block => (
                  <div key={block.id}>
                    <span>
                      {new Date(block.startTime).toLocaleTimeString('en-AU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} · {block.minutes}m · {block.area}
                    </span>
                    <strong>{block.taskTitle}</strong>
                    <em>{block.status}{block.notes.trim() ? ` · ${block.notes.trim()}` : ''}</em>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <label>What I actually did</label>
            <textarea
              value={log.actualDone}
              onChange={e => updateDailyLog('actualDone', e.target.value)}
              style={{ minHeight: 88 }}
            />
          </div>
          <div className="form-group">
            <label>What changed from the plan</label>
            <textarea
              value={log.whatChanged}
              onChange={e => updateDailyLog('whatChanged', e.target.value)}
              style={{ minHeight: 78 }}
            />
          </div>
          <div className="form-group">
            <label>Why I drifted</label>
            <textarea
              value={log.notes}
              onChange={e => updateDailyLog('notes', e.target.value)}
              style={{ minHeight: 64 }}
            />
          </div>
          <div className="form-group">
            <label>Energy / mood notes</label>
            <textarea
              value={log.energyAfterDoing}
              onChange={e => updateDailyLog('energyAfterDoing', e.target.value)}
              style={{ minHeight: 88 }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Carry-over notes</label>
            <textarea
              value={log.carryOverToTomorrow}
              onChange={e => updateDailyLog('carryOverToTomorrow', e.target.value)}
              style={{ minHeight: 88 }}
            />
          </div>
          {carryOverSuggestions.length > 0 && (
            <div className="carryover-review">
              <div className="plan-section-title">Carry-over suggestions</div>
              <div className="carryover-list">
                {carryOverSuggestions.map(item => (
                  <div key={item.taskId} className="carryover-item">
                    <span className="carryover-type">{item.classification.replace('-', ' / ')}</span>
                    <span className="carryover-title">{item.taskTitle}</span>
                    <span className="carryover-reason">{item.reason}</span>
                    <span className="carryover-action">{item.suggestedAction}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={handleApplyCarryOverSuggestions}>
                Apply carry-over suggestions
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Copy to Notion */}
      <div className="plan-section">
        <div className="plan-section-title">Notion Daily Log</div>
        <div className="notion-export-card">
          <div className="notion-time-preview" aria-label="Notion time statistics preview">
            <div><span>Focus Minutes</span><strong>{notionTimeStats.focusMinutes}</strong></div>
            <div><span>Vibe Coding</span><strong>{notionTimeStats.vibeCodingMinutes}</strong></div>
            <div><span>Cyber</span><strong>{notionTimeStats.cyberMinutes}</strong></div>
            <div><span>AI</span><strong>{notionTimeStats.aiMinutes}</strong></div>
            <div><span>English Output</span><strong>{notionTimeStats.englishOutputMinutes}</strong></div>
            <div><span>Recovery</span><strong>{notionTimeStats.recoveryMinutes}</strong></div>
            <div className="notion-time-preview-main"><span>Main Focus Area</span><strong>{notionTimeStats.mainFocusArea}</strong></div>
          </div>
          <pre className="notion-preview">{markdownForCopy}</pre>
          <div className="flex gap-sm">
            <button className="btn btn-primary" onClick={handleFinishDay} disabled={finishingDay}>
              <BookOpen size={14} />
              {finishingDay ? 'Finishing...' : 'Finish Day & Push to Notion'}
            </button>
            <button className="btn btn-primary" onClick={handlePushNotion} disabled={pushingNotion}>
              <BookOpen size={14} />
              {pushingNotion ? 'Pushing...' : 'Push Daily Log to Notion'}
            </button>
            <button className="btn btn-primary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button className="btn btn-secondary" onClick={onGenerate}>
              <Zap size={14} />
              Re-generate
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => handleNotionSchema(false)} disabled={checkingNotionSchema}>
              <Wrench size={14} />
              {checkingNotionSchema ? 'Checking...' : 'Check Notion schema'}
            </button>
          </div>
          {notionSchemaMessage && (
            <div className="notion-schema-status">
              <strong>{notionSchemaMessage}</strong>
              {notionSchema && (
                <>
                  <span>{notionSchema.existing.length} required properties ready</span>
                  {notionSchema.missing.length > 0 && (
                    <span>Missing: {notionSchema.missing.map(item => item.name).join(', ')}</span>
                  )}
                  {notionSchema.incompatible.length > 0 && (
                    <span>Wrong type: {notionSchema.incompatible.map(item => `${item.name} (${item.actualType})`).join(', ')}</span>
                  )}
                  {notionSchema.missing.length > 0 && notionSchema.canCreateMissing && (
                    <button className="btn btn-secondary" type="button" onClick={() => handleNotionSchema(true)} disabled={checkingNotionSchema}>
                      Create missing properties
                    </button>
                  )}
                  {(notionSchema.missing.length > 0 || notionSchema.incompatible.length > 0) && (
                    <details>
                      <summary>Manual setup instructions</summary>
                      <pre>{NOTION_SCHEMA_MANUAL_INSTRUCTIONS}</pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
          {notionStatus && (
            <div className="notion-status">
              {notionStatus}
              {notionUrl && (
                <>
                  {' '}
                  <a href={notionUrl} target="_blank" rel="noreferrer">
                    Open Notion page
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="plan-section">
        <div className="plan-section-title">Regenerate with feedback</div>
        <div className="notion-export-card">
          <div className="form-group">
            <label>Feedback for Gemini</label>
            <textarea
              placeholder="e.g. Keep the evening lighter, move English before lunch, bills first, only one Pomodoro today."
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              style={{ minHeight: 90 }}
            />
          </div>
          <div className="flex gap-sm">
            <button
              className="btn btn-primary"
              onClick={handleRegenerate}
              disabled={!feedback.trim()}
            >
              <Zap size={14} />
              Regenerate Plan
            </button>
            <button className="btn btn-secondary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy to Notion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
