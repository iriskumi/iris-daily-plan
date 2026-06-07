import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, ExternalLink } from 'lucide-react'
import type {
  WorkOpportunity,
  WorkOpportunityType,
  WorkOpportunityStatus,
} from '../types'
import { loadOpportunities, saveOpportunities } from '../storage'
import { getDaysUntil } from '../planner'

const OPP_TYPES: { id: WorkOpportunityType; label: string }[] = [
  { id: 'full-time', label: 'Full-time Job' },
  { id: 'casual', label: 'Casual Job' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'consulting', label: 'Consulting' },
  { id: 'ai-data', label: 'AI Data Work' },
  { id: 'translation-language', label: 'Translation / Language' },
  { id: 'university-tafe-admin', label: 'University / TAFE / Admin' },
  { id: 'government-council', label: 'Government / Council' },
]

const OPP_STATUSES: { id: WorkOpportunityStatus; label: string }[] = [
  { id: 'collected', label: 'Collected' },
  { id: 'worth-checking', label: 'Worth Checking' },
  { id: 'apply-today', label: 'Apply Today' },
  { id: 'later', label: 'Later' },
  { id: 'ignore', label: 'Ignore' },
]

function statusClass(s: WorkOpportunityStatus) {
  const map: Record<WorkOpportunityStatus, string> = {
    'apply-today': 'badge-assessment',
    'worth-checking': 'badge-job-search',
    collected: 'badge-english-practice',
    later: 'badge-admin-life',
    ignore: '',
  }
  return map[s]
}

function typeLabel(t: WorkOpportunityType) {
  return OPP_TYPES.find(o => o.id === t)?.label ?? t
}

const emptyForm = (): Omit<WorkOpportunity, 'id' | 'createdAt'> => ({
  title: '',
  source: '',
  link: '',
  type: 'full-time',
  deadline: '',
  fitScore: 3,
  effortRequired: 'medium',
  nextAction: '',
  status: 'collected',
  notes: '',
})

interface OppFormProps {
  initial?: Partial<Omit<WorkOpportunity, 'id' | 'createdAt'>>
  onSave: (data: Omit<WorkOpportunity, 'id' | 'createdAt'>) => void
  onCancel: () => void
}

