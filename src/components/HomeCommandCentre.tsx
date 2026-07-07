import { ArrowDown, ArrowUp, Check, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  BlockTaskArea,
  BlockTaskPriority,
  BlockTaskStatus,
  BlockTaskType,
  BlockSubtask,
  DayBlock,
  DayBlockQueue,
  DayMode,
  EnergyLevel,
} from '../types'
import { DAY_MODE_CONFIGS, minimumViableBlock, queueOverview, suggestNextBlock, targetBlocksForMode } from '../blockQueue'
import { queueSessionTitle, startStudySessionFromQueueBlock } from '../blockQueueStudySession'
import { getLocalDateKey } from '../focus'
import { loadDayBlockQueue, saveDayBlockQueue } from '../storage'
import { loadStudySessionRecordsForDate } from '../studyStorage'
import { clearBlockQueueScheduleInTaskStore, writeQuickAddBlockToTaskStore } from '../taskStore'
import StartNowDashboard from './StartNowDashboard'

interface QuickAddTemplate {
  title: string
  estimatedMinutes: number
  type: BlockTaskType
  area: BlockTaskArea
  priority: BlockTaskPriority
  energyLevel: 'high' | 'medium' | 'low'
  project?: string
  notes: string
  subtasks?: string[]
}

const QUICK_ADD_GROUPS: Record<string, QuickAddTemplate[]> = {
  'English Output': [
    {
      title: 'Shadowing full cycle',
      estimatedMinutes: 45,
      type: 'output',
      area: 'english',
      priority: 'must',
      energyLevel: 'high',
      notes: 'Choose a 2-3 minute clip. Listen once. Shadow 3 rounds. Record once. Extract 3 useful expressions.',
      subtasks: [
        'Choose 2-3 min clip',
        'Listen once without pausing',
        'Shadow 3 rounds',
        'Record one attempt',
        'Extract 3 expressions',
        'Write 3-sentence oral summary',
      ],
    },
    {
      title: 'Oral summary practice',
      estimatedMinutes: 25,
      type: 'output',
      area: 'english',
      priority: 'should',
      energyLevel: 'high',
      notes: 'Summarise one podcast/article/video out loud in simple natural English.',
      subtasks: ['Pick source', 'Prepare 5 keywords', 'Speak for 1-2 minutes', 'Note 2 expressions to improve'],
    },
    { title: 'Expression review + reuse', estimatedMinutes: 25, type: 'output', area: 'english', priority: 'should', energyLevel: 'medium', notes: 'Choose 5 saved expressions and make your own sentences.' },
    { title: 'Work English practice', estimatedMinutes: 25, type: 'output', area: 'english', priority: 'should', energyLevel: 'medium', notes: 'Practise Holmesglen/admin/student-service phrases.' },
    { title: 'Interview / LinkedIn English', estimatedMinutes: 30, type: 'output', area: 'english', priority: 'could', energyLevel: 'medium', notes: 'Practise one answer or rewrite one LinkedIn/job sentence.' },
  ],
  'English Input': [
    { title: 'Easy audiobook input', estimatedMinutes: 45, type: 'low_input', area: 'english', priority: 'could', energyLevel: 'low', notes: 'Listen for enjoyment. Save only 1-2 useful expressions if they naturally stand out.' },
    { title: 'Podcast listening', estimatedMinutes: 30, type: 'low_input', area: 'english', priority: 'could', energyLevel: 'low', notes: 'Listen without forcing output. Good for evening.' },
    { title: 'NotebookLM English summary', estimatedMinutes: 30, type: 'low_input', area: 'english', priority: 'should', energyLevel: 'low', notes: 'Ask NotebookLM to summarise material and extract useful phrases.' },
    { title: 'Light English reading', estimatedMinutes: 30, type: 'low_input', area: 'english', priority: 'could', energyLevel: 'low', notes: 'Low-noise reading, no heavy note-taking.' },
  ],
  Japanese: [
    { title: 'Japanese light listening', estimatedMinutes: 30, type: 'low_input', area: 'japanese', priority: 'could', energyLevel: 'low', notes: 'Watch or listen casually. No heavy note-taking. Good for evening or low-energy maintenance.' },
    { title: 'Japanese light reading', estimatedMinutes: 30, type: 'low_input', area: 'japanese', priority: 'could', energyLevel: 'low', notes: 'Read one short article, book section, manga, or subtitles. Save only useful expressions if they naturally stand out.' },
    { title: 'Japanese expression review', estimatedMinutes: 25, type: 'low_input', area: 'japanese', priority: 'could', energyLevel: 'low', notes: 'Review a small set of useful expressions. Do not over-study.' },
    { title: 'Japanese speaking maintenance', estimatedMinutes: 20, type: 'output', area: 'japanese', priority: 'could', energyLevel: 'medium', notes: 'Summarise one small topic or speak casually for 1-2 minutes.' },
    { title: 'Japan work memory / JET notes', estimatedMinutes: 25, type: 'low_input', area: 'japanese', priority: 'could', energyLevel: 'low', notes: 'Organise or reflect on Japan work/JET-related notes, expressions, or memories if useful.' },
  ],
  'AI Coding': [
    { title: 'Codex implementation block', estimatedMinutes: 45, type: 'deep_work', area: 'ai_project', priority: 'should', energyLevel: 'medium', project: 'Daily Plan Hub', notes: 'Give Codex one clear implementation task. Review diff before continuing.' },
    { title: 'Cursor bug fix block', estimatedMinutes: 45, type: 'deep_work', area: 'ai_project', priority: 'should', energyLevel: 'medium', notes: 'Fix one bug or one UI issue only. Do not expand scope.' },
    { title: 'GitHub repo study', estimatedMinutes: 30, type: 'low_input', area: 'ai_project', priority: 'could', energyLevel: 'low', notes: 'Read README and identify one reusable pattern.' },
    { title: 'Prompt vault update', estimatedMinutes: 25, type: 'admin', area: 'ai_project', priority: 'could', energyLevel: 'low', notes: 'Save useful Codex/Cursor/NotebookLM prompts with category and use case.' },
    { title: 'Vibe coding security review', estimatedMinutes: 30, type: 'low_input', area: 'ai_project', priority: 'should', energyLevel: 'medium', notes: 'Check API keys, localStorage, permissions, data privacy, and deployment risk.' },
  ],
  'SQL / Excel': [
    { title: 'SQL practice block', estimatedMinutes: 45, type: 'deep_work', area: 'sql_data', priority: 'should', energyLevel: 'medium', project: 'SQL/Data', notes: 'Practise SELECT, WHERE, GROUP BY, JOIN, or CASE. Do not overextend.' },
    { title: 'Excel / Pivot practice', estimatedMinutes: 45, type: 'deep_work', area: 'sql_data', priority: 'should', energyLevel: 'medium', notes: 'Practise filter, XLOOKUP, SUMIFS, pivot table, or dashboard.' },
    { title: 'DataCamp skill block', estimatedMinutes: 45, type: 'low_input', area: 'sql_data', priority: 'should', energyLevel: 'medium', notes: 'Complete one small lesson only. Stop before fatigue.' },
    { title: 'CSV cleanup project', estimatedMinutes: 45, type: 'admin', area: 'sql_data', priority: 'could', energyLevel: 'medium', notes: 'Clean one CSV for audiobook, Trove, finance, or beauty purchase records.' },
  ],
  'Job / Career': [
    {
      title: 'CV update block',
      estimatedMinutes: 45,
      type: 'output',
      area: 'work_admin',
      priority: 'should',
      energyLevel: 'medium',
      notes: 'Update one section only. Focus on clarity, impact, and tailoring to one job type.',
      subtasks: ['Choose one role direction', 'Update one experience section', 'Add one measurable achievement', 'Save/export updated version'],
    },
    {
      title: 'Cover letter draft',
      estimatedMinutes: 45,
      type: 'output',
      area: 'work_admin',
      priority: 'should',
      energyLevel: 'medium',
      notes: 'Draft or improve one cover letter. Do not perfect the whole thing in one sitting.',
      subtasks: ['Identify job requirements', 'Draft opening paragraph', 'Match 2-3 experiences', 'Add closing paragraph'],
    },
    {
      title: 'LinkedIn profile polish',
      estimatedMinutes: 30,
      type: 'admin',
      area: 'work_admin',
      priority: 'should',
      energyLevel: 'medium',
      notes: 'Improve headline, About, Education, skills, or one experience entry.',
      subtasks: ['Choose one profile section', 'Rewrite it in a clear professional tone', 'Check whether it matches AI workflow / education admin / cyber foundation positioning'],
    },
    {
      title: 'Interview practice',
      estimatedMinutes: 30,
      type: 'output',
      area: 'work_admin',
      priority: 'should',
      energyLevel: 'medium',
      notes: 'Practise one answer out loud. Keep it natural, not memorised.',
      subtasks: ['Pick one question', 'Prepare 3 bullet points', 'Speak once naturally', 'Improve one sentence'],
    },
    {
      title: 'Selection criteria / STAR answer',
      estimatedMinutes: 45,
      type: 'output',
      area: 'work_admin',
      priority: 'should',
      energyLevel: 'medium',
      notes: 'Draft one STAR example only. Do not attempt the whole application.',
      subtasks: ['Pick one criterion', 'Choose one example', 'Draft Situation / Task / Action / Result', 'Add one line about learning or impact'],
    },
    {
      title: 'Job search review',
      estimatedMinutes: 25,
      type: 'admin',
      area: 'work_admin',
      priority: 'could',
      energyLevel: 'low',
      notes: 'Review saved roles, deadlines, and next actions. No doom scrolling.',
      subtasks: ['Check saved jobs', 'Mark top 1-3 roles', 'Decide next action', 'Archive irrelevant roles'],
    },
    {
      title: 'Portfolio / project write-up',
      estimatedMinutes: 45,
      type: 'output',
      area: 'ai_project',
      priority: 'could',
      energyLevel: 'medium',
      notes: 'Turn one project into a short portfolio note: problem, tool, process, result, security/privacy consideration.',
      subtasks: ['Pick one project', 'Write problem statement', 'Write what I built', 'Write what I learned', 'Add security/privacy note'],
    },
    {
      title: 'Career positioning block',
      estimatedMinutes: 30,
      type: 'low_input',
      area: 'work_admin',
      priority: 'could',
      energyLevel: 'low',
      notes: 'Refine my positioning around AI workflow automation, education/admin support, cyber security foundation, and multilingual communication.',
      subtasks: ['Pick one target direction', 'Write one positioning sentence', 'Save useful wording for LinkedIn/CV/interview'],
    },
  ],
  'Admin / Life': [
    { title: 'Bills / finance check', estimatedMinutes: 25, type: 'admin', area: 'life_admin', priority: 'should', energyLevel: 'low', notes: 'Check upcoming bills, rent, insurance, subscriptions, or bank items.' },
    { title: 'File organisation block', estimatedMinutes: 25, type: 'admin', area: 'life_admin', priority: 'could', energyLevel: 'low', project: 'File Organisation', notes: 'Sort one folder only. Do not start a full-system cleanup.' },
    { title: 'Calendar / reminder review', estimatedMinutes: 15, type: 'admin', area: 'life_admin', priority: 'could', energyLevel: 'low', notes: 'Check upcoming deadlines, shifts, bills, and appointments.' },
    { title: 'Life admin catch-up', estimatedMinutes: 25, type: 'admin', area: 'life_admin', priority: 'could', energyLevel: 'low', notes: 'Handle one small life admin item only. Keep the scope boring and clear.' },
    { title: 'Receipts / documents tidy-up', estimatedMinutes: 20, type: 'admin', area: 'life_admin', priority: 'could', energyLevel: 'low', notes: 'Tidy receipts, PDFs, forms, or screenshots into the right place.' },
  ],
  Cyber: [
    { title: 'Cyber assessment writing', estimatedMinutes: 60, type: 'deep_work', area: 'cyber', priority: 'must', energyLevel: 'high', project: 'Cyber assessment', notes: 'One section only. Define the deliverable before starting.' },
    { title: 'Lab evidence + screenshots', estimatedMinutes: 45, type: 'deep_work', area: 'cyber', priority: 'should', energyLevel: 'medium', project: 'Lab evidence', notes: 'Capture evidence, not perfect report writing.' },
    { title: 'NotebookLM cyber review', estimatedMinutes: 45, type: 'low_input', area: 'cyber', priority: 'should', energyLevel: 'low', project: 'NotebookLM workflow', notes: 'Low-input review. Ask NotebookLM to summarise selected sources and extract assessment-relevant points.' },
    { title: 'Teacher question list', estimatedMinutes: 25, type: 'admin', area: 'cyber', priority: 'should', energyLevel: 'low', notes: 'Collect unclear points to ask teacher or classmates.' },
    { title: 'Security concept drill', estimatedMinutes: 25, type: 'low_input', area: 'cyber', priority: 'could', energyLevel: 'medium', notes: 'Optional concept review: OWASP, CIA triad, incident response, access control, or risk.' },
  ],
  'Review / NotebookLM': [
    { title: 'NotebookLM course review', estimatedMinutes: 45, type: 'low_input', area: 'cyber', priority: 'should', energyLevel: 'low', project: 'NotebookLM workflow', notes: 'Use selected session sources. Ask for summary, key terms, assessment relevance, and quiz questions.' },
    { title: 'Daily review', estimatedMinutes: 15, type: 'low_input', area: 'other', priority: 'should', energyLevel: 'low', notes: 'Review what was done, what changed, and what should carry over.' },
    { title: 'Weekly reset review', estimatedMinutes: 45, type: 'low_input', area: 'life_admin', priority: 'could', energyLevel: 'low', notes: 'Review projects, bills, study, work, and personal energy.' },
    { title: 'Prompt / notes cleanup', estimatedMinutes: 25, type: 'admin', area: 'ai_project', priority: 'could', energyLevel: 'low', notes: 'Clean saved prompts and notes. Keep only reusable ones.' },
  ],
  Reset: [
    { title: 'Shower / wash hair reset', estimatedMinutes: 30, type: 'recovery', area: 'health', priority: 'should', energyLevel: 'low', notes: 'Use when stuck, low mood, or before restarting the day.' },
    { title: 'Walk / stretch reset', estimatedMinutes: 20, type: 'recovery', area: 'health', priority: 'could', energyLevel: 'low', notes: 'Light movement only. No performance goal.' },
    { title: '10-min room reset', estimatedMinutes: 10, type: 'recovery', area: 'life_admin', priority: 'could', energyLevel: 'low', notes: 'Clear desk, cup, rubbish, laundry corner, or immediate visual mess.' },
    { title: 'Brown noise + breathe', estimatedMinutes: 5, type: 'recovery', area: 'health', priority: 'could', energyLevel: 'low', notes: 'Use as a transition when mentally noisy.' },
  ],
}

