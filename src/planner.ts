import type {
  DailyCheckin,
  Task,
  WorkOpportunity,
  Bill,
  CalendarEvent,
  GeneratedPlan,
  TimeBlock,
} from './types'
import { isActiveTask } from './focusBlocks'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const PROTECTED_EVENT_TERMS = [
  'class',
  'holmesglen',
  'lecture',
  'tutorial',
  'work',
  'shift',
  'appointment',
]
type BlockType = NonNullable<TimeBlock['type']>

type BaseBlockId =
  | 'breakfast-input'
  | 'shadowing'
  | 'course-learning'
  | 'lunch-reset'
  | 'project-coding'
  | 'break-reset'
  | 'technical-retelling'
  | 'chunk-bank'
  | 'dinner-reset'
  | 'quiet-reading'
  | 'notes-organisation'
  | 'tomorrow-planning'

interface TimeWindow {
  start: number
  end: number
}

interface ScheduledCommitment extends TimeWindow {
  title: string
  type: BlockType
  items: string[]
}

export function getDaysUntil(dateStr: string, referenceDate = new Date()): number {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / MS_PER_DAY)
}

export function taskScoring(task: Task, referenceDate = new Date(), planningInstructions = ''): number {
  let score = 0
  const instructions = planningInstructions.toLowerCase()

  const categoryBase: Record<string, number> = {
    assessment: 10,
    'work-shift': 9,
    'cyber-study': 6,
    'job-search': 5,
    'finance-bills': 4,
    'admin-life': 3,
    'consulting-freelance': 3,
    'english-practice': 2,
    recovery: 1,
  }
  score += categoryBase[task.category] ?? 0

  if (task.urgency === 'high') score += 8
  else if (task.urgency === 'medium') score += 4

  if (task.importance === 'high') score += 6
  else if (task.importance === 'medium') score += 3

  if (task.deadline) {
    const days = getDaysUntil(task.deadline, referenceDate)
    if (days <= 0) score += 20
    else if (days <= 1) score += 15
    else if (days <= 3) score += 10
    else if (days <= 7) score += 5
  }

  if (task.difficulty === 'hard') score -= 1
  if (instructions.includes('cyber') && (task.category === 'cyber-study' || task.category === 'assessment')) score += 10
  if (instructions.includes('english') && task.category === 'english-practice') score += 8
  if (instructions.includes('job') && task.category === 'job-search') score += 6
  if (instructions.includes('bills') && task.category === 'finance-bills') score += 8

  return score
}

export function formatTaskLine(task: Task): string {
  if (task.pomodoroEnabled) {
    const focusMin = task.pomodoroLength ?? 50
    const breakMin = task.breakLength ?? 10
    const sessions = task.pomodoroSessions ?? 1
    const sessionsLabel = sessions > 1 ? ` x ${sessions}` : ''
    return task.nextAction
      ? `${task.title} - ${focusMin}min focus${sessionsLabel} + ${breakMin}min break -> ${task.nextAction}`
      : `${task.title} - ${focusMin}min focus${sessionsLabel} + ${breakMin}min break`
  }
  return task.nextAction ? `${task.title} -> ${task.nextAction}` : task.title
}

export function isProtectedCalendarEvent(event: CalendarEvent): boolean {
  const title = event.title.toLowerCase()
  return PROTECTED_EVENT_TERMS.some(term => title.includes(term))
}

function parseTimeToMinutes(value?: string, fallback = 8 * 60 + 30): number {
  if (!value) return fallback
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return fallback
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return hours * 60 + minutes
}

