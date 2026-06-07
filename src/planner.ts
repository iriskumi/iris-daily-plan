import type {
  DailyCheckin,
  Task,
  WorkOpportunity,
  Bill,
  CalendarEvent,
  GeneratedPlan,
  TimeBlock,
} from './types'

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
): TimeBlock {
  return {
    period: type === 'recovery' ? 'recovery' : type === 'shutdown' ? 'shutdown' : periodForTime(start),
    label: `${toTimeString(start)}-${toTimeString(end)} ${title}`,
    startTime: toTimeString(start),
    endTime: toTimeString(end),
    title,
    type,
    items,
  }
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
  if (task.category === 'cyber-study' || task.category === 'assessment') return 'Cyber assessment focus block'
  if (task.category === 'english-practice') return 'English Output Pomodoro'
  if (task.category === 'job-search') return 'Job search Pomodoro'
  if (task.category === 'consulting-freelance') return 'AI learning / consulting focus'
  return `${task.title} Pomodoro`
}

function cleanPriority(value?: string): string {
  return (value ?? '').trim()
}

function morningPriorityTasks(checkin: DailyCheckin): {
  focusTasks: Task[]
  smallLifeTask: Task | null
} {
  const main = cleanPriority(checkin.morningMainTask)
  const secondary = [
    cleanPriority(checkin.morningSecondaryTask1),
    cleanPriority(checkin.morningSecondaryTask2),
  ].filter(Boolean)
  const smallLife = cleanPriority(checkin.morningSmallLifeTask)
  const now = new Date().toISOString()
  const focusTasks: Task[] = []

  if (main) {
    focusTasks.push({
      id: `morning-main-${checkin.date}`,
      title: main,
      category: 'assessment',
      estimatedMinutes: 50,
      difficulty: 'medium',
      urgency: 'high',
      importance: 'high',
      minimumVersion: `${main} - 25 minute minimum version`,
      nextAction: `Start ${main}`,
      pomodoroEnabled: true,
      pomodoroLength: 50,
      breakLength: 10,
      pomodoroSessions: 1,
      done: false,
      createdAt: now,
    })
  }

  secondary.forEach((title, index) => {
    focusTasks.push({
      id: `morning-secondary-${index + 1}-${checkin.date}`,
      title,
      category: 'cyber-study',
      estimatedMinutes: 40,
      difficulty: 'medium',
      urgency: 'medium',
      importance: 'medium',
      minimumVersion: `${title} - 15 minute version`,
      nextAction: `Make progress on ${title}`,
      pomodoroEnabled: true,
      pomodoroLength: 40,
      breakLength: 10,
      pomodoroSessions: 1,
      done: false,
      createdAt: now,
    })
  })

  return {
    focusTasks,
    smallLifeTask: smallLife
      ? {
          id: `morning-small-life-${checkin.date}`,
          title: smallLife,
          category: 'admin-life',
          estimatedMinutes: 20,
          difficulty: 'easy',
          urgency: 'medium',
          importance: 'medium',
          minimumVersion: `${smallLife} - 5 minute reset version`,
          nextAction: `Do the smallest version of ${smallLife}`,
          pomodoroEnabled: false,
          done: false,
          createdAt: now,
        }
      : null,
  }
}

function generateTheme(checkin: DailyCheckin, top3Tasks: Task[]): string {
  const { dayType, energyLevel } = checkin

  if (dayType === 'saturday-class')
    return 'Holmesglen Saturday - class is the main event today'
  if (dayType === 'evening-class') {
    if (energyLevel === 'low') return 'Class night - conserve energy for the evening'
    return 'Class night - morning sprint, evening learning at Holmesglen'
  }
  if (dayType === 'work-shift') return 'Work shift day - plan around your Holmesglen hours'
  if (dayType === 'low-energy') return 'Gentle progress day - small wins matter, rest counts'
  if (dayType === 'admin-catchup') return 'Admin day - clear the backlog, create space'

  const hasAssessment = top3Tasks.some(t => t.category === 'assessment')
  const hasJobSearch = top3Tasks.some(t => t.category === 'job-search')

  if (energyLevel === 'high') {
    if (hasAssessment) return 'Deep work day - final-term cyber assessment focus'
    return 'High-energy day - make serious progress'
  }
  if (energyLevel === 'medium') {
    if (hasAssessment) return 'Steady day - chip away at the cyber assessment'
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
  const pending = tasks.filter(t => !t.done)
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

  const morningPriorities = top3Tasks.filter(task => task.id.startsWith('morning-'))
  if (morningPriorities.length > 0) {
    md += `## Morning 1+2+1 Priorities\n`
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
  const timeBlocks = timeBlockGeneration(
    checkin,
    top3Tasks,
    optionalTasks,
    includeRecoveryBlock,
    calendarEvents,
    billsToday,
  )
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

  const minimumViableDay: string[] = top3Tasks
    .slice(0, 1)
    .map(t => t.minimumVersion || `${t.title} - even 30 minutes counts`)
  if (includeRecoveryBlock) minimumViableDay.push('Complete recovery block')
  minimumViableDay.push('Shutdown routine completed')

  const planWithoutMarkdown: Omit<GeneratedPlan, 'notionMarkdown'> = {
    date: checkin.date,
    theme,
    top3: top3Tasks.map(t => ({
      task: t.title,
      nextAction: t.nextAction || 'Define the next action before you start',
    })),
    timeBlocks,
    mustDo: top3Tasks.map(formatTaskLine),
    optional: optionalTasks.map(formatTaskLine),
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