const QUICK_ADD_CATEGORY_ORDER = [
  'English Output',
  'English Input',
  'Japanese',
  'AI Coding',
  'SQL / Excel',
  'Job / Career',
  'Review / NotebookLM',
  'Admin / Life',
  'Cyber',
  'Reset',
] as const

type QuickAddGroup = typeof QUICK_ADD_CATEGORY_ORDER[number]

const DAY_MODE_OPTIONS: Array<{ value: DayMode; label: string }> = [
  { value: 'full-day', label: 'Full Day' },
  { value: 'normal-day', label: 'Normal Day' },
  { value: 'late-start-day', label: 'Late Start' },
  { value: 'rescue-day', label: 'Rescue Day' },
  { value: 'evening-class', label: 'Evening Class' },
  { value: 'saturday-class', label: 'Saturday Class' },
  { value: 'work-shift', label: 'Work Shift' },
  { value: 'admin-catchup', label: 'Admin Catch-Up' },
]

const ENERGY_OPTIONS: Array<{ value: EnergyLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const MAIN_FOCUS_OPTIONS: Array<{ value: BlockTaskArea; label: string }> = [
  { value: 'cyber', label: 'Cyber' },
  { value: 'ai_project', label: 'AI Project' },
  { value: 'english', label: 'English' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'sql_data', label: 'SQL / Excel' },
  { value: 'life_admin', label: 'Admin' },
  { value: 'reading', label: 'Reading' },
  { value: 'health', label: 'Health' },
]

const PRIORITY_FILTERS = ['all', 'must', 'should', 'could'] as const
const STATUS_FILTERS = ['all', 'not_started', 'in_progress', 'done', 'skipped'] as const
const ENERGY_FILTERS = ['all', 'high', 'medium', 'low'] as const
const DUE_FILTERS = ['all', 'today', 'this_week', 'none'] as const
const BLOCK_TYPE_EDIT_OPTIONS: Array<{ value: BlockTaskType; label: string }> = [
  { value: 'deep_work', label: 'Deep Work' },
  { value: 'study', label: 'Study' },
  { value: 'review', label: 'Review' },
  { value: 'admin', label: 'Admin' },
  { value: 'recovery', label: 'Recovery' },
]

type PriorityFilter = typeof PRIORITY_FILTERS[number]
type StatusFilter = typeof STATUS_FILTERS[number]
type EnergyFilter = typeof ENERGY_FILTERS[number]
type AreaFilter = 'all' | BlockTaskArea
type DueFilter = typeof DUE_FILTERS[number]

interface QueueFilters {
  priority: PriorityFilter
  status: StatusFilter
  energy: EnergyFilter
  area: AreaFilter
  due: DueFilter
}

type EditDraft = Pick<DayBlock, 'title' | 'priority' | 'dueDate' | 'estimatedMinutes' | 'notes' | 'energyLevel' | 'type'>

function labelFromToken(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function dayModeLabel(value: string): string {
  return DAY_MODE_CONFIGS[value as DayMode]?.label ?? 'Normal Day'
}

function statusLabel(status: BlockTaskStatus): string {
  if (status === 'not_started') return 'Not started'
  if (status === 'in_progress') return 'In progress'
  return labelFromToken(status)
}

function subtaskProgress(block: DayBlock): string {
  if (block.subtasks.length === 0) return ''
  const done = block.subtasks.filter(subtask => subtask.done).length
  return `${done}/${block.subtasks.length}`
}

function dueBucket(block: DayBlock, today = new Date()): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!block.dueDate) return 'none'
  const due = new Date(`${block.dueDate}T12:00:00`)
  if (Number.isNaN(due.getTime())) return 'none'
  const current = new Date(today)
  current.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = due.getTime() - current.getTime()
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return 'upcoming'
}