function toTimeString(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, minutes))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function minutesFromDate(value: string): number {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function periodForTime(start: number): TimeBlock['period'] {
  if (start < 12 * 60) return 'morning'
  if (start < 17 * 60) return 'afternoon'
  if (start < 21 * 60) return 'evening'
  return 'shutdown'
}

function blockFromWindow(
  start: number,
  end: number,
  title: string,
  type: BlockType,
  items: string[],
  metadata: Partial<Pick<TimeBlock, 'baseBlockId' | 'baseBlockName' | 'outputLevel' | 'recommendedWindow' | 'canBeMoved'>> = {},
): TimeBlock {
  return {
    period: type === 'recovery' ? 'recovery' : type === 'shutdown' ? 'shutdown' : periodForTime(start),
    label: `${toTimeString(start)}-${toTimeString(end)} ${title}`,
    startTime: toTimeString(start),
    endTime: toTimeString(end),
    title,
    type,
    items,
    ...metadata,
  }
}

function shouldUseGrowthDay(checkin: DailyCheckin): boolean {
  const base = checkin.dailyPlanBase ?? 'english-ai-cyber-growth'
  return base === 'english-ai-cyber-growth' && checkin.dayType === 'normal'
}

function growthBlockPlacement(task: Task): BaseBlockId {
  const area = task.area ?? ''
  const text = `${task.title} ${task.category} ${area}`.toLowerCase()
  if (area === 'Life reset' || task.category === 'recovery') return 'break-reset'
  if (area === 'Expression Review' || text.includes('expression')) return 'chunk-bank'
  if (area === 'English' || text.includes('english') || text.includes('speaking') || text.includes('writing')) {
    return text.includes('review') ? 'chunk-bank' : 'technical-retelling'
  }
  if (area === 'Vibe Coding' || text.includes('coding') || text.includes('project') || text.includes('app')) {
    return 'project-coding'
  }
  if (area === 'Cyber' || area === 'AI' || area === 'Study' || text.includes('cyber') || text.includes('course')) {
    return text.includes('lab') || text.includes('assessment') ? 'project-coding' : 'course-learning'
  }
  if (area === 'Admin' || task.category === 'admin-life' || task.category === 'finance-bills') return 'notes-organisation'
  if (area === 'Job' || task.category === 'job-search') return 'project-coding'
  return 'project-coding'
}

function tinyActionForGrowthBlock(id: BaseBlockId): string {
  switch (id) {
    case 'shadowing':
      return 'Prepare shadowing material. Open one 2-3 minute clip.'
    case 'course-learning':
      return 'Open the course page and preview the title plus 5 key terms.'
    case 'project-coding':
      return 'Start project block. Write one English task goal before coding.'
    case 'technical-retelling':
      return 'Answer out loud: What did I learn and why does it matter?'
    case 'chunk-bank':
      return 'Collect 5 useful chunks from today’s material.'
    case 'quiet-reading':
      return 'Open quiet reading material. Mark new concepts and useful phrases only.'
    case 'notes-organisation':
      return 'Write 3 things I learned and 1 thing I still don’t understand.'
    case 'tomorrow-planning':
      return 'Choose tomorrow’s main technical topic and one project task.'
    case 'breakfast-input':
      return 'Breakfast + light English input. No heavy output yet.'
    case 'lunch-reset':
      return 'Lunch + audiobook or podcast. No Pomodoro, no guilt.'
    case 'dinner-reset':
      return 'Dinner + rest. No output or shadowing.'
    case 'break-reset':
      return 'Break, walk, or reset. Clear your head.'
  }
}

function taskLineForGrowthBlock(task: Task, placement: BaseBlockId): string {
  const label = placement === 'notes-organisation' || placement === 'quiet-reading'
    ? 'Quiet placement'
    : 'Suggested placement'
  return `${label}: ${formatTaskLine(task)}`
}

function createGrowthDayScaffold(
  tasks: Task[],
  commitments: ScheduledCommitment[],
  calendarEvents: CalendarEvent[],
): TimeBlock[] {
  const taskPlacements = new Map<BaseBlockId, string[]>()
  tasks.forEach(task => {
    const placement = growthBlockPlacement(task)
    taskPlacements.set(placement, [
      ...(taskPlacements.get(placement) ?? []),
      taskLineForGrowthBlock(task, placement),
    ])
  })

  const block = (
    id: BaseBlockId,
    start: number,
    end: number,
    title: string,
    type: BlockType,
    outputLevel: 'high' | 'low',
    recommendedWindow: 'daytime' | 'evening' | 'any',
    items: string[],
  ) =>
    blockFromWindow(start, end, title, type, [
      tinyActionForGrowthBlock(id),
      ...items,
      ...(taskPlacements.get(id) ?? []),
    ], {
      baseBlockId: id,
      baseBlockName: title,
      outputLevel,
      recommendedWindow,
      canBeMoved: true,
    })

  const scaffold = [
    block('breakfast-input', 9 * 60, 9 * 60 + 30, 'Breakfast + light English input', 'meal', 'low', 'any', [
      'Podcast, audiobook, or light English only',
      'Warm up without pressure',
    ]),
    block('shadowing', 9 * 60 + 30, 10 * 60 + 30, 'Shadowing', 'focus', 'high', 'daytime', [
      '0-10 listen once without pausing',
      '10-25 sentence-by-sentence shadowing',
      '25-40 delayed shadowing without looking',
      '40-50 record oral summary',
      '50-60 replay and note 3 issues',
      'Materials: WorkLife, ABC Conversations, The Assembly, Gruen, AWS/Cisco/Google Cloud video',
    ]),
    block('course-learning', 10 * 60 + 30, 12 * 60, 'AI / IT / Cyber English course', 'focus', 'high', 'daytime', [
      'Preview title and key terms',
      'Watch with English subtitles',
      'Write 5 English summary sentences',
      'Cornell note: Topic / Key idea / Technical terms / Example / Why it matters / One sentence summary',
    ]),
    block('lunch-reset', 12 * 60, 13 * 60, 'Lunch + audiobook / podcast', 'meal', 'low', 'any', [
      'Protected meal block',
      'No Pomodoro, no deep work, no guilt',
    ]),
    block('project-coding', 13 * 60, 15 * 60, 'Project / Coding / Practical work', 'focus', 'high', 'daytime', [
      'Suitable: Daily Plan Hub, Expression Review Hub, AI Job Helper, MM Audiobook Finder, Book Finder, automations, Cyber lab',
      '13:00-13:10 write English task goal',
      '13:10-14:20 implementation',
      '14:20-14:40 debug or ask AI in English',
      '14:40-15:00 English progress log',
    ]),
    block('break-reset', 15 * 60, 15 * 60 + 30, 'Break / walk / reset', 'recovery', 'low', 'any', [
      'Walk, water, stretch, or quiet reset',
    ]),
    block('technical-retelling', 15 * 60 + 30, 16 * 60 + 30, 'Technical retelling + English writing', 'focus', 'high', 'daytime', [
      '30 min oral retelling: what I learned, why it matters, beginner explanation, own project use',
      '30 min writing: 300-500 words',
    ]),
    block('chunk-bank', 16 * 60 + 30, 17 * 60, 'Chunk Bank', 'focus', 'high', 'daytime', [
      'Technical: This reduces the risk of... / This allows the system to...',
      'Workplace: I just wanted to clarify... / My understanding is that...',
      'Academic: In practical terms... / The key point here is...',
    ]),
    block('dinner-reset', 17 * 60, 18 * 60, 'Dinner + rest', 'meal', 'low', 'evening', [
      'Protected dinner block',
      'No output, no shadowing, no interview practice',
    ]),
    block('quiet-reading', 18 * 60, 19 * 60, 'Quiet English reading / documentation', 'admin', 'low', 'evening', [
      'AWS docs, OpenAI docs, Cisco notes, cybersecurity blog, or course transcript',
      'Labels: New concept / Useful phrase / I already know this / I need to review this',
    ]),
    block('notes-organisation', 19 * 60, 19 * 60 + 40, 'Course notes organisation', 'admin', 'low', 'evening', [
      'Today’s technical topic',
      '3 things I learned',
      '5 useful expressions',
      '1 thing I still don’t understand',
      'Tomorrow’s next step',
    ]),
    block('tomorrow-planning', 19 * 60 + 40, 20 * 60, 'Tomorrow plan + light review', 'shutdown', 'low', 'evening', [
      'Tomorrow’s main technical topic',
      'Tomorrow’s project task',
      'Tomorrow’s shadowing material',
      'One expression I want to use',
    ]),
  ]

  const commitmentBlocks = commitments.map(commitment =>
    blockFromWindow(commitment.start, commitment.end, commitment.title, commitment.type, commitment.items, {
      outputLevel: commitment.type === 'class' || commitment.type === 'work' ? 'high' : 'low',
      recommendedWindow: 'any',
      canBeMoved: false,
    }),
  )
  const busy = commitments
  const visibleScaffold = scaffold.filter(item => {
    if (!item.startTime || !item.endTime) return true
    const start = parseTimeToMinutes(item.startTime)
    const end = parseTimeToMinutes(item.endTime)
    return !overlapsCommitment(start, end, busy)
  })
  const calendarNotes = calendarEvents.length > 0
    ? [blockFromWindow(8 * 60 + 50, 9 * 60, 'Calendar check', 'admin', [
        'Review today’s synced commitments before starting the scaffold',
      ], {
        outputLevel: 'low',
        recommendedWindow: 'any',
        canBeMoved: true,
      })]
    : []
  return [...calendarNotes, ...visibleScaffold, ...commitmentBlocks]
    .sort((a, b) => parseTimeToMinutes(a.startTime, 0) - parseTimeToMinutes(b.startTime, 0))
}

function inferBlockType(title: string): BlockType {
  const lower = title.toLowerCase()
  if (lower.includes('class') || lower.includes('holmesglen') || lower.includes('lecture') || lower.includes('tutorial')) return 'class'
  if (lower.includes('work') || lower.includes('shift')) return 'work'
  if (lower.includes('appointment')) return 'admin'
  if (lower.includes('dinner') || lower.includes('breakfast') || lower.includes('lunch')) return 'meal'
  return 'admin'
}

function calendarCommitments(calendarEvents: CalendarEvent[]): ScheduledCommitment[] {
  return calendarEvents.map(event => {
    const start = minutesFromDate(event.start)
    const end = minutesFromDate(event.end)
    const location = event.location ? `Location: ${event.location}` : 'Fixed commitment from Google Calendar'
    return {
      start,
      end,
      title: event.title,
      type: inferBlockType(event.title),
      items: [location],
    }
  })
}

function manualCommitments(checkin: DailyCheckin): ScheduledCommitment[] {
  const manualOnly = checkin.fixedCommitments.split('Imported Google Calendar:')[0]
  return manualOnly
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*(.*)/)
      if (!match) return null
      const [, startHour, startMinute, endHour, endMinute, title] = match
      const start = Number(startHour) * 60 + Number(startMinute)
      const end = Number(endHour) * 60 + Number(endMinute)
      return {
        start,
        end,
        title: title.trim() || 'Fixed commitment',
        type: inferBlockType(title),
        items: ['Manual fixed commitment'],
      }
    })
    .filter((item): item is ScheduledCommitment => item !== null)
}

