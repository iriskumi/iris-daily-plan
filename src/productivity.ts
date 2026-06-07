import type {
  Bill,
  CarryOverSuggestion,
  DailyLog,
  GeneratedPlan,
  NextAction,
  RealityCheck,
  Task,
  TimeBlock,
  WorkOpportunity,
} from './types'
import { localDateString } from './focus'
import { getDaysUntil } from './planner'

function minutesFromTime(value?: string): number | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

function blockMinutes(block: TimeBlock): number {
  const start = minutesFromTime(block.startTime)
  const end = minutesFromTime(block.endTime)
  if (start === null || end === null || end <= start) return block.type === 'focus' ? 50 : 0
  return end - start
}

function firstUsefulItem(block: TimeBlock): string {
  return block.items.find(Boolean) ?? block.title ?? block.label
}

function actionFromBlock(block: TimeBlock, detailPrefix: string): NextAction {
  const title = block.title || block.label
  return {
    title,
    detail: `${detailPrefix}: ${firstUsefulItem(block)}`,
    startTime: block.startTime,
    endTime: block.endTime,
    taskTitle: title,
    category: block.type === 'admin' ? 'admin-life' : block.type === 'recovery' ? 'recovery' : 'cyber-study',
    focusMinutes: block.type === 'focus' ? Math.max(10, blockMinutes(block) || 50) : undefined,
    canStartFocus: block.type === 'focus' || block.type === 'admin',
  }
}

export function getNextAction(plan: GeneratedPlan | null, referenceDate = new Date()): NextAction {
  if (!plan) {
    return {
      title: 'Create today’s plan',
      detail: 'Start with check-in, calendar, and one realistic focus block.',
      canStartFocus: false,
    }
  }

  const now = referenceDate.getHours() * 60 + referenceDate.getMinutes()
  const datedToday = plan.date === localDateString(referenceDate)
  const current = datedToday
    ? plan.timeBlocks.find(block => {
        const start = minutesFromTime(block.startTime)
        const end = minutesFromTime(block.endTime)
        return start !== null && end !== null && now >= start && now <= end
      })
    : null
  if (current) return actionFromBlock(current, 'Current block')

  const upcoming = datedToday
    ? plan.timeBlocks.find(block => {
        const start = minutesFromTime(block.startTime)
        return start !== null && start > now
      })
    : null
  if (upcoming) return actionFromBlock(upcoming, 'Next scheduled block')

  const priority = plan.top3[0]
  if (priority) {
    return {
      title: priority.task,
      detail: priority.nextAction || 'Do the smallest useful next step.',
      taskTitle: priority.task,
      category: 'cyber-study',
      focusMinutes: 25,
      canStartFocus: true,
    }
  }

  return {
    title: 'Small reset',
    detail: plan.minimumViableDay[0] ?? 'Tidy one loose end and write what changed.',
    category: 'admin-life',
    focusMinutes: 10,
    canStartFocus: true,
  }
}

export function getRealityCheck(plan: GeneratedPlan | null): RealityCheck | null {
  if (!plan) return null
  const focusBlocks = plan.timeBlocks.filter(block => block.type === 'focus')
  const adminBlocks = plan.timeBlocks.filter(block => block.type === 'admin')
  const lateFocus = focusBlocks.some(block => (minutesFromTime(block.startTime) ?? 0) >= 18 * 60)
  const calendarBlocks = plan.timeBlocks.filter(block =>
    block.type === 'class' || block.type === 'work',
  )
  const estimatedFocusMinutes = focusBlocks.reduce((sum, block) => sum + blockMinutes(block), 0)
  const pressureScore =
    focusBlocks.length * 2 +
    adminBlocks.length +
    calendarBlocks.length * 2 +
    Math.max(0, plan.mustDo.length - 3)
  const load: RealityCheck['load'] =
    pressureScore <= 4 && estimatedFocusMinutes <= 120
      ? 'Light'
      : pressureScore <= 8 && estimatedFocusMinutes <= 220
        ? 'Reasonable'
        : 'Too much'
  const riskNotes = [
    lateFocus ? 'Evening focus may collide with low energy.' : '',
    calendarBlocks.length > 1 ? 'Calendar commitments leave less recovery space.' : '',
    adminBlocks.length > 2 ? 'Several admin blocks may create task switching fatigue.' : '',
    plan.billsToday.length > 1 ? 'Bill reminders add extra cognitive load.' : '',
    load === 'Too much' ? 'Reduce scope before starting so unfinished tasks do not pile up.' : '',
  ].filter(Boolean)

  return {
    load,
    estimatedFocusBlocks: focusBlocks.length,
    estimatedFocusMinutes,
    riskNotes: riskNotes.length > 0 ? riskNotes : ['Plan looks workable if breaks stay protected.'],
  }
}

