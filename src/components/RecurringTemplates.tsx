import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Play, Plus, Search } from 'lucide-react'
import type {
  DailyCheckin,
  FocusBlock,
  RankedCheckinTask,
  RecommendedWindow,
  Task,
  TaskArea,
  TaskEnergy,
  TaskTemplate,
} from '../types'
import {
  loadCheckin,
  loadTaskTemplates,
  loadTasks,
  saveCheckin,
  saveFocusBlock,
  saveTaskTemplates,
  saveTasks,
} from '../storage'
import { getLocalDateKey } from '../focus'
import { categoryFromArea, normalizeTask } from '../focusBlocks'
import {
  DEFAULT_TASK_TEMPLATES,
  TASK_TEMPLATE_GROUPS,
  templatesForCurrentTime,
} from '../taskTemplates'

const ALL = 'all'

function getTaskTemplates(): TaskTemplate[] {
  const saved = loadTaskTemplates()
  if (saved.length === 0) {
    saveTaskTemplates(DEFAULT_TASK_TEMPLATES)
    return DEFAULT_TASK_TEMPLATES
  }
  const defaultIds = new Set(DEFAULT_TASK_TEMPLATES.map(template => template.id))
  const merged = [
    ...DEFAULT_TASK_TEMPLATES,
    ...saved.filter(template => !defaultIds.has(template.id)),
  ]
  if (JSON.stringify(merged) !== JSON.stringify(saved)) saveTaskTemplates(merged)
  return merged
}

function rankedEstimate(minutes: number): RankedCheckinTask['estimatedMinutes'] {
  return minutes
}

function defaultCheckin(date: string): DailyCheckin {
  return {
    date,
    dailyPlanBase: 'english-ai-cyber-growth',
    dayType: 'normal',
    wakeUpTime: '09:00',
    sleepTarget: '22:30',
    energyLevel: 'medium',
    rankedTasks: [],
    morningMainTask: '',
    morningSecondaryTask1: '',
    morningSecondaryTask2: '',
    morningSmallLifeTask: '',
    availableFocusTime: 'English + AI/Cyber Growth Day scaffold',
    fixedCommitments: '',
    planningInstructions: '',
    notes: '',
  }
}

function taskFromTemplate(template: TaskTemplate): Task {
  const now = new Date().toISOString()
  return normalizeTask({
    id: crypto.randomUUID(),
    title: template.title,
    area: template.area,
    energy: template.energy,
    mode: template.mode,
    status: 'Inbox',
    category: categoryFromArea(template.area),
    deadline: '',
    estimatedMinutes: template.estimatedMinutes,
    difficulty: template.energy === 'High' ? 'hard' : template.energy === 'Medium' ? 'medium' : 'easy',
    urgency: 'medium',
    importance: template.outputLevel === 'high' ? 'high' : 'medium',
    nextTinyAction: template.firstTinyAction,
    nextAction: template.firstTinyAction,
    checklist: [
      template.firstTinyAction,
      template.description,
      `Block: ${template.defaultBlockType}`,
    ],
    pomodoroEnabled: template.mode === 'Focus',
    pomodoroLength: template.estimatedMinutes,
    breakLength: template.estimatedMinutes >= 45 ? 10 : 5,
    pomodoroSessions: 1,
    done: false,
    createdAt: now,
    updatedAt: now,
  })
}