function defaultClassCommitments(checkin: DailyCheckin): ScheduledCommitment[] {
  if (checkin.dayType === 'saturday-class') {
    return [{
      start: 9 * 60,
      end: 17 * 60 + 30,
      title: 'Holmesglen online class',
      type: 'class',
      items: ['Protected class time', 'Do not schedule other focus work here'],
    }]
  }
  if (checkin.dayType === 'evening-class') {
    return [{
      start: 17 * 60 + 30,
      end: 21 * 60,
      title: 'Holmesglen evening class',
      type: 'class',
      items: ['Protected class time', 'Eat before class and keep a buffer'],
    }]
  }
  return []
}

function mergeCommitments(commitments: ScheduledCommitment[]): ScheduledCommitment[] {
  return [...commitments]
    .filter(item => item.end > item.start)
    .sort((a, b) => a.start - b.start)
}

function overlapsCommitment(start: number, end: number, commitments: TimeWindow[]): boolean {
  return commitments.some(item => start < item.end && end > item.start)
}

function findNextSlot(
  cursor: number,
  duration: number,
  dayEnd: number,
  commitments: TimeWindow[],
): number | null {
  let start = cursor
  while (start + duration <= dayEnd) {
    const conflict = commitments.find(item => start < item.end && start + duration > item.start)
    if (!conflict) return start
    start = conflict.end + 10
  }
  return null
}

