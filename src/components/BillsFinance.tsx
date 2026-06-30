import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, AlertCircle, RefreshCw } from 'lucide-react'
import type { Bill, BillStatus, BillPriority, NotionBillsSyncResult } from '../types'
import { loadBills, saveBills } from '../storage'
import { getDaysUntil } from '../planner'
import { syncPaidBillsToNotionTransactions } from '../services/notionService'

function billDueLabel(bill: Bill): { text: string; cls: string } {
  const days = getDaysUntil(bill.dueDate)
  if (days < 0) return { text: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, cls: 'overdue' }
  if (days === 0) return { text: 'Due TODAY', cls: 'overdue' }
  if (days <= 3) return { text: `Due in ${days} day${days === 1 ? '' : 's'}`, cls: 'due-soon' }
  if (days <= 7) return { text: `Due in ${days} days`, cls: 'due-soon' }
  return {
    text: `Due ${new Date(bill.dueDate + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`,
    cls: 'ok',
  }
}

function billCardClass(bill: Bill): string {
  if (bill.status === 'paid') return ''
  const days = getDaysUntil(bill.dueDate)
  if (days < 0) return 'bill-overdue'
  if (days <= 3) return 'bill-due-soon'
  return ''
}

const STATUS_LABELS: Record<BillStatus, string> = {
  'not-paid': 'Not paid',
  scheduled: 'Scheduled',
  paid: 'Paid',
  snoozed: 'Snoozed',
}

const STATUS_BADGE_CLASS: Record<BillStatus, string> = {
  'not-paid': 'bill-status-not-paid',
  scheduled: 'bill-status-scheduled',
  paid: 'bill-status-paid',
  snoozed: 'bill-status-snoozed',
}

const emptyForm = (): Omit<Bill, 'id'> => ({
  name: '',
  amount: 0,
  dueDate: '',
  status: 'not-paid',
  priority: 'pay-this-week',
  notes: '',
})

interface BillFormProps {
  initial?: Partial<Omit<Bill, 'id'>>
  onSave: (data: Omit<Bill, 'id'>) => void
  onCancel: () => void
}