function focusBlockFromTemplate(template: TaskTemplate, task: Task): FocusBlock {
  const now = new Date()
  const plannedEnd = new Date(now.getTime() + template.estimatedMinutes * 60 * 1000)
  return {
    id: crypto.randomUUID(),
    date: getLocalDateKey(now),
    startTime: now.toISOString(),
    plannedEndTime: plannedEnd.toISOString(),
    minutes: template.estimatedMinutes,
    taskId: task.id,
    taskTitle: template.title,
    area: template.area,
    mode: template.mode,
    energy: template.energy,
    firstTinyAction: template.firstTinyAction,
    status: 'Doing',
    notes: `Started from template: ${template.defaultBlockType}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

interface TemplateCardProps {
  template: TaskTemplate
  onAddInbox: (template: TaskTemplate) => void
  onAddToday: (template: TaskTemplate) => void
  onStart: (template: TaskTemplate) => void
}

function TemplateCard({ template, onAddInbox, onAddToday, onStart }: TemplateCardProps) {
  return (
    <div className="task-template-card">
      <div className="task-template-top">
        <div>
          <div className="task-template-title">{template.title}</div>
          <p>{template.description}</p>
        </div>
        <span className={`task-template-window window-${template.recommendedWindow}`}>
          {template.recommendedWindow}
        </span>
      </div>
      <div className="task-template-meta">
        <span>{template.area}</span>
        <span>{template.estimatedMinutes} min</span>
        <span>{template.energy}</span>
        <span>{template.outputLevel} output</span>
      </div>
      <div className="task-template-action">{template.firstTinyAction}</div>
      <div className="task-template-tags">
        {template.tags.slice(0, 4).map(tag => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="task-template-buttons">
        <button className="btn btn-secondary" type="button" onClick={() => onAddInbox(template)}>
          <Plus size={13} />
          Add to Task Inbox
        </button>
        <button className="btn btn-primary" type="button" onClick={() => onAddToday(template)}>
          <Check size={13} />
          Add to Today’s to-do
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => onStart(template)}>
          <Play size={13} />
          Start as Focus Block
        </button>
      </div>
    </div>
  )
}

export default function RecurringTemplates() {
  const [templates] = useState<TaskTemplate[]>(getTaskTemplates)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>(ALL)
  const [areaFilter, setAreaFilter] = useState<TaskArea | typeof ALL>(ALL)
  const [energyFilter, setEnergyFilter] = useState<TaskEnergy | typeof ALL>(ALL)
  const [windowFilter, setWindowFilter] = useState<RecommendedWindow | typeof ALL>(ALL)
  const [durationFilter, setDurationFilter] = useState<string>(ALL)
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(TASK_TEMPLATE_GROUPS))
  const [toast, setToast] = useState<string | null>(null)

  const recommended = templatesForCurrentTime()

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  function persistTask(task: Task): Task {
    const tasks = loadTasks()
    saveTasks([task, ...tasks])
    return task
  }

  function addToInbox(template: TaskTemplate): Task {
    const task = persistTask(taskFromTemplate(template))
    showToast(`Added "${template.title}" to Task Inbox.`)
    return task
  }

  function addToToday(template: TaskTemplate): Task {
    const task = addToInbox(template)
    const date = getLocalDateKey()
    const checkin = loadCheckin(date) ?? defaultCheckin(date)
    const rankedTasks = checkin.rankedTasks ?? []
    saveCheckin({
      ...checkin,
      rankedTasks: [
        ...rankedTasks,
        {
          id: crypto.randomUUID(),
          taskId: task.id,
          title: template.title,
          area: template.area,
          estimatedMinutes: rankedEstimate(template.estimatedMinutes),
          orderIndex: rankedTasks.length,
        },
      ],
    })
    showToast(`Added "${template.title}" to Today’s to-do.`)
    return task
  }

  function startTemplate(template: TaskTemplate) {
    const task = addToInbox(template)
    saveFocusBlock(focusBlockFromTemplate(template, task))
    showToast(`Started "${template.title}" as a Focus Block.`)
  }

  function toggleGroup(group: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    return templates.filter(template => {
      if (groupFilter !== ALL && template.group !== groupFilter) return false
      if (areaFilter !== ALL && template.area !== areaFilter) return false
      if (energyFilter !== ALL && template.energy !== energyFilter) return false
      if (windowFilter !== ALL && template.recommendedWindow !== windowFilter) return false
      if (durationFilter === 'short' && template.estimatedMinutes > 15) return false
      if (durationFilter === 'medium' && (template.estimatedMinutes < 16 || template.estimatedMinutes > 45)) return false
      if (durationFilter === 'long' && template.estimatedMinutes < 46) return false
      if (!text) return true
      return [
        template.title,
        template.description,
        template.area,
        template.defaultBlockType,
        ...template.tags,
      ].join(' ').toLowerCase().includes(text)
    })
  }, [areaFilter, durationFilter, energyFilter, groupFilter, query, templates, windowFilter])

  const grouped = TASK_TEMPLATE_GROUPS.map(group => ({
    group,
    templates: filtered.filter(template => template.group === group),
  })).filter(section => section.templates.length > 0)

  const areas = Array.from(new Set(templates.map(template => template.area)))

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h2 className="page-title">Task Templates</h2>
            <p className="page-subtitle">
              Reusable blocks for English output, AI/Cyber learning, project work, quiet review, and resets.
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <div className="template-toast">
          <Check size={13} />
          {toast}
        </div>
      )}

      <section className="task-template-recommended">
        <div className="plan-section-title">Recommended now</div>
        <div className="quick-template-row">
          {recommended.map(template => (
            <button key={template.id} className="quick-template-chip" type="button" onClick={() => addToToday(template)}>
              {template.title}
            </button>
          ))}
        </div>
      </section>

      <section className="task-template-filters">
        <label className="task-template-search">
          <Search size={14} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search templates"
          />
        </label>
        <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
          <option value={ALL}>All groups</option>
          {TASK_TEMPLATE_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
        </select>
        <select value={areaFilter} onChange={event => setAreaFilter(event.target.value as TaskArea | typeof ALL)}>
          <option value={ALL}>All areas</option>
          {areas.map(area => <option key={area} value={area}>{area}</option>)}
        </select>
        <select value={energyFilter} onChange={event => setEnergyFilter(event.target.value as TaskEnergy | typeof ALL)}>
          <option value={ALL}>All energy</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <select value={windowFilter} onChange={event => setWindowFilter(event.target.value as RecommendedWindow | typeof ALL)}>
          <option value={ALL}>Any window</option>
          <option value="daytime">Daytime</option>
          <option value="evening">Evening</option>
          <option value="any">Any</option>
        </select>
        <select value={durationFilter} onChange={event => setDurationFilter(event.target.value)}>
          <option value={ALL}>Any duration</option>
          <option value="short">15 min or less</option>
          <option value="medium">16-45 min</option>
          <option value="long">46+ min</option>
        </select>
      </section>

      <div className="task-template-groups">
        {grouped.map(section => {
          const open = openGroups.has(section.group)
          return (
            <section key={section.group} className="task-template-group">
              <button className="task-template-group-header" type="button" onClick={() => toggleGroup(section.group)}>
                <span>{section.group}</span>
                <small>{section.templates.length} template{section.templates.length === 1 ? '' : 's'}</small>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {open && (
                <div className="task-template-grid">
                  {section.templates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onAddInbox={addToInbox}
                      onAddToday={addToToday}
                      onStart={startTemplate}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