function findMealSlot(
  preferredStart: number,
  duration: number,
  earliest: number,
  latestEnd: number,
  busy: TimeWindow[],
): TimeWindow {
  const candidates: number[] = [preferredStart]
  for (let offset = 30; offset <= 180; offset += 30) {
    candidates.push(preferredStart - offset, preferredStart + offset)
  }
  const slot = candidates.find(start =>
    start >= earliest &&
    start + duration <= latestEnd &&
    !busy.some(item => start < item.end + 10 && start + duration > item.start - 10),
  )
  const start = slot ?? Math.max(earliest, Math.min(preferredStart, latestEnd - duration))
  return { start, end: start + duration }
}

function focusTitle(task: Task): string {
  if (task.id.startsWith('morning-main')) return 'Main priority focus block'
  if (task.id.startsWith('morning-secondary')) return 'Secondary priority focus block'
  if (task.area) return `${task.area}: ${task.title}`
  if (task.category === 'cyber-study' || task.category === 'assessment') return `Focus: ${task.title}`
  if (task.category === 'english-practice') return 'English Output Pomodoro'
  if (task.category === 'job-search') return 'Job search Pomodoro'
  if (task.category === 'consulting-freelance') return 'AI learning / consulting focus'
  return `${task.title} Pomodoro`
}

function morningPriorityTasks(checkin: DailyCheckin): {
  focusTasks: Task[]
  smallLifeTask: Task | null
} {
  const rankedTasks = (checkin.rankedTasks ?? [])
    .filter(task => task.title.trim())
    .filter(task => !/vu23222|cybersecurity vu23222|current assessment requirement/i.test(task.title))
    .sort((a, b) => a.orderIndex - b.orderIndex)
  if (rankedTasks.length > 0) {
    const now = new Date().toISOString()
    return {
      focusTasks: rankedTasks.map(task => ({
        id: task.taskId ?? `ranked-${task.orderIndex + 1}-${checkin.date}`,
        title: task.title,
        area: task.area,
        category:
          task.area === 'Cyber'
            ? 'cyber-study'
            : task.area === 'AI' || task.area === 'Vibe Coding'
              ? 'ai'
            : task.area === 'Job'
              ? 'job-search'
              : task.area === 'English' || task.area === 'Expression Review'
                ? 'english-practice'
                : task.area === 'Life reset'
                  ? 'recovery'
                  : task.area === 'Study'
                    ? 'assessment'
                  : 'admin-life',
        estimatedMinutes: task.estimatedMinutes,
        difficulty: task.estimatedMinutes >= 45 ? 'hard' : task.estimatedMinutes >= 25 ? 'medium' : 'easy',
        urgency: task.orderIndex === 0 ? 'high' : 'medium',
        importance: task.orderIndex === 0 ? 'high' : 'medium',
        minimumVersion: `${task.title} - ${Math.min(task.estimatedMinutes, 25)} minute version`,
        nextAction: `Start ${task.title}`,
        pomodoroEnabled: task.area !== 'Life reset',
        pomodoroLength: task.estimatedMinutes,
        breakLength: task.estimatedMinutes >= 45 ? 10 : 5,
        pomodoroSessions: 1,
        done: false,
        createdAt: now,
      })),
      smallLifeTask: null,
    }
  }

  return {
    focusTasks: [],
    smallLifeTask: null,
  }
}

