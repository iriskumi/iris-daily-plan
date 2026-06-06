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

export function getDaysUntil(dateStr: string, referenceDate = new Date()): number {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / MS_PER_DAY)
}

export function taskScoring(task: Task, referenceDate = new Date()): number {
  let score = 0

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

function formatCalendarTimeRange(event: CalendarEvent): string {
  const start = new Date(event.start)
  const end = new Date(event.end)
  return `${start.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })}-${end.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function formatCalendarEventLine(event: CalendarEvent): string {
  const location = event.location ? ` @ ${event.location}` : ''
  return `${formatCalendarTimeRange(event)} ${event.title}${location}`
}

function addFixedCommitmentsToBlocks(
  blocks: TimeBlock[],
  checkin: DailyCheckin,
  calendarEvents: CalendarEvent[],
): TimeBlock[] {
  const fixedItems: string[] = []
  const manual = checkin.fixedCommitments.trim()
  if (manual) fixedItems.push(...manual.split('\n').map(line => line.trim()).filter(Boolean))

  const calendarLines = calendarEvents.map(formatCalendarEventLine)
  if (calendarLines.length > 0 && !manual.includes('Imported Google Calendar:')) {
    fixedItems.push(...calendarLines.map(line => `Calendar: ${line}`))
  }

  if (fixedItems.length === 0) return blocks

  const protectedEvents = calendarEvents.filter(isProtectedCalendarEvent)
  const protectedReminder =
    protectedEvents.length > 0
      ? ['Do not schedule deep-focus Pomodoro blocks during protected calendar time']
      : []

  const [firstBlock, ...rest] = blocks
  if (!firstBlock) return blocks

  return [
    {
      ...firstBlock,
      items: [...fixedItems, ...protectedReminder, ...firstBlock.items],
    },
    ...rest,
  ]
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
  optionalTasks: Task[],
  includeRecoveryBlock = true,
): TimeBlock[] {
  const { dayType, energyLevel } = checkin
  const blocks: TimeBlock[] = []

  if (dayType === 'saturday-class') {
    blocks.push({
      period: 'morning',
      label: 'Morning - class prep',
      items: ['Quick breakfast and get settled', 'Holmesglen online class starts 9:00am', 'Have water and snacks nearby'],
    })
    blocks.push({
      period: 'afternoon',
      label: 'Afternoon - class continues',
      items: ['Continue online class until ~5:30pm', 'Take scheduled breaks', 'No other major tasks during class hours'],
    })
    blocks.push({
      period: 'evening',
      label: 'Evening - wind down after class',
      items: [
        'Light review of class notes (20 min max, optional)',
        'No new heavy tasks tonight - class was enough',
        'Decompress and rest',
      ],
    })
  } else if (dayType === 'evening-class') {
    const morningItems =
      top3Tasks
        .filter(t => t.category !== 'recovery')
        .slice(0, energyLevel === 'low' ? 1 : 2)
        .map(formatTaskLine)

    blocks.push({
      period: 'morning',
      label: 'Morning - main focus block (use this time)',
      items:
        morningItems.length > 0
          ? morningItems
          : ['Tackle your top priority task now - evening is blocked'],
    })
    blocks.push({
      period: 'afternoon',
      label: 'Afternoon - lighter tasks + class prep',
      items: [
        'Eat a proper meal before class',
        'Light admin or review tasks only',
        'Prepare class materials by 4:30pm',
        'Leave for class with buffer time',
      ],
    })
    blocks.push({
      period: 'evening',
      label: 'Evening - Holmesglen class 5:30-9:00pm',
      items: [
        'Class 5:30pm-9:00pm',
        'No new work tasks after class - decompress only',
        'Shutdown routine when home',
      ],
    })
  } else if (dayType === 'work-shift') {
    const shiftNote = checkin.fixedCommitments || 'Work shift at Holmesglen (check roster)'
    const preShiftTask =
      energyLevel !== 'low' && top3Tasks.length > 0 ? [formatTaskLine(top3Tasks[0])] : []

    blocks.push({
      period: 'morning',
      label: 'Morning - before shift',
      items:
        preShiftTask.length > 0
          ? [...preShiftTask, 'Prepare for shift']
          : ['Prepare for work shift', 'Light breakfast and get ready'],
    })
    blocks.push({
      period: 'afternoon',
      label: 'Afternoon - work shift',
      items: [shiftNote],
    })
    blocks.push({
      period: 'evening',
      label: 'Evening - after shift',
      items: [
        'Decompress first - no jumping into tasks',
        'Light admin only if energy allows',
        'Do not start heavy study or job applications after a shift',
      ],
    })
  } else if (dayType === 'low-energy') {
    blocks.push({
      period: 'morning',
      label: 'Morning - slow start, no pressure',
      items: [
        'No rushing. Nourishment and movement first',
        top3Tasks.length > 0
          ? `One task only if possible: ${formatTaskLine(top3Tasks[0])}`
          : 'Rest or very light admin only',
      ],
    })
    blocks.push({
      period: 'afternoon',
      label: 'Afternoon - optional small tasks',
      items:
        optionalTasks.length > 0
          ? [optionalTasks[0] ? formatTaskLine(optionalTasks[0]) : 'Light review or admin']
          : ['Rest as needed - low-energy days are valid rest days'],
    })
    blocks.push({
      period: 'evening',
      label: 'Evening - early wind-down',
      items: ['No screens after 9pm', 'Early sleep target tonight', 'Tomorrow will be better'],
    })
  } else {
    const isAdmin = dayType === 'admin-catchup'
    const morningItems = isAdmin
      ? ['Clear email and messages', 'Handle urgent admin tasks'].concat(
          top3Tasks.slice(0, 1).map(formatTaskLine),
        )
      : top3Tasks
          .slice(0, energyLevel === 'high' ? 2 : 1)
          .map(formatTaskLine)

    blocks.push({
      period: 'morning',
      label:
        energyLevel === 'high'
          ? 'Morning - deep work block'
          : 'Morning - main task',
      items: morningItems.length > 0 ? morningItems : ['Start with your top priority task'],
    })

    const afternoonItems = isAdmin
      ? ['Continue admin tasks', 'Scan 1-2 job leads (15 min max)'].concat(
          top3Tasks.slice(1, 2).map(formatTaskLine),
        )
      : top3Tasks
          .slice(energyLevel === 'high' ? 2 : 1, energyLevel === 'high' ? 3 : 2)
          .map(formatTaskLine)
          .concat(optionalTasks.slice(0, 1).map(formatTaskLine))

    blocks.push({
      period: 'afternoon',
      label: 'Afternoon - secondary tasks',
      items:
        afternoonItems.length > 0
          ? afternoonItems
          : ['Secondary tasks and lighter work', 'Consulting / work leads check (15 min)'],
    })

    blocks.push({
      period: 'evening',
      label: 'Evening - wrap-up',
      items: [
        "Review what got done - don't minimise progress",
        "Check tomorrow's class/shift schedule",
        'Optional: English practice (30 min)',
        'No new heavy tasks after 8pm',
      ],
    })
  }

  if (includeRecoveryBlock) {
    blocks.push({
      period: 'recovery',
      label: 'Recovery block - non-negotiable',
      items: [
        energyLevel === 'low'
          ? 'Rest is the priority - this is productive'
          : 'At least one 20-30 min break today',
        'Walk, stretch, or lie down - even 10 minutes counts',
        checkin.notes ? `Personal note: ${checkin.notes}` : 'Protect this time',
      ],
    })
  }

  blocks.push({
    period: 'shutdown',
    label: 'Shutdown routine',
    items: [
      'Close all work tabs and apps',
      "Update task list - what's done, what carries over",
      'Write one win from today (even small counts)',
      `Aim for sleep by ${checkin.sleepTarget || '10:30pm'}`,
    ],
  })

  return blocks
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
  const pending = tasks.filter(t => !t.done)
  const scored = [...pending].sort((a, b) => taskScoring(b, referenceDate) - taskScoring(a, referenceDate))
  const cap = checkin.energyLevel === 'low' ? 1 : checkin.energyLevel === 'medium' ? 2 : 3
  const pomoCapTotal = checkin.energyLevel === 'low' ? 1 : 3
  let pomoCount = 0
  const cappedScored = scored.map(t => {
    if (t.pomodoroEnabled) {
      if (pomoCount >= pomoCapTotal) return { ...t, pomodoroEnabled: false }
      pomoCount++
    }
    return t
  })

  return {
    top3Tasks: cappedScored.slice(0, Math.min(3, cap)),
    optionalTasks: cappedScored.slice(3, 3 + cap),
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
    md += `### ${block.label}\n`
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
  const timeBlocks = addFixedCommitmentsToBlocks(
    timeBlockGeneration(checkin, top3Tasks, optionalTasks, includeRecoveryBlock),
    checkin,
    calendarEvents,
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
    billsToday: billPrioritization(allBills, referenceDate),
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
