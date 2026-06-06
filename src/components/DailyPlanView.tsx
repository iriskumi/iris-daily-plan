import { useState } from 'react'
import {
  Copy,
  Check,
  Zap,
  Sun,
  Cloud,
  Moon,
  Heart,
  LogOut,
  Briefcase,
  CreditCard,
  XCircle,
  Shield,
} from 'lucide-react'
import type { GeneratedPlan, TimeBlock } from '../types'

const PERIOD_ICONS: Record<TimeBlock['period'], React.ReactNode> = {
  morning: <Sun size={13} />,
  afternoon: <Cloud size={13} />,
  evening: <Moon size={13} />,
  recovery: <Heart size={13} />,
  shutdown: <LogOut size={13} />,
}

interface Props {
  plan: GeneratedPlan | null
  onGenerate: () => void
  onGoToCheckin: () => void
}

export default function DailyPlanView({ plan, onGenerate, onGoToCheckin }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!plan) return
    await navigator.clipboard.writeText(plan.notionMarkdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  return (
    <div className="page">
      {/* Header */}
      <div className="plan-header">
        <div className="plan-date-label">{planDate}</div>
        <div className="plan-theme">{plan.theme}</div>
        <div className="plan-meta">Generated at {generatedTime}</div>
      </div>

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
                <div className="top3-num">Priority {i + 1}</div>
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
        {plan.timeBlocks.map((block, i) => (
          <div key={i} className="time-block">
            <div className="time-block-header">
              {PERIOD_ICONS[block.period]}
              {block.label}
            </div>
            <div className="time-block-body">
              <ul>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
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
          Work / Consulting leads to check
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

      {/* Copy to Notion */}
      <div className="plan-section">
        <div className="plan-section-title">Copy to Notion</div>
        <div className="notion-export-card">
          <pre className="notion-preview">{plan.notionMarkdown}</pre>
          <div className="flex gap-sm">
            <button className="btn btn-primary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
            <button className="btn btn-secondary" onClick={onGenerate}>
              <Zap size={14} />
              Re-generate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
