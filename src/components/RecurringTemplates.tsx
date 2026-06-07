import { useState } from 'react'
import { Plus, Pencil, Copy, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { Template, TaskCategory, Task } from '../types'
import { loadTemplates, saveTemplates, loadTasks, saveTasks } from '../storage'

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default-english-output',
    name: 'English Output',
    purpose: 'English speaking and output practice',
    category: 'english-practice',
    subtasks: [
      'Shadowing — 10 minutes',
      'Record a 1-minute summary',
      'Add 3 useful expressions to notes',
      'Use 1 expression in a sentence',
    ],
    estimatedMinutes: 40,
    pomodoroEnabled: true,
    pomodoroLength: 50,
    breakLength: 10,
    isDefault: true,
    createdAt: '',
  },
  {
    id: 'default-ai-learning',
    name: 'AI Learning',
    purpose: 'Practical AI skill building',
    category: 'consulting-freelance',
    subtasks: [
      'Watch or read one small AI lesson',
      'Try one small hands-on action',
      'Write down one usable takeaway',
    ],
    estimatedMinutes: 50,
    pomodoroEnabled: true,
    pomodoroLength: 50,
    breakLength: 10,
    isDefault: true,
    createdAt: '',
  },
  {
    id: 'default-cybersecurity',
    name: 'Cybersecurity',
    purpose: 'Certificate IV cyber study and assessment progress',
    category: 'assessment',
    subtasks: [
      'Review current assessment requirement',
      'Do one practical step',
      'Write down evidence / screenshots / notes',
    ],
    estimatedMinutes: 75,
    pomodoroEnabled: true,
    pomodoroLength: 50,
    breakLength: 10,
    isDefault: true,
    createdAt: '',
  },
  {
    id: 'default-exercise',
    name: 'Exercise',
    purpose: 'Basic health and energy maintenance',
    category: 'recovery',
    subtasks: [
      '10-minute walk or light workout',
      'Stretching',
      'Log completion',
    ],
    estimatedMinutes: 20,
    pomodoroEnabled: false,
    pomodoroLength: 25,
    breakLength: 5,
    isDefault: true,
    createdAt: '',
  },
]

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  assessment: 'Assessment',
  'cyber-study': 'Cyber Study',
  'job-search': 'Job Search',
  'work-shift': 'Work / Holmesglen',
  'admin-life': 'Admin / Life',
  'english-practice': 'English Practice',
  recovery: 'Recovery',
  'finance-bills': 'Finance / Bills',
  'consulting-freelance': 'Consulting / Freelance',
}

function getTemplates(): Template[] {
  const saved = loadTemplates()
  if (saved.length === 0) {
    saveTemplates(DEFAULT_TEMPLATES)
    return DEFAULT_TEMPLATES
  }
  return saved
}

const emptyForm = (): Omit<Template, 'id' | 'createdAt' | 'isDefault'> => ({
  name: '',
  purpose: '',
  category: 'cyber-study',
  subtasks: [''],
  estimatedMinutes: 50,
  pomodoroEnabled: true,
  pomodoroLength: 50,
  breakLength: 10,
})

interface TemplateFormProps {
  initial?: Partial<Omit<Template, 'id' | 'createdAt' | 'isDefault'>>
  onSave: (data: Omit<Template, 'id' | 'createdAt' | 'isDefault'>) => void
  onCancel: () => void
}