function generateTheme(checkin: DailyCheckin, top3Tasks: Task[]): string {
  const { dayType, energyLevel } = checkin

  if (shouldUseGrowthDay(checkin)) {
    return 'English + AI/Cyber Growth Day - daytime output, evening quiet input'
  }

  if (dayType === 'saturday-class')
    return 'Holmesglen Saturday - class is the main event today'
  if (dayType === 'evening-class') {
    if (energyLevel === 'low') return 'Class night - conserve energy for the evening'
    return 'Class night - morning sprint, evening learning at Holmesglen'
  }
  if (dayType === 'work-shift') return 'Work shift day - plan around your Holmesglen hours'
  if (dayType === 'low-energy') return 'Gentle progress day - small wins matter, rest counts'
  if (dayType === 'admin-catchup') return 'Admin day - clear the backlog, create space'

  const hasJobSearch = top3Tasks.some(t => t.category === 'job-search')

  if (energyLevel === 'high') {
    return 'High-energy day - make serious progress'
  }
  if (energyLevel === 'medium') {
    if (hasJobSearch) return 'Steady day - study + job search balance'
    return 'Steady day - consistent action, no heroics'
  }
  return 'Pace yourself today - protect your energy'
}

export function timeBlockGeneration(
  checkin: DailyCheckin,
  top3Tasks: Task[],
  _optionalTasks: Task[],
  includeRecoveryBlock = true,
  calendarEvents: CalendarEvent[] = [],
  urgentBills: string[] = [],
): TimeBlock[] {
  const { dayType, energyLevel } = checkin
  const instructions = checkin.planningInstructions.toLowerCase()
  const wake = parseTimeToMinutes(checkin.wakeUpTime, 8 * 60 + 30)
  const sleep = parseTimeToMinutes(checkin.sleepTarget, 23 * 60)
  const shutdownStart = Math.min(parseTimeToMinutes(checkin.sleepTarget, 22 * 60) - 60, 21 * 60 + 30)
  const dayEnd = Math.max(shutdownStart, wake + 4 * 60)
  const importedCommitments = calendarCommitments(calendarEvents)
  const hasClassCommitment = importedCommitments.some(item => item.type === 'class')
  const commitments = mergeCommitments([
    ...importedCommitments,
    ...manualCommitments(checkin),
    ...(hasClassCommitment ? [] : defaultClassCommitments(checkin)),
  ])
  if (shouldUseGrowthDay(checkin)) {
    return createGrowthDayScaffold(
      [...top3Tasks, ..._optionalTasks],
      commitments,
      calendarEvents,
    )
  }
  const blocks: TimeBlock[] = []

  const morningEnd = Math.min(wake + 30, dayEnd)
  blocks.push(blockFromWindow(wake, morningEnd, 'Wake up + breakfast', 'meal', [
    'Breakfast, water, medication if needed',
    'Check calendar before starting focus work',
  ]))

  commitments.forEach(commitment => {
    blocks.push(blockFromWindow(commitment.start, commitment.end, commitment.title, commitment.type, commitment.items))
  })

  const lunch = findMealSlot(12 * 60, 45, wake + 60, shutdownStart, commitments)
  const dinner = findMealSlot(17 * 60, 60, wake + 4 * 60, shutdownStart, [...commitments, lunch])
  const mealWindows: TimeWindow[] = [lunch, dinner]
  blocks.push(blockFromWindow(lunch.start, lunch.end, 'Lunch + reset', 'meal', [
    'Protected meal block - not optional',
    'No Pomodoro or deep work over lunch',
  ]))
  blocks.push(blockFromWindow(dinner.start, dinner.end, 'Dinner + reset', 'meal', [
    dayType === 'saturday-class'
      ? 'Keep this easy after class'
      : 'Protected meal block - not optional',
    'No Pomodoro or deep work over dinner',
  ]))

  const focusTasks = [...top3Tasks]
    .filter(task => task.category !== 'recovery')
    .sort((a, b) => {
      if (instructions.includes('english') && a.category === 'english-practice') return -1
      if (instructions.includes('english') && b.category === 'english-practice') return 1
      return 0
    })
  const baseFocusLimit =
    dayType === 'saturday-class'
      ? 1
      : energyLevel === 'low'
        ? 1
        : energyLevel === 'medium'
          ? 2
          : 3
  const focusLimit = instructions.includes('only one pomodoro') || instructions.includes('one pomodoro')
    ? 1
    : instructions.includes('keep today light')
      ? Math.min(baseFocusLimit, 1)
      : baseFocusLimit
  const focusEnd = instructions.includes('no deep work after 7') || instructions.includes('no deep work after 19')
    ? Math.min(dayEnd, 19 * 60)
    : dayEnd
  const scheduledFocus: TimeWindow[] = []
  let cursor = morningEnd + 10

  focusTasks.slice(0, focusLimit).forEach(task => {
    const slot = findNextSlot(cursor, 50, focusEnd, [...commitments, ...mealWindows, ...scheduledFocus])
    if (slot === null) return
    const title = focusTitle(task)
    blocks.push(blockFromWindow(slot, slot + 50, title, 'focus', [
      formatTaskLine({ ...task, pomodoroEnabled: true, pomodoroLength: 50, breakLength: 10 }),
      '50-minute Pomodoro - no multitasking',
    ]))
    scheduledFocus.push({ start: slot, end: slot + 60 })
    const breakStart = slot + 50
    if (breakStart + 10 <= dayEnd && !overlapsCommitment(breakStart, breakStart + 10, [...commitments, ...mealWindows])) {
      blocks.push(blockFromWindow(breakStart, breakStart + 10, 'Break', 'buffer', [
        'Stand up, water, quick reset',
      ]))
    }
    cursor = slot + (energyLevel === 'low' ? 90 : 70)
  })

  const smallLifeTask = morningPriorityTasks(checkin).smallLifeTask
  if (smallLifeTask) {
    const smallLifeCursor = energyLevel === 'low'
      ? Math.max(morningEnd + 10, 10 * 60)
      : Math.max(cursor, lunch.end + 15)
    const smallLifeSlot = findNextSlot(
      smallLifeCursor,
      20,
      dayEnd,
      [...commitments, ...mealWindows, ...scheduledFocus],
    )
    if (smallLifeSlot !== null) {
      blocks.push(blockFromWindow(smallLifeSlot, smallLifeSlot + 20, 'Small life task', 'admin', [
        formatTaskLine(smallLifeTask),
        'Keep this short and low-energy',
      ]))
    }
  }

  if (urgentBills.length > 0) {
    const billCursor = instructions.includes('bills first') ? morningEnd + 10 : 12 * 60 + 30
    const billSlot = findNextSlot(billCursor, 20, dayEnd, [...commitments, ...mealWindows, ...scheduledFocus])
    if (billSlot !== null) {
      blocks.push(blockFromWindow(billSlot, billSlot + 20, 'Bill deadline check', 'admin', urgentBills.slice(0, 3)))
    }
  }

  if (includeRecoveryBlock) {
    const recoveryStart = Math.max(20 * 60, Math.min(shutdownStart - 60, dinner.end + 60))
    if (recoveryStart + 30 <= shutdownStart && !overlapsCommitment(recoveryStart, recoveryStart + 30, [...commitments, ...mealWindows])) {
      blocks.push(blockFromWindow(recoveryStart, recoveryStart + 30, 'Recovery', 'recovery', [
        energyLevel === 'low' ? 'Longer buffer. Rest is the priority.' : 'Walk, stretch, shower, or quiet rest',
        checkin.notes ? `Personal note: ${checkin.notes}` : 'Do not turn this into another task block',
      ]))
    }
  }

  blocks.push(blockFromWindow(shutdownStart, Math.min(shutdownStart + 30, sleep), 'Shutdown', 'shutdown', [
    'Close work tabs and apps',
    "Update task list - what's done, what carries over",
    `Aim for sleep by ${checkin.sleepTarget || '23:00'}`,
  ]))

  return blocks
    .filter(block => {
      if (!block.startTime || !block.endTime) return true
      return parseTimeToMinutes(block.endTime) > parseTimeToMinutes(block.startTime)
    })
    .sort((a, b) => parseTimeToMinutes(a.startTime, 0) - parseTimeToMinutes(b.startTime, 0))
}