export function reducePlanForLowEnergy(plan: GeneratedPlan): GeneratedPlan {
  const protectedBlocks = plan.timeBlocks.filter(block =>
    block.type === 'class' || block.type === 'work' || block.type === 'meal',
  )
  const firstFocus = plan.timeBlocks.find(block => block.type === 'focus')
  const firstAdmin = plan.timeBlocks.find(block => block.type === 'admin')
  const recovery =
    plan.timeBlocks.find(block => block.type === 'recovery') ?? {
      period: 'recovery' as const,
      label: 'Recovery',
      startTime: '16:30',
      endTime: '17:00',
      title: 'Recovery block',
      type: 'recovery' as const,
      items: ['Eat, hydrate, reset the room, and stop before crash mode.'],
    }
  const blocks = [
    ...protectedBlocks,
    firstFocus
      ? {
          ...firstFocus,
          title: `Must-do: ${firstFocus.title || firstFocus.label}`,
          items: firstFocus.items.slice(0, 2),
        }
      : null,
    firstAdmin
      ? {
          ...firstAdmin,
          title: `Tiny admin: ${firstAdmin.title || firstAdmin.label}`,
          items: firstAdmin.items.slice(0, 1),
        }
      : null,
    recovery,
  ].filter((block): block is TimeBlock => block !== null)

  const mustDo = plan.mustDo.slice(0, 1)
  const tinyAdmin = firstAdmin ? firstUsefulItem(firstAdmin) : 'Clear one tiny admin/reset task'
  return {
    ...plan,
    theme: `Low Energy Mode - ${plan.theme}`,
    top3: plan.top3.slice(0, 1),
    timeBlocks: blocks,
    mustDo,
    optional: [tinyAdmin, ...plan.optional],
    doNotToday: [
      'Do not chase the original full plan today',
      ...plan.doNotToday,
    ],
    minimumViableDay: [
      mustDo[0] ?? plan.minimumViableDay[0] ?? 'One must-do only',
      tinyAdmin,
      firstUsefulItem(recovery),
    ],
    notionMarkdown: [
      plan.notionMarkdown,
      '',
      '## Low Energy Mode',
      '- Preserved meals and fixed calendar commitments.',
      '- Compressed plan to one must-do, one tiny admin/reset task, and one recovery block.',
    ].join('\n'),
    generatedAt: new Date().toISOString(),
    fallbackReason: 'Low Energy Mode compressed the existing plan without deleting original tasks.',
  }
}

export function getCarryOverSuggestions(tasks: Task[], log?: DailyLog | null): CarryOverSuggestion[] {
  const mentionedCarry = (log?.carryOverToTomorrow ?? '').toLowerCase()
  return tasks
    .filter(task => !task.done)
    .slice()
    .sort((a, b) => {
      const aDue = a.deadline ? getDaysUntil(a.deadline) : 99
      const bDue = b.deadline ? getDaysUntil(b.deadline) : 99
      return aDue - bDue
    })
    .slice(0, 8)
    .map(task => {
      const days = task.deadline ? getDaysUntil(task.deadline) : 99
      if (mentionedCarry.includes(task.title.toLowerCase()) || task.urgency === 'high' || days <= 1) {
        return {
          taskId: task.id,
          taskTitle: task.title,
          classification: 'carry-over',
          reason: days <= 1 ? 'Deadline is close.' : 'Still important enough for tomorrow.',
          suggestedAction: task.nextAction || task.minimumVersion || task.title,
        }
      }
      if (task.estimatedMinutes > 60 || task.difficulty === 'hard') {
        return {
          taskId: task.id,
          taskTitle: task.title,
          classification: 'reduce',
          reason: 'Large or hard task; shrink it before carrying over.',
          suggestedAction: task.minimumVersion || task.nextAction || `Do 15 minutes of ${task.title}`,
        }
      }
      if (task.importance === 'low' && task.urgency === 'low') {
        return {
          taskId: task.id,
          taskTitle: task.title,
          classification: 'delete-ignore',
          reason: 'Low urgency and low importance.',
          suggestedAction: 'Ignore for tomorrow unless it becomes relevant again.',
        }
      }
      return {
        taskId: task.id,
        taskTitle: task.title,
        classification: 'postpone',
        reason: 'Not the next best use of tomorrow’s energy.',
        suggestedAction: task.nextAction || task.title,
      }
    })
}

export function formatCarryOverSuggestions(suggestions: CarryOverSuggestion[]): string {
  if (suggestions.length === 0) return 'No unfinished tasks need carry-over.'
  return suggestions
    .map(item => {
      const label = item.classification.replace('-', ' / ')
      return `- ${item.taskTitle}: ${label} — ${item.suggestedAction}`
    })
    .join('\n')
}

export function getTodayWorkReminders(opportunities: WorkOpportunity[]): WorkOpportunity[] {
  return opportunities
    .filter(item => item.status === 'apply-today' || item.status === 'worth-checking')
    .slice(0, 2)
}

export function getTodayBillReminders(bills: Bill[]): Bill[] {
  return bills
    .filter(bill => bill.status !== 'paid' && getDaysUntil(bill.dueDate) <= 3)
    .slice(0, 3)
}