function TemplateForm({ initial, onSave, onCancel }: TemplateFormProps) {
  const [form, setForm] = useState({ ...emptyForm(), ...initial })
  const [subtasksText, setSubtasksText] = useState((initial?.subtasks ?? ['']).join('\n'))

  function f<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="inline-form">
      <div className="form-title">
        <Plus size={14} />
        {initial?.name ? 'Edit Template' : 'New Template'}
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Template name *</label>
          <input
            autoFocus
            placeholder="e.g. Morning Writing"
            value={form.name}
            onChange={e => f('name', e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Category</label>
          <select value={form.category} onChange={e => f('category', e.target.value as TaskCategory)}>
            {(Object.entries(CATEGORY_LABELS) as [TaskCategory, string][]).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group mt-1">
        <label>Purpose</label>
        <input
          placeholder="What is this routine for?"
          value={form.purpose}
          onChange={e => f('purpose', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Subtasks (one per line)</label>
        <textarea
          placeholder={'e.g.\nReview notes\nDo one practice problem\nWrite takeaway'}
          value={subtasksText}
          onChange={e => {
            setSubtasksText(e.target.value)
            f('subtasks', e.target.value.split('\n').filter(s => s.trim()))
          }}
          style={{ minHeight: 100, fontSize: 13 }}
        />
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Estimated minutes</label>
          <input
            type="number"
            min={5}
            step={5}
            value={form.estimatedMinutes}
            onChange={e => f('estimatedMinutes', Number(e.target.value))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Focus mode</label>
          <div className="btn-group">
            <button
              type="button"
              className={`btn-option ${form.pomodoroEnabled ? 'selected' : ''}`}
              onClick={() => f('pomodoroEnabled', true)}
            >
              Pomodoro on
            </button>
            <button
              type="button"
              className={`btn-option ${!form.pomodoroEnabled ? 'selected' : ''}`}
              onClick={() => f('pomodoroEnabled', false)}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      {form.pomodoroEnabled && (
        <div className="form-row mt-1">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Focus (min)</label>
            <input
              type="number"
              min={10}
              step={5}
              value={form.pomodoroLength}
              onChange={e => f('pomodoroLength', Number(e.target.value))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Break (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={form.breakLength}
              onChange={e => f('breakLength', Number(e.target.value))}
            />
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!form.name.trim()) return
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

interface TemplateCardProps {
  template: Template
  onAddToday: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  isDefault?: boolean
}

function TemplateCard({ template, onAddToday, onEdit, onDuplicate, onDelete, isDefault }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [added, setAdded] = useState(false)

  function handleAdd() {
    onAddToday()
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="template-card">
      <div className="template-card-header">
        <div className="template-card-title-row">
          <span className="template-name">{template.name}</span>
          {isDefault && <span className="template-default-badge">default</span>}
          {template.pomodoroEnabled && (
            <span className="template-pomo-badge">
              🍅 {template.pomodoroLength}min
            </span>
          )}
        </div>
        <div className="template-card-actions">
          <button
            className={`btn ${added ? 'btn-secondary' : 'btn-primary'}`}
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
            onClick={handleAdd}
          >
            {added ? <Check size={12} /> : <Plus size={12} />}
            {added ? 'Added' : 'Add to plan'}
          </button>
          <button className="btn-ghost" onClick={() => setExpanded(e => !e)} title="Details">
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </button>
          <button className="btn-ghost" onClick={onEdit} title="Edit">
            <Pencil />
          </button>
          <button className="btn-ghost" onClick={onDuplicate} title="Duplicate">
            <Copy />
          </button>
          {!isDefault && (
            <button className="btn-danger-ghost" onClick={onDelete} title="Delete">
              <Trash2 />
            </button>
          )}
        </div>
      </div>

      {template.purpose && (
        <div className="template-purpose">{template.purpose}</div>
      )}

      <div className="template-meta-row">
        <span className={`badge badge-${template.category}`}>
          {CATEGORY_LABELS[template.category]}
        </span>
        <span className="text-xs text-muted">
          ~{template.estimatedMinutes}min
        </span>
        {template.pomodoroEnabled && (
          <span className="text-xs text-muted">
            {template.breakLength}min break
          </span>
        )}
      </div>

      {expanded && template.subtasks.length > 0 && (
        <ul className="template-subtask-list">
          {template.subtasks.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function RecurringTemplates() {
  const [templates, setTemplates] = useState<Template[]>(getTemplates)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function persist(updated: Template[]) {
    setTemplates(updated)
    saveTemplates(updated)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function addTemplate(data: Omit<Template, 'id' | 'createdAt' | 'isDefault'>) {
    persist([
      ...templates,
      { ...data, id: crypto.randomUUID(), isDefault: false, createdAt: new Date().toISOString() },
    ])
    setShowForm(false)
  }

  function updateTemplate(id: string, data: Omit<Template, 'id' | 'createdAt' | 'isDefault'>) {
    persist(templates.map(t => (t.id === id ? { ...t, ...data } : t)))
    setEditingId(null)
  }

  function duplicateTemplate(t: Template) {
    persist([
      ...templates,
      {
        ...t,
        id: crypto.randomUUID(),
        name: `${t.name} (copy)`,
        isDefault: false,
        createdAt: new Date().toISOString(),
      },
    ])
    showToast(`"${t.name}" duplicated`)
  }

  function deleteTemplate(id: string) {
    if (confirm('Delete this template?')) {
      persist(templates.filter(t => t.id !== id))
    }
  }

  function addToPlan(template: Template) {
    const tasks = loadTasks()
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: template.name,
      category: template.category,
      estimatedMinutes: template.estimatedMinutes,
      difficulty: 'medium',
      urgency: 'medium',
      importance: 'high',
      nextAction: template.subtasks[0] ?? '',
      checklist: template.subtasks,
      pomodoroEnabled: template.pomodoroEnabled,
      pomodoroLength: template.pomodoroLength,
      breakLength: template.breakLength,
      pomodoroSessions: 1,
      done: false,
      createdAt: new Date().toISOString(),
    }
    saveTasks([newTask, ...tasks])
    showToast(`"${template.name}" added to Tasks`)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h2 className="page-title">Recurring Templates</h2>
            <p className="page-subtitle">
              Daily building blocks — one click to add to today's plan.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setShowForm(!showForm); setEditingId(null) }}
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
      </div>

      {toast && (
        <div className="template-toast">
          <Check size={13} />
          {toast}
        </div>
      )}

      {showForm && !editingId && (
        <TemplateForm onSave={addTemplate} onCancel={() => setShowForm(false)} />
      )}

      <div className="template-list">
        {templates.map(t =>
          editingId === t.id ? (
            <TemplateForm
              key={t.id}
              initial={t}
              onSave={data => updateTemplate(t.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <TemplateCard
              key={t.id}
              template={t}
              isDefault={t.isDefault}
              onAddToday={() => addToPlan(t)}
              onEdit={() => { setEditingId(t.id); setShowForm(false) }}
              onDuplicate={() => duplicateTemplate(t)}
              onDelete={() => deleteTemplate(t.id)}
            />
          ),
        )}
      </div>

      <div className="card mt-2" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-2)' }}>How to use:</strong> Click{' '}
          <strong>Add to plan</strong> to push a template into your Task Inbox — it will appear
          at the top with all settings filled in. The planner schedules up to 3 deep-focus
          Pomodoro blocks per day (1 on low-energy days). Expand ↓ to see subtasks.
        </p>
      </div>
    </div>
  )
}