export function isBillUrgent(bill: Bill, referenceDate = new Date()): boolean {
  if (bill.status === 'paid') return false
  const days = getDaysUntil(bill.dueDate, referenceDate)
  return days <= 3 || bill.priority === 'must-pay-today'
}

export function billPrioritization(bills: Bill[], referenceDate = new Date()): string[] {
  return bills
    .filter(b => isBillUrgent(b, referenceDate))
    .map(b => {
      const days = getDaysUntil(b.dueDate, referenceDate)
      const tag =
        days <= 0
          ? 'OVERDUE'
          : days === 0
            ? 'due TODAY'
            : `due in ${days} day${days === 1 ? '' : 's'}`
      return `${b.name} - $${b.amount} (${tag})`
    })
}

export function workLeadSelection(
  opportunities: WorkOpportunity[],
  energyLevel: DailyCheckin['energyLevel'],
  referenceDate = new Date(),
): string[] {
  const leads = opportunities
    .filter(o => {
      if (o.status === 'ignore' || o.status === 'later') return false
      if (o.status === 'apply-today') return true
      if (o.status === 'worth-checking' && energyLevel !== 'low') return true
      if (o.deadline && getDaysUntil(o.deadline, referenceDate) <= 3) return true
      return false
    })
    .slice(0, energyLevel === 'low' ? 1 : 2)
    .map(o =>
      o.nextAction
        ? `${o.title} (${o.source}) -> ${o.nextAction}`
        : `${o.title} (${o.source}) - check and decide`,
    )

  if (leads.length === 0 && energyLevel !== 'low') {
    leads.push(
      'Spend 15 min scanning for new leads (Seek, LinkedIn, council jobs, freelance boards)',
    )
  }

  return leads
}