function matchesDueFilter(block: DayBlock, due: DueFilter, today = new Date()): boolean {
  if (due === 'all') return true
  if (due === 'none') return !block.dueDate
  if (!block.dueDate) return false
  const dueDate = new Date(`${block.dueDate}T12:00:00`)
  if (Number.isNaN(dueDate.getTime())) return false
  const current = new Date(today)
  current.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dueDate.getTime() - current.getTime()) / 86_400_000)
  if (due === 'today') return diffDays === 0
  return diffDays >= 0 && diffDays <= 6
}

function dueLabel(block: DayBlock): string {
  const bucket = dueBucket(block)
  if (bucket === 'none') return ''
  if (bucket === 'today') return 'Due today'
  if (bucket === 'overdue') return 'Overdue'
  const due = block.dueDate ? new Date(`${block.dueDate}T12:00:00`) : null
  if (!due || Number.isNaN(due.getTime())) return 'Upcoming'
  return `Due ${due.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
}

function filterBlocks(blocks: DayBlock[], filters: QueueFilters): DayBlock[] {
  return blocks.filter(block => {
    if (filters.priority !== 'all' && block.priority !== filters.priority) return false
    if (filters.status !== 'all' && block.status !== filters.status) return false
    if (filters.energy !== 'all' && block.energyLevel !== filters.energy) return false
    if (filters.area !== 'all' && block.area !== filters.area) return false
    if (!matchesDueFilter(block, filters.due)) return false
    return true
  })
}

function hasActiveFilters(filters: QueueFilters): boolean {
  return filters.priority !== 'all'
    || filters.status !== 'all'
    || filters.energy !== 'all'
    || filters.area !== 'all'
    || filters.due !== 'all'
}

function activeFilterCount(filters: QueueFilters): number {
  return [
    filters.priority !== 'all',
    filters.status !== 'all',
    filters.energy !== 'all',
    filters.area !== 'all',
    filters.due !== 'all',
  ].filter(Boolean).length
}

function reorderBlocks(blocks: DayBlock[], index: number, direction: -1 | 1): DayBlock[] {
  const next = [...blocks].sort((a, b) => a.order - b.order)
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  const now = new Date().toISOString()
  return next.map((block, order) => ({ ...block, order, updatedAt: now }))
}

function reasonForBlock(block: DayBlock | null, energy?: EnergyLevel, mainFocus?: BlockTaskArea): string {
  if (!block) return 'Nothing is waiting in the queue right now.'
  if (mainFocus && block.area === mainFocus) return `This matches your main focus: ${labelFromToken(mainFocus)}.`
  if (block.priority === 'must') return 'This is a must-do block, so it should happen before softer options.'
  if (energy === 'low' || block.energyLevel === 'low') return 'This is useful without asking too much energy.'
  if (block.dueDate) return 'This has a due date, so it is better to move it forward now.'
  if (new Date().getHours() >= 17) return 'Evening is better for lighter/admin/review work.'
  return 'This is the next useful block based on priority and queue order.'
}

function templateToBlock(template: QuickAddTemplate, queue: DayBlockQueue): DayBlock {
  const now = new Date().toISOString()
  return {
    id: `quick-block-${queue.date}-${crypto.randomUUID()}`,
    date: queue.date,
    title: template.title,
    description: `Quick add: ${labelFromToken(template.type)}`,
    notes: template.notes,
    type: template.type,
    area: template.area,
    project: template.project,
    priority: template.priority,
    energyLevel: template.energyLevel,
    estimatedMinutes: template.estimatedMinutes,
    status: 'not_started',
    subtasks: (template.subtasks ?? []).map(title => ({
      id: `subtask-${crypto.randomUUID()}`,
      title,
      done: false,
    })),
    tags: ['quick-add', template.area, template.type],
    order: queue.blocks.length,
    createdAt: now,
    updatedAt: now,
  }
}

function isHighOutputTemplate(template: QuickAddTemplate): boolean {
  return template.type === 'deep_work' || template.type === 'output' || template.energyLevel === 'high'
}

function isRescueFriendlyTemplate(template: QuickAddTemplate): boolean {
  return [
    'Teacher question list',
    'NotebookLM course review',
    'File organisation block',
    'Shower / wash hair reset',
    'Brown noise + breathe',
    'Daily review',
    'Job search review',
    'LinkedIn profile polish',
    'Career positioning block',
  ].includes(template.title) || (
    template.estimatedMinutes <= 25 &&
    template.energyLevel === 'low' &&
    template.priority !== 'must'
  )
}

export default function HomeCommandCentre({
  currentEnergy,
  onOpenComeback,
  todayNote,
  eveningNote,
  onOpenStudy,
}: {
  currentEnergy?: EnergyLevel
  onOpenComeback?: () => void
  todayNote?: {
    lines: string[]
    caption: string
  }
  eveningNote?: string
  onOpenStudy?: () => void
}) {
  const [queue, setQueue] = useState<DayBlockQueue>(() => loadDayBlockQueue(getLocalDateKey()))
  const [selectedGroup, setSelectedGroup] = useState<QuickAddGroup>('English Output')
  const [message, setMessage] = useState<string | null>(null)
  const [filters, setFilters] = useState<QueueFilters>({
    priority: 'all',
    status: 'all',
    energy: 'all',
    area: 'all',
    due: 'all',
  })
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({})
  const [editingSubtask, setEditingSubtask] = useState<{ blockId: string; subtaskId: string } | null>(null)
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({})
  const [dismissedCompletionPrompts, setDismissedCompletionPrompts] = useState<Record<string, boolean>>({})

  const sortedBlocks = useMemo(
    () => [...queue.blocks].sort((a, b) => a.order - b.order),
    [queue.blocks],
  )
  const blocks = useMemo(
    () => sortedBlocks.filter(block => !block.hiddenToday),
    [sortedBlocks],
  )
  const dynamicAreaFilters = useMemo<Array<BlockTaskArea>>(
    () => [...new Set(blocks.map(block => block.area))].sort((a, b) => labelFromToken(a).localeCompare(labelFromToken(b))),
    [blocks],
  )
  const queueForDisplay = { ...queue, blocks }
  const visibleBlocks = filterBlocks(blocks, filters)
  const selectedEnergy = queue.currentEnergy ?? currentEnergy ?? 'medium'
  const selectedMainFocus = queue.mainFocus
  const isEveningMode = new Date().getHours() >= 17
  const isRescueMode = queue.mode === 'rescue-day'
  const overview = queueOverview(queueForDisplay)
  const completedStudyMinutes = useMemo(
    () => loadStudySessionRecordsForDate(queue.date)
      .filter(session => session.status === 'completed')
      .reduce((sum, session) => sum + session.actualMinutes, 0),
    [queue.date, message],
  )
  const filterCount = activeFilterCount(filters)
  const nextBlock = suggestNextBlock(queueForDisplay, new Date(), {
    currentEnergy: selectedEnergy,
    mainFocus: selectedMainFocus,
  })
  const reason = reasonForBlock(nextBlock, selectedEnergy, selectedMainFocus)

  function persist(nextQueue: DayBlockQueue, nextMessage?: string) {
    saveDayBlockQueue(nextQueue)
    setQueue(loadDayBlockQueue(nextQueue.date))
    setMessage(nextMessage ?? null)
  }

  function updateBlock(blockId: string, patch: Partial<DayBlock>, nextMessage: string) {
    const now = new Date().toISOString()
    persist({
      ...queue,
      blocks: queue.blocks.map(block => block.id === blockId ? { ...block, ...patch, updatedAt: now } : block),
      updatedAt: now,
    }, nextMessage)
  }

  function patchBlock(blockId: string, recipe: (block: DayBlock) => DayBlock, nextMessage: string) {
    persist({
      ...queue,
      blocks: queue.blocks.map(block => block.id === blockId ? recipe(block) : block),
      updatedAt: new Date().toISOString(),
    }, nextMessage)
  }

  function updateDayMode(mode: DayMode) {
    persist({
      ...queue,
      mode,
      targetBlocks: targetBlocksForMode(mode),
      updatedAt: new Date().toISOString(),
    }, `${dayModeLabel(mode)} selected.`)
  }

  function updateEnergy(currentEnergy: EnergyLevel) {
    persist({
      ...queue,
      currentEnergy,
      updatedAt: new Date().toISOString(),
    }, `Energy set to ${currentEnergy}.`)
  }

  function updateMainFocus(mainFocus: BlockTaskArea) {
    persist({
      ...queue,
      mainFocus,
      updatedAt: new Date().toISOString(),
    }, `Main focus set to ${labelFromToken(mainFocus)}.`)
  }

  function moveBlock(index: number, direction: -1 | 1) {
    persist({
      ...queue,
      blocks: [
        ...reorderBlocks(blocks, index, direction),
        ...sortedBlocks.filter(block => block.hiddenToday),
      ],
      updatedAt: new Date().toISOString(),
    }, 'Queue order updated.')
  }

  function addTemplate(template: QuickAddTemplate) {
    const block = templateToBlock(template, { ...queue, blocks })
    const unifiedTaskId = `quick-add-block:${block.id}`
    const queuedBlock = { ...block, unifiedTaskId }
    persist({
      ...queue,
      blocks: [...blocks, queuedBlock],
      updatedAt: new Date().toISOString(),
    }, `Added "${template.title}" to the queue.`)
    try {
      writeQuickAddBlockToTaskStore(queuedBlock)
    } catch (error) {
      console.warn('Could not mirror quick-add block to taskStore', error)
    }
  }

  function convertBlock(block: DayBlock) {
    updateBlock(block.id, minimumViableBlock(block), 'Made it a 25-minute version.')
  }

  function startQueueBlock(block: DayBlock, durationMinutes: 25 | 50) {
    const result = startStudySessionFromQueueBlock(block, durationMinutes)
    if (!result.success) {
      setMessage(result.message)
      return
    }
    updateBlock(block.id, { status: 'in_progress' }, result.message)
    onOpenStudy?.()
  }

  function hideBlockForToday(block: DayBlock, reason: 'later' | 'removed') {
    const now = new Date().toISOString()
    clearBlockQueueScheduleInTaskStore(block, 'todo')
    persist({
      ...queue,
      blocks: queue.blocks.map(item => item.id === block.id
        ? {
            ...item,
            hiddenToday: true,
            hiddenTodayReason: reason,
            hiddenTodayAt: now,
            updatedAt: now,
          }
        : item,
      ),
      updatedAt: now,
    }, reason === 'later'
      ? 'Moved out of today. It stays in your task store for later.'
      : 'Removed from today. It stays saved, but no longer belongs to today’s queue.')
  }

  function skipBlock(block: DayBlock) {
    updateBlock(block.id, { status: 'skipped', skippedReason: 'Skipped for today.' }, 'Skipped for today. No focus minutes added.')
  }

  function completeWithoutTimer(block: DayBlock) {
    updateBlock(block.id, { status: 'done', completedAt: new Date().toISOString() }, 'Marked done without timer. No focus minutes were added.')
  }

  function beginEdit(block: DayBlock) {
    setEditingBlockId(block.id)
    setExpandedBlockId(block.id)
    setEditDraft({
      title: block.title,
      priority: block.priority,
      dueDate: block.dueDate ?? '',
      estimatedMinutes: block.estimatedMinutes,
      notes: block.notes ?? '',
      energyLevel: block.energyLevel,
      type: block.type,
    })
  }

  function saveEdit(blockId: string) {
    if (!editDraft) return
    updateBlock(blockId, {
      ...editDraft,
      title: editDraft.title.trim() || 'Untitled block',
      estimatedMinutes: Math.max(5, Math.min(180, Number(editDraft.estimatedMinutes) || 25)),
      dueDate: editDraft.dueDate || undefined,
      notes: editDraft.notes?.trim() || undefined,
    }, 'Block updated.')
    setEditingBlockId(null)
    setEditDraft(null)
  }

  function addSubtask(blockId: string) {
    const title = newSubtaskTitles[blockId]?.trim()
    if (!title) return
    const now = new Date().toISOString()
    patchBlock(blockId, block => ({
      ...block,
      subtasks: [
        ...block.subtasks,
        { id: `subtask-${blockId}-${crypto.randomUUID()}`, title, done: false },
      ],
      updatedAt: now,
    }), 'Subtask added.')
    setNewSubtaskTitles(prev => ({ ...prev, [blockId]: '' }))
  }

  function updateSubtask(blockId: string, subtaskId: string, patch: Partial<BlockSubtask>) {
    const now = new Date().toISOString()
    if (patch.done === false) {
      setDismissedCompletionPrompts(prev => ({ ...prev, [blockId]: false }))
    }
    patchBlock(blockId, block => ({
      ...block,
      subtasks: block.subtasks.map(subtask =>
        subtask.id === subtaskId ? { ...subtask, ...patch } : subtask,
      ),
      updatedAt: now,
    }), 'Subtask updated.')
  }

  function beginSubtaskEdit(blockId: string, subtask: BlockSubtask) {
    setEditingSubtask({ blockId, subtaskId: subtask.id })
    setSubtaskDrafts(prev => ({ ...prev, [subtask.id]: subtask.title }))
  }

  function commitSubtaskEdit(blockId: string, subtaskId: string) {
    const title = subtaskDrafts[subtaskId]?.trim()
    if (!title) {
      setEditingSubtask(null)
      return
    }
    updateSubtask(blockId, subtaskId, { title })
    setEditingSubtask(null)
  }

  function deleteSubtask(blockId: string, subtaskId: string) {
    const now = new Date().toISOString()
    patchBlock(blockId, block => ({
      ...block,
      subtasks: block.subtasks.filter(subtask => subtask.id !== subtaskId),
      updatedAt: now,
    }), 'Subtask deleted.')
  }

  function resetFilters() {
    setFilters({ priority: 'all', status: 'all', energy: 'all', area: 'all', due: 'all' })
  }

  return (
    <section className="home-command-centre" aria-label="Today command centre">
      <StartNowDashboard
        onOpenComeback={onOpenComeback}
        todayNote={todayNote}
        eveningNote={eveningNote}
      />

      <details className="start-now-secondary-planning">
        <summary>
          <span>Planning queue / habit blocks</span>
          <small>Open when you want to choose or adjust the queue.</small>
        </summary>

      <div className="home-status-card">
        <div className="home-status-summary">
          <div className="section-label">Today status</div>
          <h3>{dayModeLabel(queue.mode)}</h3>
          <p>Energy: {selectedEnergy}{selectedMainFocus ? ` · Focus: ${labelFromToken(selectedMainFocus)}` : ''}</p>
        </div>
        <div className="home-status-grid">
          <div><strong>{overview.completedBlocks}/{queue.targetBlocks}</strong><span>blocks</span></div>
          <div><strong>{completedStudyMinutes}</strong><span>session min</span></div>
          <div><strong>{overview.mustDone}/{overview.mustTotal}</strong><span>must-do</span></div>
          <div><strong>{overview.remainingBlocks}</strong><span>left</span></div>
        </div>
        <div className="home-status-controls">
          <div className="home-status-control">
            <span>Day Mode</span>
            <div className="home-chip-row">
              {DAY_MODE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={queue.mode === option.value ? 'active' : ''}
                  onClick={() => updateDayMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="home-status-control">
            <span>Energy</span>
            <div className="home-chip-row home-chip-row-compact">
              {ENERGY_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={selectedEnergy === option.value ? 'active' : ''}
                  onClick={() => updateEnergy(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="home-status-control">
            <span>Main Focus</span>
            <div className="home-chip-row">
              {MAIN_FOCUS_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={selectedMainFocus === option.value ? 'active' : ''}
                  onClick={() => updateMainFocus(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="next-best-block-card">
        <div className="next-best-block-copy">
          <div className="section-label">Next best block</div>
          <h2>{nextBlock ? queueSessionTitle(nextBlock, 25) : 'Choose one useful block'}</h2>
          <p>{reason}</p>
          {nextBlock && (
            <div className="next-best-meta">
              <span>{labelFromToken(nextBlock.area)}</span>
              {nextBlock.project && <span>{nextBlock.project}</span>}
              <span>{nextBlock.priority}</span>
              <span>{nextBlock.estimatedMinutes} min</span>
              {nextBlock.estimatedMinutes >= 90 && <span className="home-large-task-label">Large task</span>}
            </div>
          )}
          {nextBlock && nextBlock.estimatedMinutes >= 90 && (
            <p className="next-best-original-title">Original: {nextBlock.title}</p>
          )}
        </div>
        {nextBlock && (
          <div className="next-best-actions">
            <button className="btn btn-primary" type="button" onClick={() => startQueueBlock(nextBlock, 25)}>
              <Play size={14} />
              Start 25-min
            </button>
            <span className="next-best-helper">Creates a Study timer. Minutes count only after you complete the session.</span>
          </div>
        )}
      </div>

      {message && <div className="home-queue-message">{message}</div>}

      <div className="home-block-queue">
        <div className="home-section-heading">
          <div>
            <div className="section-label">Block queue</div>
            <h3>Today’s queue</h3>
            <p className="queue-counting-helper">
              Only completed focus sessions count toward study time. The queue is just today’s menu.
              <span> 统计只计算完成的专注 session。这里是今日候选任务，不是压力清单。</span>
            </p>
          </div>
          <div className="queue-filter-actions">
            <span>{filterCount > 0 ? `${filterCount} active` : 'All blocks'}</span>
            {hasActiveFilters(filters) && (
              <button className="home-reset-filters" type="button" onClick={resetFilters}>
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="queue-filter-bar" aria-label="Block queue filters">
          <div className="queue-filter-group">
            <span>Priority</span>
            <div className="queue-filter-pills">
              {PRIORITY_FILTERS.map(value => (
                <button
                  key={value}
                  type="button"
                  className={filters.priority === value ? 'active' : ''}
                  onClick={() => setFilters(prev => ({ ...prev, priority: value }))}
                >
                  {value === 'all' ? 'All' : labelFromToken(value)}
                </button>
              ))}
            </div>
          </div>
          <div className="queue-filter-group">
            <span>Status</span>
            <div className="queue-filter-pills">
              {STATUS_FILTERS.map(value => (
                <button
                  key={value}
                  type="button"
                  className={filters.status === value ? 'active' : ''}
                  onClick={() => setFilters(prev => ({ ...prev, status: value }))}
                >
                  {value === 'all' ? 'All' : statusLabel(value)}
                </button>
              ))}
            </div>
          </div>
          <div className="queue-filter-group">
            <span>Energy</span>
            <div className="queue-filter-pills">
              {ENERGY_FILTERS.map(value => (
                <button
                  key={value}
                  type="button"
                  className={filters.energy === value ? 'active' : ''}
                  onClick={() => setFilters(prev => ({ ...prev, energy: value }))}
                >
                  {value === 'all' ? 'All' : labelFromToken(value)}
                </button>
              ))}
            </div>
          </div>
          <div className="queue-filter-group">
            <span>Due</span>
            <div className="queue-filter-pills">
              {DUE_FILTERS.map(value => (
                <button
                  key={value}
                  type="button"
                  className={filters.due === value ? 'active' : ''}
                  onClick={() => setFilters(prev => ({ ...prev, due: value }))}
                >
                  {value === 'all' ? 'All' : value === 'none' ? 'No Date' : value === 'this_week' ? 'This Week' : 'Today'}
                </button>
              ))}
            </div>
          </div>
          <label className="queue-filter-group queue-area-filter">
            <span>Area</span>
            <select value={filters.area} onChange={event => setFilters(prev => ({ ...prev, area: event.target.value as AreaFilter }))}>
              <option value="all">All</option>
              {dynamicAreaFilters.map(value => (
                <option key={value} value={value}>{labelFromToken(value)}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="home-block-list">
          {blocks.length === 0 ? (
            <div className="home-block-empty">No blocks yet. Add one below.</div>
          ) : visibleBlocks.length === 0 ? (
            <div className="home-block-empty">No blocks match these filters. Try clearing a filter.</div>
          ) : visibleBlocks.map(block => {
            const index = blocks.findIndex(item => item.id === block.id)
            const isExpanded = expandedBlockId === block.id
            const isEditing = editingBlockId === block.id && editDraft
            const allSubtasksDone = block.subtasks.length > 0 && block.subtasks.every(subtask => subtask.done)
            const showCompletionPrompt = allSubtasksDone && block.status !== 'done' && !dismissedCompletionPrompts[block.id]
            return (
            <article key={block.id} className={`home-block-card home-block-card-${block.status}`}>
              <div className="home-block-main">
                <h4>{block.estimatedMinutes >= 90 ? queueSessionTitle(block, 25) : block.title}</h4>
                <div className="home-block-meta">
                  <span className={`home-priority home-priority-${block.priority}`}>{block.priority}</span>
                  <span>{labelFromToken(block.area)}</span>
                  {block.project && <span>{block.project}</span>}
                  <span>{block.estimatedMinutes}m</span>
                  {block.estimatedMinutes >= 90 && <span className="home-large-task-label">Large task</span>}
                  <span>{statusLabel(block.status)}</span>
                  {dueBucket(block) !== 'none' && (
                    <span className={`home-due-label home-due-${dueBucket(block)}`}>{dueLabel(block)}</span>
                  )}
                  {subtaskProgress(block) && <span>{subtaskProgress(block)} subtasks</span>}
                </div>
                {block.estimatedMinutes >= 90 && (
                  <p className="home-block-note">Original task: {block.title}. Start with one 25-minute pass; the whole task does not need to be finished today.</p>
                )}
                {block.notes && <p className="home-block-note">{block.notes}</p>}
              </div>
              <div className="home-block-actions">
                <button type="button" className="home-block-primary-action" onClick={() => startQueueBlock(block, 25)}><Play size={13} />Start 25-min</button>
                <button type="button" onClick={() => startQueueBlock(block, 50)}>Start 50-min</button>
                <button type="button" onClick={() => completeWithoutTimer(block)}><Check size={13} />Done without timer</button>
                <button type="button" onClick={() => hideBlockForToday(block, 'later')}>Later</button>
                <button type="button" onClick={() => skipBlock(block)}>Skip</button>
                <button type="button" className="home-icon-action" onClick={() => beginEdit(block)} aria-label={`Edit ${block.title}`}><Pencil size={13} /></button>
                <button type="button" className="home-more-action" onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}>
                  {isExpanded ? 'Less' : 'More'}
                </button>
              </div>
              {isExpanded && (
                <div className="home-block-details">
                  <div className="home-tertiary-actions" aria-label={`More actions for ${block.title}`}>
                    <button type="button" onClick={() => convertBlock(block)}>Convert to 25-min version</button>
                    <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label={`Move ${block.title} up`}><ArrowUp size={13} /></button>
                    <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label={`Move ${block.title} down`}><ArrowDown size={13} /></button>
                    <button type="button" onClick={() => hideBlockForToday(block, 'removed')}>Remove from today</button>
                  </div>
                  {isEditing ? (
                    <div className="compact-edit-grid">
                      <label>Title<input value={editDraft.title} onChange={event => setEditDraft({ ...editDraft, title: event.target.value })} /></label>
                      <label>Priority<select value={editDraft.priority} onChange={event => setEditDraft({ ...editDraft, priority: event.target.value as DayBlock['priority'] })}>
                        <option value="must">Must</option>
                        <option value="should">Should</option>
                        <option value="could">Could</option>
                      </select></label>
                      <label>Due date<input type="date" value={editDraft.dueDate ?? ''} onChange={event => setEditDraft({ ...editDraft, dueDate: event.target.value })} /></label>
                      <label>Estimate<input type="number" min="5" max="180" step="5" value={editDraft.estimatedMinutes} onChange={event => setEditDraft({ ...editDraft, estimatedMinutes: Number(event.target.value) })} /></label>
                      <label>Type<select value={editDraft.type} onChange={event => setEditDraft({ ...editDraft, type: event.target.value as DayBlock['type'] })}>
                        {!BLOCK_TYPE_EDIT_OPTIONS.some(option => option.value === editDraft.type) && (
                          <option value={editDraft.type}>Current: {labelFromToken(editDraft.type)}</option>
                        )}
                        {BLOCK_TYPE_EDIT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select></label>
                      <label>Energy<select value={editDraft.energyLevel} onChange={event => setEditDraft({ ...editDraft, energyLevel: event.target.value as DayBlock['energyLevel'] })}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select></label>
                      <label className="compact-edit-wide">Notes<textarea value={editDraft.notes ?? ''} onChange={event => setEditDraft({ ...editDraft, notes: event.target.value })} /></label>
                      <div className="compact-edit-actions">
                        <button type="button" className="btn btn-primary" onClick={() => saveEdit(block.id)}>Save</button>
                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingBlockId(null); setEditDraft(null) }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="home-subtask-panel">
                      <div className="home-subtask-header">
                        <span>Subtasks</span>
                        <span>{block.subtasks.filter(subtask => subtask.done).length} / {block.subtasks.length} done</span>
                      </div>
                      <div className="home-subtask-list">
                        {block.subtasks.length === 0 ? (
                          <p>No subtasks yet.</p>
                        ) : block.subtasks.map(subtask => {
                          const isSubtaskEditing = editingSubtask?.blockId === block.id && editingSubtask.subtaskId === subtask.id
                          return (
                            <div key={subtask.id} className="home-subtask-row">
                              <input type="checkbox" checked={subtask.done} onChange={event => updateSubtask(block.id, subtask.id, { done: event.target.checked })} />
                              {isSubtaskEditing ? (
                                <input
                                  value={subtaskDrafts[subtask.id] ?? subtask.title}
                                  onChange={event => setSubtaskDrafts(prev => ({ ...prev, [subtask.id]: event.target.value }))}
                                  onBlur={() => commitSubtaskEdit(block.id, subtask.id)}
                                  onKeyDown={event => {
                                    if (event.key === 'Enter') commitSubtaskEdit(block.id, subtask.id)
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  className={`home-subtask-label ${subtask.done ? 'done' : ''}`}
                                  onClick={() => beginSubtaskEdit(block.id, subtask)}
                                >
                                  {subtask.title}
                                </button>
                              )}
                              <button type="button" onClick={() => deleteSubtask(block.id, subtask.id)} aria-label={`Delete ${subtask.title}`}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      {showCompletionPrompt && (
                        <div className="home-subtask-complete-hint">
                          <span>All subtasks done — mark this block complete?</span>
                          <div>
                            <button type="button" onClick={() => completeWithoutTimer(block)}>
                              Yes, complete it
                            </button>
                            <button type="button" onClick={() => setDismissedCompletionPrompts(prev => ({ ...prev, [block.id]: true }))}>
                              Not yet
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="home-subtask-add">
                        <input
                          value={newSubtaskTitles[block.id] ?? ''}
                          onChange={event => setNewSubtaskTitles(prev => ({ ...prev, [block.id]: event.target.value }))}
                          onKeyDown={event => {
                            if (event.key === 'Enter') addSubtask(block.id)
                          }}
                          placeholder="Add a subtask"
                        />
                        <button type="button" onClick={() => addSubtask(block.id)}><Plus size={13} />Add</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
            )
          })}
        </div>
      </div>

      <div className="habit-quick-add">
        <div className="home-section-heading">
          <div>
            <div className="section-label">Quick add</div>
            <h3>Habit blocks</h3>
          </div>
        </div>
        {isEveningMode && (
          <div className="habit-mode-note">
            Evening mode: low-noise input works better now.
          </div>
        )}
        <div className="habit-tabs">
          {QUICK_ADD_CATEGORY_ORDER.map(group => (
            <button
              key={group}
              type="button"
              className={selectedGroup === group ? 'active' : ''}
              onClick={() => setSelectedGroup(group)}
            >
              {group}
            </button>
          ))}
        </div>
        <div className="habit-template-grid">
          {QUICK_ADD_GROUPS[selectedGroup].map(template => (
            <button
              key={template.title}
              type="button"
              className={`${isEveningMode && isHighOutputTemplate(template) ? 'daytime-recommended' : ''} ${isRescueMode && isRescueFriendlyTemplate(template) ? 'rescue-friendly' : ''}`}
              onClick={() => addTemplate(template)}
              title={template.notes}
            >
              <strong>{template.title}</strong>
              <span>{template.estimatedMinutes} min · {labelFromToken(template.type)} · {template.energyLevel}</span>
              <em>{template.notes}</em>
              {isEveningMode && isHighOutputTemplate(template) && <small>daytime recommended</small>}
              {isRescueMode && isRescueFriendlyTemplate(template) && <small>rescue-friendly</small>}
            </button>
          ))}
        </div>
      </div>
      </details>
    </section>
  )
}