function BillForm({ initial, onSave, onCancel }: BillFormProps) {
  const [form, setForm] = useState({ ...emptyForm(), ...initial })
  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const priorityOptions: { id: BillPriority; label: string }[] = [
    { id: 'must-pay-today', label: 'Must pay today' },
    { id: 'pay-this-week', label: 'Pay this week' },
    { id: 'can-wait', label: 'Can wait' },
  ]

  return (
    <div className="inline-form">
      <div className="form-title">
        <Plus size={14} />
        {initial?.name ? 'Edit Bill' : 'Add Bill'}
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Bill name *</label>
          <input
            autoFocus
            placeholder="e.g. Electricity, Internet, Rent"
            value={form.name}
            onChange={e => f('name', e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Amount ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.amount || ''}
            onChange={e => f('amount', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="form-row mt-1">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Due date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={e => f('dueDate', e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Status</label>
          <select
            value={form.status}
            onChange={e => f('status', e.target.value as BillStatus)}
          >
            {(Object.keys(STATUS_LABELS) as BillStatus[]).map(s => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group mt-1">
        <label>Payment priority</label>
        <div className="btn-group">
          {priorityOptions.map(p => (
            <button
              key={p.id}
              type="button"
              className={`btn-option ${form.priority === p.id ? 'selected' : ''}`}
              onClick={() => f('priority', p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Notes (optional)</label>
        <input
          placeholder="e.g. autopay set up, need to call provider"
          value={form.notes ?? ''}
          onChange={e => f('notes', e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!form.name.trim() || !form.dueDate) return
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

interface Props {
  onBillsChange: () => void
}

type ViewFilter = 'all' | 'urgent' | 'upcoming' | 'paid'

export default function BillsFinance({ onBillsChange }: Props) {
  const [bills, setBills] = useState<Bill[]>(() => loadBills())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [syncingPaidBills, setSyncingPaidBills] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<NotionBillsSyncResult | null>(null)

  function persist(updated: Bill[]) {
    setBills(updated)
    saveBills(updated)
    onBillsChange()
  }

  function addBill(data: Omit<Bill, 'id'>) {
    persist([{ ...data, id: crypto.randomUUID() }, ...bills])
    setShowForm(false)
  }

  function updateBill(id: string, data: Omit<Bill, 'id'>) {
    persist(bills.map(b => (b.id === id ? { ...b, ...data } : b)))
    setEditingId(null)
  }

  function quickStatus(id: string, status: BillStatus) {
    persist(bills.map(b => (b.id === id ? { ...b, status } : b)))
  }

  function deleteBill(id: string) {
    if (confirm('Remove this bill?')) persist(bills.filter(b => b.id !== id))
  }

  async function handleSyncPaidBills() {
    setSyncingPaidBills(true)
    setSyncMessage(null)
    setSyncResult(null)
    const result = await syncPaidBillsToNotionTransactions()
    setSyncingPaidBills(false)
    setSyncMessage(result.message)
    setSyncResult(result.data)
  }

  const overdue = bills.filter(b => b.status !== 'paid' && getDaysUntil(b.dueDate) < 0)
  const dueSoon3 = bills.filter(b => b.status !== 'paid' && getDaysUntil(b.dueDate) >= 0 && getDaysUntil(b.dueDate) <= 3)
  const upcoming7 = bills.filter(b => b.status !== 'paid' && getDaysUntil(b.dueDate) > 3 && getDaysUntil(b.dueDate) <= 7)

  const filtered = bills.filter(b => {
    if (viewFilter === 'paid') return b.status === 'paid'
    if (viewFilter === 'urgent') return b.status !== 'paid' && getDaysUntil(b.dueDate) <= 3
    if (viewFilter === 'upcoming') return b.status !== 'paid' && getDaysUntil(b.dueDate) > 3 && getDaysUntil(b.dueDate) <= 14
    return b.status !== 'paid'
  })

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h2 className="page-title">Bills & Finance</h2>
            <p className="page-subtitle">
              {overdue.length > 0
                ? `${overdue.length} overdue · `
                : ''}
              {dueSoon3.length > 0 ? `${dueSoon3.length} due within 3 days · ` : ''}
              {upcoming7.length > 0 ? `${upcoming7.length} due this week` : 'All clear this week'}
            </p>
          </div>
          <div className="flex gap-xs" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              onClick={handleSyncPaidBills}
              disabled={syncingPaidBills}
            >
              <RefreshCw size={14} />
              {syncingPaidBills ? 'Syncing...' : 'Sync Paid Bills'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => { setShowForm(!showForm); setEditingId(null) }}
            >
              <Plus size={14} />
              Add Bill
            </button>
          </div>
        </div>
      </div>

      {syncMessage && (
        <div className="notion-status">
          <span>{syncMessage}</span>
          {syncResult && (
            <span>
              Scanned {syncResult.scanned} · Created {syncResult.created} · Skipped {syncResult.skipped} · Errors {syncResult.errors.length}
            </span>
          )}
          {syncResult?.errors.length ? (
            <details>
              <summary>View sync errors</summary>
              <ul>
                {syncResult.errors.map((error, index) => (
                  <li key={`${error.billId || 'sync-error'}-${index}`}>
                    {error.billName ? `${error.billName}: ` : ''}{error.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      {showForm && !editingId && (
        <BillForm onSave={addBill} onCancel={() => setShowForm(false)} />
      )}

      {(overdue.length > 0 || dueSoon3.length > 0) && (
        <div className="card mt-1" style={{ borderColor: overdue.length > 0 ? 'var(--red-border)' : 'var(--amber-border)' }}>
          <div className="card-title-row mb-sm">
            <AlertCircle size={14} style={{ color: overdue.length > 0 ? 'var(--red)' : 'var(--amber)' }} />
            <span className="card-title" style={{ color: overdue.length > 0 ? 'var(--red)' : 'var(--amber)' }}>
              Needs attention today
            </span>
          </div>
          {[...overdue, ...dueSoon3].map(bill => {
            const dl = billDueLabel(bill)
            return (
              <div key={bill.id} className="flex-between" style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="font-semibold text-sm">{bill.name}</div>
                  <div className="text-xs" style={{ color: dl.cls === 'overdue' ? 'var(--red)' : 'var(--amber)' }}>
                    ${bill.amount} · {dl.text}
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => quickStatus(bill.id, 'paid')}
                >
                  Mark paid
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="filter-bar mt-1">
        {([
          { id: 'all', label: 'All unpaid' },
          { id: 'urgent', label: `Urgent (${overdue.length + dueSoon3.length})` },
          { id: 'upcoming', label: `Upcoming (${upcoming7.length})` },
          { id: 'paid', label: `Paid (${bills.filter(b => b.status === 'paid').length})` },
        ] as { id: ViewFilter; label: string }[]).map(f => (
          <button
            key={f.id}
            className={`filter-chip ${viewFilter === f.id ? 'active' : ''}`}
            onClick={() => setViewFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-emoji">💳</span>
          <h3>{viewFilter === 'paid' ? 'Nothing marked paid' : 'No bills here'}</h3>
          <p>Add bills to track due dates. Urgent ones will appear in Today's Plan alerts.</p>
        </div>
      ) : (
        <div className="bill-list">
          {filtered.map(bill => {
            const dl = billDueLabel(bill)
            return (
              <div key={bill.id}>
                {editingId === bill.id ? (
                  <BillForm
                    initial={bill}
                    onSave={data => updateBill(bill.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className={`bill-card ${billCardClass(bill)}`}>
                    <div className="bill-info">
                      <div className="bill-name">{bill.name}</div>
                      <div className="bill-amount">${bill.amount.toFixed(2)}</div>
                      <div className={`bill-due-label ${dl.cls}`}>{dl.text}</div>
                      {bill.notes && (
                        <div className="text-xs text-muted mt-sm">{bill.notes}</div>
                      )}
                    </div>
                    <div className="flex gap-xs" style={{ alignItems: 'center' }}>
                      <span className={`bill-status-badge ${STATUS_BADGE_CLASS[bill.status]}`}>
                        {STATUS_LABELS[bill.status]}
                      </span>
                    </div>
                    <div className="flex gap-xs" style={{ flexShrink: 0 }}>
                      {bill.status !== 'paid' && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => quickStatus(bill.id, 'paid')}
                          title="Mark paid"
                        >
                          <Check size={12} />
                        </button>
                      )}
                      <button
                        className="btn-ghost"
                        onClick={() => { setEditingId(bill.id); setShowForm(false) }}
                        title="Edit"
                      >
                        <Pencil />
                      </button>
                      <button
                        className="btn-danger-ghost"
                        onClick={() => deleteBill(bill.id)}
                        title="Delete"
                      >
                        <Trash2 />
                      </button>
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