function OppForm({ initial, onSave, onCancel }: OppFormProps) {
  const [form, setForm] = useState({ ...emptyForm(), ...initial })
  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="inline-form">
      <div className="form-title">
        <Plus size={14} />
        {initial?.title ? 'Edit Lead' : 'Add Work Lead'}
      </div>

      <div className="form-group">
        <label>Title / Role *</label>
        <input
          autoFocus
          placeholder="e.g. Student Support Officer, Holmesglen Institute"
          value={form.title}
          onChange={e => f('title', e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Source</label>
          <input
            placeholder="Seek, LinkedIn, Council website…"
            value={form.source}
            onChange={e => f('source', e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Link (optional)</label>
          <input
            placeholder="https://…"
            value={form.link ?? ''}
            onChange={e => f('link', e.target.value)}
          />
        </div>
      </div>

      <div className="form-row mt-1">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Type</label>
          <select value={form.type} onChange={e => f('type', e.target.value as WorkOpportunityType)}>
            {OPP_TYPES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Deadline (optional)</label>
          <input
            type="date"
            value={form.deadline ?? ''}
            onChange={e => f('deadline', e.target.value || undefined)}
          />
        </div>
      </div>

      <div className="form-row mt-1">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Fit score (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={form.fitScore}
            onChange={e => f('fitScore', Number(e.target.value))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Effort required</label>
          <select
            value={form.effortRequired}
            onChange={e => f('effortRequired', e.target.value as 'low' | 'medium' | 'high')}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="form-group mt-1">
        <label>Status</label>
        <div className="btn-group">
          {OPP_STATUSES.map(s => (
            <button
              key={s.id}
              type="button"
              className={`btn-option ${form.status === s.id ? 'selected' : ''}`}
              onClick={() => f('status', s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Next action</label>
        <input
          placeholder="e.g. Read JD, check salary range, prepare cover letter draft"
          value={form.nextAction ?? ''}
          onChange={e => f('nextAction', e.target.value)}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Notes (optional)</label>
        <textarea
          placeholder="Anything to remember about this lead…"
          value={form.notes ?? ''}
          onChange={e => f('notes', e.target.value)}
          style={{ minHeight: 60 }}
        />
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!form.title.trim()) return
            onSave(form)
          }}
        >
          <Check size={14} />
          Save
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  )
}

type StatusFilter = WorkOpportunityStatus | 'all'

interface Props {
  onOpportunitiesChange?: () => void
}

export default function WorkCollection({ onOpportunitiesChange }: Props) {
  const [opps, setOpps] = useState<WorkOpportunity[]>(() => loadOpportunities())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function persist(updated: WorkOpportunity[]) {
    setOpps(updated)
    saveOpportunities(updated)
    onOpportunitiesChange?.()
  }

  function addOpp(data: Omit<WorkOpportunity, 'id' | 'createdAt'>) {
    persist([
      { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ...opps,
    ])
    setShowForm(false)
  }

  function updateOpp(id: string, data: Omit<WorkOpportunity, 'id' | 'createdAt'>) {
    persist(opps.map(o => (o.id === id ? { ...o, ...data } : o)))
    setEditingId(null)
  }

  function updateStatus(id: string, status: WorkOpportunityStatus) {
    persist(opps.map(o => (o.id === id ? { ...o, status } : o)))
  }

  function deleteOpp(id: string) {
    if (confirm('Remove this lead?')) persist(opps.filter(o => o.id !== id))
  }

  const filtered =
    statusFilter === 'all'
      ? opps.filter(o => o.status !== 'ignore')
      : opps.filter(o => o.status === statusFilter)

  const countByStatus = (s: WorkOpportunityStatus) => opps.filter(o => o.status === s).length

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h2 className="page-title">Work & Consulting Leads</h2>
            <p className="page-subtitle">
              Collect first, decide later. {opps.filter(o => o.status !== 'ignore').length} active
              leads.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setShowForm(!showForm); setEditingId(null) }}
          >
            <Plus size={14} />
            Add Lead
          </button>
        </div>
      </div>

      {showForm && !editingId && (
        <OppForm onSave={addOpp} onCancel={() => setShowForm(false)} />
      )}

      <div className="filter-bar mt-1">
        <button
          className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All active
        </button>
        {OPP_STATUSES.map(s => {
          const count = countByStatus(s.id)
          if (count === 0) return null
          return (
            <button
              key={s.id}
              className={`filter-chip ${statusFilter === s.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(s.id)}
            >
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-emoji">💼</span>
          <h3>No leads collected yet</h3>
          <p>
            Add jobs, freelance gigs, consulting leads, or AI data work here. You decide what
            deserves attention — the planner will suggest 1–2 per day.
          </p>
        </div>
      ) : (
        <div className="opp-list">
          {filtered.map(opp => {
            const dl = opp.deadline ? getDaysUntil(opp.deadline) : null
            return (
              <div key={opp.id}>
                {editingId === opp.id ? (
                  <OppForm
                    initial={opp}
                    onSave={data => updateOpp(opp.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="opp-card">
                    <div className="opp-card-header">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="opp-title">
                          {opp.title}
                          {opp.link && (
                            <a
                              href={opp.link}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: 6, color: 'var(--accent)' }}
                            >
                              <ExternalLink size={12} style={{ display: 'inline' }} />
                            </a>
                          )}
                        </div>
                        <div className="opp-source">{opp.source} · {typeLabel(opp.type)}</div>
                        <div className="opp-meta">
                          <span className={`badge ${statusClass(opp.status)}`}>
                            {OPP_STATUSES.find(s => s.id === opp.status)?.label}
                          </span>
                          <div className="fit-score" title={`Fit: ${opp.fitScore}/5`}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <div
                                key={n}
                                className={`fit-dot ${n <= opp.fitScore ? 'filled' : ''}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted">
                            effort: {opp.effortRequired}
                          </span>
                          {dl !== null && (
                            <span
                              className={`text-xs ${dl < 0 ? 'text-accent' : dl <= 3 ? '' : 'text-muted'}`}
                              style={{ color: dl < 0 ? 'var(--red)' : dl <= 3 ? 'var(--amber)' : undefined }}
                            >
                              {dl < 0
                                ? `${Math.abs(dl)}d overdue`
                                : dl === 0
                                  ? 'deadline today'
                                  : `${dl}d left`}
                            </span>
                          )}
                        </div>
                        {opp.nextAction && (
                          <div className="opp-next-action">{opp.nextAction}</div>
                        )}
                        {opp.notes && (
                          <div className="text-xs text-muted mt-sm" style={{ lineHeight: 1.4 }}>
                            {opp.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-xs" style={{ flexShrink: 0 }}>
                        <button
                          className="btn-ghost"
                          onClick={() => { setEditingId(opp.id); setShowForm(false) }}
                          title="Edit"
                        >
                          <Pencil />
                        </button>
                        <button
                          className="btn-danger-ghost"
                          onClick={() => deleteOpp(opp.id)}
                          title="Remove"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                    <div className="mt-sm">
                      <select
                        className="status-select"
                        value={opp.status}
                        onChange={e => updateStatus(opp.id, e.target.value as WorkOpportunityStatus)}
                      >
                        {OPP_STATUSES.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
