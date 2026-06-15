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
  saveTasks,
  saveTimeBlockFollowUp,
} from '../storage'
import { formatFocusStatsMarkdown, getFocusStats } from '../focus'
import {
  formatCarryOverSuggestions,
  getCarryOverSuggestions,
  getRealityCheck,
} from '../productivity'
import { exportPlanToNotion } from '../services/notionService'
import { summarizeToday } from '../services/aiService'
import FocusGarden from './FocusGarden'

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
  return [
    block.startTime ?? 'no-start',
    block.endTime ?? 'no-end',
    block.period,
    block.type ?? 'block',
    block.title ?? block.label,
    index,
  ].join('|')
}

const FOLLOW_UP_OPTIONS = [
  { value: 'followed', label: 'Followed' },
  { value: 'partial', label: 'Partial' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'changed', label: 'Changed' },
] as const

function getPlanSourceLabel(plan: GeneratedPlan): string {
  if (plan.aiUsed && plan.provider === 'gemini') return 'Gemini'
  if (plan.aiUsed && plan.provider === 'deepseek') return 'DeepSeek'
  if (plan.aiUsed && plan.provider === 'openai') return 'OpenAI'
  return 'Local'
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function morningPriorityLines() {
  const checkin = loadCheckin()
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
}

export default function DailyPlanView({
  plan,
  onGenerate,
  onRegenerate,
  onGoToCheckin,
  onReducePlan,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [notionStatus, setNotionStatus] = useState<string | null>(null)
  const [notionUrl, setNotionUrl] = useState<string | null>(null)
  const [pushingNotion, setPushingNotion] = useState(false)
  const [finishingDay, setFinishingDay] = useState(false)
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
        checkin: loadCheckin(),
        tasks: loadTasks(),
        calendarEvents: loadCalendarEvents(),
        opportunities: loadOpportunities(),
        bills: loadBills(),
        markdown: markdownForCopy,
        followUps: Object.values(followUps),
      },
    )
    setPushingNotion(false)
    setNotionStatus(result.message)
    setNotionUrl(result.data?.pageUrl ?? null)
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
        checkin: loadCheckin(),
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
  const morningPriorities = morningPriorityLines()

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
          <div className="plan-section-title">
            <Shield size={12} />
            Top {plan.top3.length} Priorities
          </div>
          <div className="top3-list">
            {plan.top3.map((item, i) => (
              <div key={i} className="top3-item">
                <div className="top3-num">priority {i + 1}</div>
                <div className="top3-task">{item.task}</div>
                <div className="top3-action">{item.nextAction}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time Blocks */}
      <div className="plan-section">
        <div className="plan-section-title">
          <Sun size={12} />
          Time Blocks
        </div>
        {plan.timeBlocks.map((block, i) => {
          const blockKey = getTimeBlockKey(block, i)
          const followUp = followUps[blockKey] ?? {
            date: plan.date,
            blockKey,
            status: '',
            notes: '',
            updatedAt: '',
          }
          return (
          <div key={i} className={`time-block time-block-${block.type ?? 'default'}`}>
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
              <ul>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
              <div className="time-block-follow-up">
                <div className="follow-up-options" role="group" aria-label={`Follow-up for ${getTimeBlockTitle(block)}`}>
                  {FOLLOW_UP_OPTIONS.map(option => (
                    <button
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
          </div>
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