function selectTasks(tasks: Task[], checkin: DailyCheckin, referenceDate = new Date()) {
  const priorities = morningPriorityTasks(checkin)
  const pending = tasks.filter(isActiveTask)
  const priorityTitles = new Set([
    ...priorities.focusTasks.map(task => task.title.toLowerCase()),
    ...(priorities.smallLifeTask ? [priorities.smallLifeTask.title.toLowerCase()] : []),
  ])
  const scored = [...pending]
    .filter(task => !priorityTitles.has(task.title.toLowerCase()))
    .sort(
    (a, b) =>
      taskScoring(b, referenceDate, checkin.planningInstructions) -
      taskScoring(a, referenceDate, checkin.planningInstructions),
    )
  const cap = checkin.energyLevel === 'low' ? 1 : checkin.energyLevel === 'medium' ? 2 : 3
  const pomoCapTotal = checkin.energyLevel === 'low' ? 1 : 3
  let pomoCount = 0
  const cappedScored = [...priorities.focusTasks, ...scored].map(t => {
    if (t.pomodoroEnabled) {
      if (pomoCount >= pomoCapTotal) return { ...t, pomodoroEnabled: false }
      pomoCount++
    }
    return t
  })

  return {
    top3Tasks: cappedScored.slice(0, Math.min(3, cap)),
    optionalTasks: [
      ...cappedScored.slice(3, 3 + cap),
      ...(priorities.smallLifeTask ? [priorities.smallLifeTask] : []),
    ],
    doNotTasks: cappedScored.slice(3 + cap),
  }
}

export function markdownExport(plan: Omit<GeneratedPlan, 'notionMarkdown'>, top3Tasks: Task[]): string {
  const dateFormatted = new Date(plan.date + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let md = `# Daily Plan - ${dateFormatted}\n\n`
  md += `## Today's Theme\n${plan.theme}\n\n`
  if (plan.dailyPlanBase === 'english-ai-cyber-growth') {
    md += `This is your default growth-day scaffold. Add today’s real tasks into the blocks.\n\n`
  }

  const morningPriorities = top3Tasks.filter(task => task.id.startsWith('morning-'))
  if (morningPriorities.length > 0) {
    md += `## Today's to-do\n`
    morningPriorities.forEach(task => {
      const label = task.id.startsWith('morning-main')
        ? 'Main'
        : task.id.startsWith('morning-secondary')
          ? 'Secondary'
          : 'Small life'
      md += `- ${label}: ${task.title}\n`
    })
    md += '\n'
  }

  const rankedPriorities = top3Tasks.filter(task => task.id.startsWith('ranked-'))
  if (rankedPriorities.length > 0) {
    md += `## Today's to-do\n`
    rankedPriorities.forEach((task, index) => {
      md += `- ${index + 1}. ${task.title} (${task.estimatedMinutes} min)\n`
    })
    md += '\n'
  }

  md += `## Top 3\n`
  top3Tasks.forEach(t => {
    const focusMin = t.pomodoroLength ?? 50
    const breakMin = t.breakLength ?? 10
    const pomoLine = t.pomodoroEnabled
      ? ` - ${focusMin}min focus + ${breakMin}min break`
      : ''
    md += `- [ ] ${t.title}${pomoLine}\n`
    if (t.nextAction) md += `  -> ${t.nextAction}\n`
    if (t.minimumVersion) md += `  -> minimum: ${t.minimumVersion}\n`
    if (t.checklist && t.checklist.length > 0) {
      t.checklist.forEach(c => (md += `  - ${c}\n`))
    }
  })
  md += '\n'

  md += `## Time Blocks\n`
  for (const block of plan.timeBlocks) {
    const range = block.startTime && block.endTime ? `${block.startTime}-${block.endTime} ` : ''
    md += `### ${range}${block.title || block.label}\n`
    block.items.forEach(i => (md += `- ${i}\n`))
    md += '\n'
  }

  md += `## Work / Consulting Leads\n`
  if (plan.workLeadsToday.length > 0) {
    plan.workLeadsToday.forEach(w => (md += `- ${w}\n`))
  } else {
    md += `- No urgent leads today\n`
  }
  md += '\n'

  md += `## Bills\n`
  if (plan.billsToday.length > 0) {
    plan.billsToday.forEach(b => (md += `- ${b}\n`))
  } else {
    md += `- Nothing urgent today\n`
  }
  md += '\n'

  md += `## Recovery\n`
  const recoveryBlock = plan.timeBlocks.find(b => b.period === 'recovery')
  recoveryBlock?.items.forEach(i => (md += `- ${i}\n`))
  md += '\n'

  md += `## Do Not Do Today\n`
  plan.doNotToday.forEach(d => (md += `- ${d}\n`))
  md += '\n'

  md += `## Shutdown\n`
  const shutdownBlock = plan.timeBlocks.find(b => b.period === 'shutdown')
  shutdownBlock?.items.forEach(i => (md += `- ${i}\n`))
  md += '\n'

  md += `## Minimum Viable Day\n`
  plan.minimumViableDay.forEach(m => (md += `- [ ] ${m}\n`))

  return md
}

export function planAssembly(
  checkin: DailyCheckin,
  allTasks: Task[],
  allOpportunities: WorkOpportunity[],
  allBills: Bill[],
  referenceDate = new Date(),
  options: {
    defaultRecoveryBlockEnabled?: boolean
    calendarEvents?: CalendarEvent[]
  } = {},
): GeneratedPlan {
  const { top3Tasks, optionalTasks, doNotTasks } = selectTasks(allTasks, checkin, referenceDate)
  const theme = generateTheme(checkin, top3Tasks)
  const includeRecoveryBlock = options.defaultRecoveryBlockEnabled ?? true
  const calendarEvents = options.calendarEvents ?? []
  const billsToday = billPrioritization(allBills, referenceDate)
  const growthDay = shouldUseGrowthDay(checkin)
  const scaffoldTasks = growthDay ? allTasks.filter(isActiveTask) : top3Tasks
  const timeBlocks = timeBlockGeneration(
    checkin,
    scaffoldTasks,
    growthDay ? [] : optionalTasks,
    includeRecoveryBlock,
    calendarEvents,
    billsToday,
  )
  console.log('[DailyPlan] active tasks used:', allTasks.filter(isActiveTask))
  console.log('[DailyPlan] ranked tasks used:', checkin.rankedTasks ?? [])
  console.log('[DailyPlan] generated blocks:', timeBlocks)
  const doNotToday = doNotTasks.slice(0, 5).map(t => t.title)
  if (calendarEvents.some(isProtectedCalendarEvent)) {
    doNotToday.unshift('Deep-focus Pomodoro blocks during protected calendar time')
  }

  if (checkin.dayType === 'evening-class') {
    doNotToday.unshift('Starting anything major after 4pm - class is tonight')
  }
  if (checkin.dayType === 'saturday-class') {
    doNotToday.unshift('Heavy personal study outside class today')
  }
  if (checkin.energyLevel === 'low') {
    doNotToday.unshift('Pushing through exhaustion - rest is work today')
  }
  if (shouldUseGrowthDay(checkin)) {
    doNotToday.unshift('Loud output after 17:00 - evening mode is quiet input and light review')
  }

  const minimumViableDay: string[] = top3Tasks
    .slice(0, 1)
    .map(t => t.minimumVersion || `${t.title} - even 30 minutes counts`)
  if (top3Tasks.length === 0) {
    minimumViableDay.push(
      shouldUseGrowthDay(checkin)
        ? 'Follow one scaffold block and write what happened'
        : 'Add a small task or choose a template',
    )
  }
  if (includeRecoveryBlock) minimumViableDay.push('Complete recovery block')
  minimumViableDay.push('Shutdown routine completed')

  const planWithoutMarkdown: Omit<GeneratedPlan, 'notionMarkdown'> = {
    date: checkin.date,
    dailyPlanBase: checkin.dailyPlanBase ?? 'english-ai-cyber-growth',
    theme,
    top3: top3Tasks.map(t => ({
      task: t.title,
      nextAction: t.nextAction || 'Define the next action before you start',
    })),
    timeBlocks,
    mustDo: top3Tasks.length > 0
      ? top3Tasks.map(formatTaskLine)
      : ['No active tasks yet — add a task or choose a template.'],
    optional: optionalTasks.length > 0
      ? optionalTasks.map(formatTaskLine)
      : ['Add a small task', 'Start a 15-min block', 'Life reset', 'Review 5 expressions'],
    workLeadsToday: workLeadSelection(allOpportunities, checkin.energyLevel, referenceDate),
    billsToday,
    doNotToday,
    minimumViableDay,
    generatedAt: new Date().toISOString(),
  }

  return {
    ...planWithoutMarkdown,
    notionMarkdown: markdownExport(planWithoutMarkdown, top3Tasks),
  }
}

export function generatePlan(
  checkin: DailyCheckin,
  allTasks: Task[],
  allOpportunities: WorkOpportunity[],
  allBills: Bill[],
): GeneratedPlan {
  return planAssembly(checkin, allTasks, allOpportunities, allBills)
}
