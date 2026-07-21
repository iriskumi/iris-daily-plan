import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleDot,
  Clock3,
  Copy,
  ExternalLink,
  Footprints,
  Headphones,
  Leaf,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { getLocalDateKey } from '../focus'
import {
  calculateCurrentDayNumber,
  calculateDaysRemaining,
  determineCurrentPhase,
  IRIS_365_SCHEMA_VERSION,
  IRIS_365_START_DATE,
  iris365ProgressPercent,
  loadIris365Entry,
  loadIris365Store,
  saveIris365Entry,
  updateIris365StartDate,
} from '../iris365Storage'
import { getIris365DailyAnchorSync } from '../iris365Sync'
import { pushIris365LogToNotion } from '../services/notionService'
import type {
  Iris365Entry,
  Iris365MorningFeeling,
  Iris365MorningGateStatus,
  Iris365SwitchLog,
} from '../iris365Types'

const MORNING_CHECKS: Array<{
  key: keyof Iris365Entry['morningGateChecklist']
  label: string
}> = [
  { key: 'water', label: '喝水' },
  { key: 'light', label: '拉开窗帘 / 接触自然光' },
  { key: 'leaveBed', label: '洗脸或离开床' },
  { key: 'englishAudio', label: '打开英语音频' },
  { key: 'gentleMovement', label: '轻微活动 1–3 分钟' },
]

const MORNING_STATUS_OPTIONS: Array<{ value: Iris365MorningGateStatus; label: string }> = [
  { value: 'protected', label: '守住了前 30 分钟' },
  { value: 'switched', label: '有冲动，但换到了别的内容' },
  { value: 'delayed', label: '延迟了一会儿' },
  { value: 'interrupted', label: '打开了旧内容，但后来关掉了' },
  { value: 'carried-away', label: '今天被带进去了，明天重新保护入口' },
  { value: 'unrecorded', label: '还没记录' },
]

const MORNING_FEELINGS: Array<{ value: Iris365MorningFeeling; label: string }> = [
  { value: '', label: '不记录' },
  { value: 'foggy', label: '迷糊' },
  { value: 'bored', label: '无聊' },
  { value: 'anxious', label: '焦虑' },
  { value: 'stay-in-bed', label: '不想起床' },
  { value: 'avoid-day', label: '不想面对今天' },
  { value: 'automatic-reach', label: '习惯性伸手' },
  { value: 'other', label: '其他' },
]

const TRIGGER_OPTIONS = [
  '刚醒来',
  '吃饭',
  '睡前',
  '无聊',
  '焦虑 / 情绪低',
  '不想做正事',
  'DDL / 压力',
  '书荒 / 没有替代内容',
  '其他',
]

const IMPULSE_OPTIONS = [
  'YouTube 中文短剧',
  'AI 短剧',
  '中文网文',
  '小红书 / 社交媒体',
  '购物 / 查价格',
  '手游',
  '随手乱刷',
  '其他',
]

const SWITCH_ACTIONS = [
  '先延迟了',
  '换到英语内容',
  '起身离开屏幕',
  '开始后又中断了',
  '做了一件小事再决定',
  '只是看见了这个冲动',
]

const ENGLISH_TYPES = ['英语音频', '剧集 / 电影', 'Audiobook', 'Podcast', '英文阅读', '其他英语内容']
const MOVEMENT_TYPES = [
  '散步',
  '快走',
  '慢跑',
  '拉伸',
  '视频跟练',
  '力量训练',
  'Hip-hop',
  'K-pop',
  '家务',
  '其他活动',
]

interface SwitchDraft {
  trigger: string
  oldImpulse: string
  switchAction: string
  replacement: string
  note: string
}

const EMPTY_SWITCH_DRAFT: SwitchDraft = {
  trigger: '',
  oldImpulse: '',
  switchAction: '',
  replacement: '',
  note: '',
}

function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

function formatDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatShortDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
}

function formatTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function isGentleReturn(status: Iris365MorningGateStatus): boolean {
  return ['protected', 'switched', 'delayed', 'interrupted'].includes(status)
}

function hasEnglishEnvironment(entry: Iris365Entry, auto = false): boolean {
  return Boolean(entry.englishEnvironmentItems?.length || entry.englishEnvironmentType || entry.englishOutput || auto)
}

function hasMovement(entry: Iris365Entry, auto = false): boolean {
  return Boolean(entry.movementItems?.length || entry.movementMinutes > 0 || entry.bodyMoved || auto)
}

function hasSwitch(entry: Iris365Entry): boolean {
  return entry.switchLogs.length > 0 || isGentleReturn(entry.morningGateStatus)
}

function getWeekDates(today: string): string[] {
  const current = parseLocalDate(today)
  current.setDate(current.getDate() - current.getDay())
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(current)
    date.setDate(current.getDate() + index)
    return getLocalDateKey(date)
  })
}

function dateAtOffset(startDate: string, offset: number): string {
  const date = parseLocalDate(startDate)
  date.setDate(date.getDate() + offset)
  return getLocalDateKey(date)
}

function getMonthDates(date: string): string[] {
  const cursor = parseLocalDate(date)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, index) => getLocalDateKey(new Date(year, month, index + 1)))
}

function evidenceCount(entry?: Iris365Entry): number {
  if (!entry) return 0
  return [hasEnglishEnvironment(entry), hasSwitch(entry), hasMovement(entry)].filter(Boolean).length
}

export default function Iris365() {
  const today = getLocalDateKey()
  const [store, setStore] = useState(() => loadIris365Store())
  const [entry, setEntry] = useState<Iris365Entry>(() => loadIris365Entry(today, store))
  const [switchDraft, setSwitchDraft] = useState<SwitchDraft>(EMPTY_SWITCH_DRAFT)
  const [englishDraft, setEnglishDraft] = useState({ type: '', title: '' })
  const [movementDraft, setMovementDraft] = useState({ minutes: 0, kind: '' })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [startDateDraft, setStartDateDraft] = useState(store.settings.startDate || IRIS_365_START_DATE)
  const [saveMessage, setSaveMessage] = useState(store.entries[today] ? `已保存 ${formatTime(store.entries[today].updatedAt)}` : '选择后自动保存')
  const [copied, setCopied] = useState(false)
  const [pushingNotion, setPushingNotion] = useState(false)
  const [notionStatus, setNotionStatus] = useState('')
  const [notionUrl, setNotionUrl] = useState('')
  const [selectedVisualDate, setSelectedVisualDate] = useState(today)

  useEffect(() => {
    if (store.schemaVersion >= IRIS_365_SCHEMA_VERSION) return
    const migratedStore = loadIris365Store()
    setStore(migratedStore)
    setEntry(loadIris365Entry(today, migratedStore))
    setStartDateDraft(migratedStore.settings.startDate)
  }, [store.schemaVersion, today])

  const startDate = store.settings.startDate || IRIS_365_START_DATE
  const dayNumber = calculateCurrentDayNumber(startDate, today)
  const daysRemaining = calculateDaysRemaining(startDate, today)
  const progress = iris365ProgressPercent(dayNumber)
  const phase = determineCurrentPhase(Math.max(1, dayNumber))
  const anchorSync = getIris365DailyAnchorSync(today)
  const englishDone = hasEnglishEnvironment(entry, anchorSync.englishOutputAuto)
  const movementDone = hasMovement(entry, anchorSync.bodyMovedAuto)
  const switchDone = hasSwitch(entry)
  const foundationCount = [englishDone, switchDone, movementDone].filter(Boolean).length
  const englishEnvironmentItems = entry.englishEnvironmentItems ?? []
  const movementItems = entry.movementItems ?? []
  const movementMinutes = movementItems.reduce((total, item) => total + item.minutes, 0)
  const displayedMovementMinutes = movementMinutes || anchorSync.bodyMovedMinutes || entry.movementMinutes || 0
  const morningStatusLabel = MORNING_STATUS_OPTIONS.find(option => option.value === entry.morningGateStatus)?.label ?? '还没记录'
  const morningFeelingLabel = MORNING_FEELINGS.find(option => option.value === entry.morningFeeling)?.label ?? '未记录'
  const morningChecklistLabels = MORNING_CHECKS.filter(item => entry.morningGateChecklist[item.key]).map(item => item.label)
  const englishEnvironmentLabel = englishDone
    ? englishEnvironmentItems.length > 0
      ? englishEnvironmentItems.map(item => [item.type, item.title].filter(Boolean).join(' · ')).join('；')
      : [entry.englishEnvironmentType || (anchorSync.englishOutputAuto ? 'Study 英语输出' : '英语环境'), entry.englishEnvironmentTitle].filter(Boolean).join(' · ')
    : '还没有记录'
  const movementLabel = movementDone
    ? movementItems.length > 0
      ? movementItems.map(item => `${item.kind} · ${item.minutes} min`).join('；')
      : [entry.movementKind, `${displayedMovementMinutes || 1} min`].filter(Boolean).join(' · ')
    : '还没有记录'
  const switchSummary = entry.switchLogs.map(log => [
    `${log.trigger} · ${log.oldImpulse}`,
    log.switchAction,
    log.replacement ? `→ ${log.replacement}` : '',
    log.note,
  ].filter(Boolean).join(' · '))
  const iris365Markdown = [
    `# Iris 365 · ${today}`,
    '',
    `Day ${dayNumber} / 365 · ${progress}% · ${phase.englishLabel} / ${phase.title}`,
    `Today’s foundation: ${foundationCount} / 3`,
    '',
    '## Morning Gate',
    morningStatusLabel,
    `刚醒来的感觉：${morningFeelingLabel}`,
    ...(morningChecklistLabels.length ? morningChecklistLabels.map(item => `- ${item}`) : ['- 还没有记录可选动作']),
    '',
    '## Switch Log',
    ...(switchSummary.length ? switchSummary.map(item => `- ${item}`) : ['- 还没有记录']),
    '',
    '## English Environment',
    englishEnvironmentLabel,
    '',
    '## Movement',
    movementLabel,
    '',
    '## Note for Tomorrow',
    entry.foundationNote || '今天做一点也算。',
    '',
    '> 先延迟，再换轨，最后决定。',
  ].join('\n')
  const yearDates = useMemo(() => Array.from({ length: 365 }, (_, index) => dateAtOffset(startDate, index)), [startDate])
  const monthDates = useMemo(() => getMonthDates(today), [today])
  const selectedVisualEntry = store.entries[selectedVisualDate]
  const selectedVisualCount = evidenceCount(selectedVisualEntry)

  const recentEntries = useMemo(() => Object.values(store.entries)
    .filter(item => item.date >= startDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7), [store.entries, startDate])

  const weeklyOverview = useMemo(() => {
    const dates = getWeekDates(today)
    const entries = dates.map(date => store.entries[date]).filter((item): item is Iris365Entry => Boolean(item))
    return {
      dates,
      entries,
      english: entries.filter(item => hasEnglishEnvironment(item)).length,
      switches: entries.filter(hasSwitch).length,
      movement: entries.filter(item => hasMovement(item)).length,
      morning: entries.filter(item => item.morningGateStatus !== 'unrecorded').length,
    }
  }, [store.entries, today])

  function updateEntry(patch: Partial<Iris365Entry>) {
    if (dayNumber === 0) return
    const next: Iris365Entry = {
      ...entry,
      ...patch,
      date: today,
      dayNumber,
      updatedAt: new Date().toISOString(),
    }
    try {
      const nextStore = saveIris365Entry(next, store)
      setEntry(nextStore.entries[today])
      setStore(nextStore)
      setSaveMessage(`已保存 ${formatTime(next.updatedAt)}`)
    } catch {
      setSaveMessage('保存没有成功，请再试一次')
    }
  }

  function addSwitchLog() {
    if (!switchDraft.trigger || !switchDraft.oldImpulse || !switchDraft.switchAction) return
    const log: Iris365SwitchLog = {
      id: `switch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...switchDraft,
      createdAt: new Date().toISOString(),
    }
    updateEntry({ switchLogs: [log, ...entry.switchLogs] })
    setSwitchDraft(EMPTY_SWITCH_DRAFT)
  }

  function deleteSwitchLog(id: string) {
    updateEntry({ switchLogs: entry.switchLogs.filter(log => log.id !== id) })
  }

  function addEnglishEnvironmentItem() {
    if (!englishDraft.type) return
    const item = {
      id: `english-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: englishDraft.type,
      title: englishDraft.title.trim(),
      createdAt: new Date().toISOString(),
    }
    updateEntry({
      englishEnvironmentItems: [...englishEnvironmentItems, item],
      englishEnvironmentType: item.type,
      englishEnvironmentTitle: item.title,
      englishOutput: true,
    })
    setEnglishDraft({ type: '', title: '' })
  }

  function deleteEnglishEnvironmentItem(id: string) {
    const remaining = englishEnvironmentItems.filter(item => item.id !== id)
    const latest = remaining[remaining.length - 1]
    updateEntry({
      englishEnvironmentItems: remaining,
      englishEnvironmentType: latest?.type ?? '',
      englishEnvironmentTitle: latest?.title ?? '',
      englishOutput: remaining.length > 0,
    })
  }

  function addMovementItem() {
    if (!movementDraft.minutes || !movementDraft.kind) return
    const item = {
      id: `movement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      minutes: movementDraft.minutes,
      kind: movementDraft.kind,
      createdAt: new Date().toISOString(),
    }
    const items = [...movementItems, item]
    updateEntry({
      movementItems: items,
      movementMinutes: items.reduce((total, movementItem) => total + movementItem.minutes, 0),
      movementKind: item.kind,
      bodyMoved: true,
      movement: true,
    })
    setMovementDraft({ minutes: 0, kind: '' })
  }

  function deleteMovementItem(id: string) {
    const remaining = movementItems.filter(item => item.id !== id)
    const latest = remaining[remaining.length - 1]
    updateEntry({
      movementItems: remaining,
      movementMinutes: remaining.reduce((total, item) => total + item.minutes, 0),
      movementKind: latest?.kind ?? '',
      bodyMoved: remaining.length > 0,
      movement: remaining.length > 0,
    })
  }

  function changeStartDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateDraft)) return
    const confirmed = window.confirm(`确定把 ${startDateDraft} 设为新的 Day 1 吗？旧记录会保留，但计划天数会重新计算。`)
    if (!confirmed) return
    const nextStore = updateIris365StartDate(startDateDraft, store)
    setStore(nextStore)
    setSettingsOpen(false)
  }

  async function copyTodaySummary() {
    try {
      await navigator.clipboard.writeText(iris365Markdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setNotionStatus('复制没有成功，请再试一次。')
    }
  }

  async function pushTodayToNotion() {
    if (pushingNotion) return
    setPushingNotion(true)
    setNotionStatus('正在推送到 Notion…')
    setNotionUrl('')
    const result = await pushIris365LogToNotion({
      date: today,
      dayNumber,
      progressPercent: progress,
      phaseEnglish: phase.englishLabel ?? phase.title,
      phaseChinese: phase.title,
      morningGate: morningStatusLabel,
      morningFeeling: morningFeelingLabel,
      morningChecklist: morningChecklistLabels,
      englishEnvironment: englishEnvironmentLabel,
      switchSummary,
      movement: movementLabel,
      foundationCount,
      foundationNote: entry.foundationNote,
      markdown: iris365Markdown,
    })
    setPushingNotion(false)
    setNotionStatus(result.message)
    setNotionUrl(result.data?.pageUrl ?? '')
  }

  return (
    <div className="page iris365-page iris365-foundation-page">
      <header className="iris365-new-header">
        <div>
          <span className="section-label">小小的日常证据</span>
          <h2 className="page-title">Iris 365</h2>
          <p>用一年时间建立更安静的默认系统：英语环境、每天动一下、逐渐退出中文高刺激循环。</p>
          <strong>不是追求完美，也不是证明自律。只是在每天能做到的时候，轻轻换一次轨。</strong>
          <small>A calmer default, built one day at a time.</small>
        </div>
        <button
          type="button"
          className="iris365-settings-button"
          aria-label="调整计划开始日期"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(value => !value)}
        >
          <Settings2 size={16} />
        </button>
      </header>

      {settingsOpen && (
        <section className="iris365-settings-panel" aria-label="计划设置">
          <div>
            <strong>调整开始日期</strong>
            <small>旧记录不会删除。新的日期会成为 Day 1。</small>
          </div>
          <input type="date" value={startDateDraft} onChange={event => setStartDateDraft(event.target.value)} />
          <button type="button" className="btn btn-secondary" onClick={changeStartDate}>
            <RotateCcw size={15} /> 重新开始计划
          </button>
        </section>
      )}

      <section className="iris365-programme-overview">
        <div className="iris365-programme-day">
          <span>{dayNumber === 0 ? '计划还未开始' : dayNumber >= 365 ? '这一年已经走完' : '正在慢慢成为日常'}</span>
          <strong>Day {dayNumber} <small>/ 365</small></strong>
          <p>{formatDate(today)}</p>
        </div>
        <div className="iris365-phase-copy">
          <span>Phase {phase.id} · {phase.englishLabel}</span>
          <h3>{phase.englishLabel}</h3>
          <p><strong>{phase.title}</strong> · {phase.focus}</p>
        </div>
        <div className="iris365-time-progress">
          <div>
            <span>{daysRemaining} 天后</span>
            <span>{progress}%</span>
          </div>
          <div className="iris365-progress-bar" role="progressbar" aria-label="计划时间进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>进度只代表时间经过，不代表完美完成。</small>
        </div>
      </section>

      <section className="iris365-year-visual">
        <div className="iris365-section-heading">
          <div>
            <span className="section-label">Year Field</span>
            <h3>A Year Becoming Ordinary</h3>
            <p className="iris365-heading-cn">一年不是用来保持完美，而是让新的默认慢慢变得普通。</p>
          </div>
          <CalendarDays size={20} />
        </div>

        <div className="iris365-year-legend" aria-label="全年轨迹图例">
          <span><i className="elapsed" /> 时间走过</span>
          <span><i className="evidence" /> 留下一点证据</span>
          <span><i className="today" /> 今天</span>
          <span><i className="future" /> 还没到来</span>
        </div>

        <div className="iris365-year-scroll">
          <div className="iris365-phase-bands" aria-hidden="true">
            <span>Reset · 30d</span>
            <span>Rhythm · 60d</span>
            <span>Ordinary · 90d</span>
            <span>Live Inside It · 185d</span>
          </div>
          <div className="iris365-year-grid" role="grid" aria-label="365 天全年轨迹">
            {yearDates.map(date => {
              const count = evidenceCount(store.entries[date])
              const state = date === today ? 'today' : date > today ? 'future' : count > 0 ? 'evidence' : 'elapsed'
              return (
                <button
                  key={date}
                  type="button"
                  className={`${state} ${selectedVisualDate === date ? 'selected' : ''}`}
                  aria-label={`${formatShortDate(date)}${count ? `，留下 ${count} 项基础证据` : '，没有记录'}`}
                  title={`${formatShortDate(date)} · ${count ? '有一点基础证据' : date > today ? '还没到来' : '时间已经走过'}`}
                  onClick={() => setSelectedVisualDate(date)}
                >
                  {count > 0 && <i />}
                </button>
              )
            })}
          </div>
        </div>
        <p className="iris365-year-reassurance">时间会继续向前。空白不是断掉，只是那一天没有留下记录。</p>

        <div className="iris365-month-focus">
          <div className="iris365-month-heading">
            <div>
              <span className="section-label">This Month</span>
              <h4>{parseLocalDate(today).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h4>
            </div>
            <small>点击日期查看当天留下的内容</small>
          </div>
          <div className="iris365-month-grid">
            {monthDates.map((date, index) => {
              const count = evidenceCount(store.entries[date])
              const outsideProgramme = date < startDate || date > yearDates[yearDates.length - 1]
              const state = outsideProgramme ? 'outside' : date === today ? 'today' : date > today ? 'future' : count > 0 ? 'evidence' : 'elapsed'
              return (
                <button
                  key={date}
                  type="button"
                  className={`${state} ${selectedVisualDate === date ? 'selected' : ''}`}
                  style={index === 0 ? { gridColumnStart: parseLocalDate(date).getDay() + 1 } : undefined}
                  onClick={() => setSelectedVisualDate(date)}
                  aria-label={`${formatShortDate(date)}${count ? `，${count} 项基础证据` : ''}`}
                >
                  <span>{parseLocalDate(date).getDate()}</span>
                  {count > 0 && <i />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="iris365-selected-day" aria-live="polite">
          <div>
            <span>{formatShortDate(selectedVisualDate)}</span>
            <strong>{selectedVisualCount > 0 ? '这一天留下了一点基础证据' : selectedVisualDate > today ? '这一天还没有到来' : '这一天没有留下记录'}</strong>
            <small>{selectedVisualEntry?.foundationNote || (selectedVisualCount > 0 ? '做一点也算，系统仍在运转。' : '它仍然属于这一年，不需要补回来。')}</small>
          </div>
          <div className="iris365-selected-marks">
            <span className={selectedVisualEntry && hasEnglishEnvironment(selectedVisualEntry) ? 'done' : ''}>English</span>
            <span className={selectedVisualEntry && hasSwitch(selectedVisualEntry) ? 'done' : ''}>Switch</span>
            <span className={selectedVisualEntry && hasMovement(selectedVisualEntry) ? 'done' : ''}>Move</span>
          </div>
        </div>
      </section>

      <section className="iris365-gentle-guidance">
        <div className="iris365-section-heading">
          <div>
            <span className="section-label">Today</span>
            <h3>Protect Three Foundations Today</h3>
            <p className="iris365-heading-cn">今天只需要保护三个基础</p>
          </div>
          <Leaf size={20} />
        </div>
        <div className="iris365-guidance-grid">
          <article><Headphones size={18} /><div><strong>英语环境</strong><p>娱乐和输入优先进入英语世界。</p></div></article>
          <article><ArrowRight size={18} /><div><strong>换轨练习</strong><p>冲动出现时，先延迟，再打开另一个入口。</p></div></article>
          <article><Footprints size={18} /><div><strong>每天动一下</strong><p>再短也算。Movement, not performance.</p></div></article>
        </div>
        <div className="iris365-gentle-note">
          <strong>今天不需要三项全满。完成一项，系统就在运转。</strong>
          <span>刚醒来的冲动是旧习惯的自动弹窗，不是最终决定。</span>
        </div>
      </section>

      {dayNumber === 0 && (
        <div className="iris365-before-start">
          <CalendarDays size={18} />
          <span>计划将在 {formatDate(startDate)} 开始。今天可以先熟悉页面，不需要记录。</span>
        </div>
      )}

      <section className="iris365-foundation-section iris365-morning-gate">
        <div className="iris365-section-heading">
          <div>
            <span className="section-label">Morning Gate</span>
            <h3>Protect the First 30 Minutes</h3>
            <p className="iris365-heading-cn">起床后的前 30 分钟</p>
          </div>
          <Clock3 size={20} />
        </div>
        <p className="iris365-section-rule">起床后的前 30 分钟，不打开 YouTube 首页、Shorts、中文短剧或网文。不是永远不能看，只是先让大脑开机。</p>
        <p className="iris365-support-copy">30 分钟后再决定。很多时候，你需要的不是硬忍，而是给另一个内容接住注意力的机会。</p>

        <div className="iris365-checklist" aria-label="起床保护区可选动作">
          {MORNING_CHECKS.map(item => (
            <label key={item.key} className={entry.morningGateChecklist[item.key] ? 'checked' : ''}>
              <input
                type="checkbox"
                checked={entry.morningGateChecklist[item.key]}
                disabled={dayNumber === 0}
                onChange={event => updateEntry({
                  morningGateChecklist: { ...entry.morningGateChecklist, [item.key]: event.target.checked },
                })}
              />
              <Check size={14} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="iris365-field-group">
          <span>今天的 Morning Gate 怎么样？</span>
          <div className="iris365-choice-grid">
            {MORNING_STATUS_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                disabled={dayNumber === 0}
                className={entry.morningGateStatus === option.value ? 'active' : ''}
                onClick={() => updateEntry({ morningGateStatus: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="iris365-compact-select">
          <span>刚醒来最明显的感觉 <small>可选</small></span>
          <select
            value={entry.morningFeeling}
            disabled={dayNumber === 0}
            onChange={event => updateEntry({ morningFeeling: event.target.value as Iris365MorningFeeling })}
          >
            {MORNING_FEELINGS.map(option => <option key={option.value || 'none'} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </section>

      <section className="iris365-foundation-section iris365-switch-log">
        <div className="iris365-section-heading">
          <div>
            <span className="section-label">Switch Log</span>
            <h3>How Did I Switch Tracks Today?</h3>
            <p className="iris365-heading-cn">我今天是怎么换轨的？</p>
          </div>
          <ArrowRight size={20} />
        </div>
        <p className="iris365-support-copy">真正要练的不是永远没有冲动，而是冲动出现后，我仍然能延迟、切换、中断或回来。</p>
        <div className="iris365-switch-form">
          <label><span>冲动出现在哪个节点？</span><select value={switchDraft.trigger} onChange={event => setSwitchDraft({ ...switchDraft, trigger: event.target.value })}><option value="">选择一个节点</option>{TRIGGER_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>原本想打开什么？</span><select value={switchDraft.oldImpulse} onChange={event => setSwitchDraft({ ...switchDraft, oldImpulse: event.target.value })}><option value="">选择旧入口</option>{IMPULSE_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>这次发生了什么？</span><select value={switchDraft.switchAction} onChange={event => setSwitchDraft({ ...switchDraft, switchAction: event.target.value })}><option value="">选择一个动作</option>{SWITCH_ACTIONS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>后来换到了哪里？ <small>可选</small></span><input value={switchDraft.replacement} onChange={event => setSwitchDraft({ ...switchDraft, replacement: event.target.value })} placeholder="英语音频、洗澡、散步、先吃饭…" /></label>
          <label className="iris365-switch-note"><span>留一句话 <small>可选</small></span><input value={switchDraft.note} onChange={event => setSwitchDraft({ ...switchDraft, note: event.target.value })} placeholder="例如：开始刷了十分钟，但我关掉了。" /></label>
          <button type="button" className="btn btn-primary" disabled={dayNumber === 0 || !switchDraft.trigger || !switchDraft.oldImpulse || !switchDraft.switchAction} onClick={addSwitchLog}><Plus size={16} /> 记下这次换轨</button>
        </div>
        {entry.switchLogs.length > 0 && (
          <div className="iris365-switch-list">
            {entry.switchLogs.map(log => (
              <article key={log.id}>
                <div><strong>{log.switchAction}</strong><span>{log.trigger} · {log.oldImpulse}{log.replacement ? ` → ${log.replacement}` : ''}</span>{log.note && <p>{log.note}</p>}</div>
                <button type="button" aria-label="删除这条换轨记录" onClick={() => deleteSwitchLog(log.id)}><X size={15} /></button>
              </article>
            ))}
          </div>
        )}
        <blockquote>先延迟，再换轨，最后决定。<span>Delay first. Switch second. Decide later.</span></blockquote>
      </section>

      <div className="iris365-two-column">
        <section className="iris365-foundation-section iris365-english-environment">
          <div className="iris365-section-heading"><div><span className="section-label">English Environment</span><h3>Choose an English Doorway</h3><p className="iris365-heading-cn">今天把哪个入口换成英语？</p></div><Headphones size={20} /></div>
          <p className="iris365-support-copy">不需要“学习得很好”。只要让今天的一部分娱乐或输入发生在英语里。</p>
          <div className="iris365-soft-options">
            {ENGLISH_TYPES.map(type => {
              const selected = englishDraft.type === type
              return <button key={type} type="button" disabled={dayNumber === 0} className={selected ? 'active' : ''} onClick={() => setEnglishDraft({ ...englishDraft, type: selected ? '' : type })}>{type}</button>
            })}
          </div>
          <div className="iris365-english-add-row">
            <label className="iris365-line-field"><span>今天的内容 <small>可选</small></span><input value={englishDraft.title} disabled={dayNumber === 0} onChange={event => setEnglishDraft({ ...englishDraft, title: event.target.value })} placeholder="剧名、播客、书或频道" /></label>
            <button type="button" className="btn btn-secondary" disabled={dayNumber === 0 || !englishDraft.type} onClick={addEnglishEnvironmentItem}><Plus size={15} /> Add English Entry</button>
          </div>
          {englishEnvironmentItems.length > 0 && (
            <div className="iris365-english-list">
              {englishEnvironmentItems.map(item => (
                <article key={item.id}>
                  <div><strong>{item.type}</strong><span>{item.title || '今天进入了一会儿英语环境'}</span></div>
                  <button type="button" aria-label="删除这条英语环境记录" onClick={() => deleteEnglishEnvironmentItem(item.id)}><X size={14} /></button>
                </article>
              ))}
            </div>
          )}
          {anchorSync.englishOutputAuto && <small className="iris365-auto-note"><Check size={13} /> Study 已记录 {anchorSync.englishOutputReps} 次英语输出</small>}
        </section>

        <section className="iris365-foundation-section iris365-movement">
          <div className="iris365-section-heading"><div><span className="section-label">Movement</span><h3>Move a Little Today</h3><p className="iris365-heading-cn">今天让身体动一下</p></div><Footprints size={20} /></div>
          <p className="iris365-support-copy">一两分钟也算。目标是让“我每天会动一下”变成普通事实。</p>
          <div className="iris365-minute-options">
            {[1, 3, 5, 10, 20, 30].map(minutes => {
              const selected = movementDraft.minutes === minutes
              return <button key={minutes} type="button" disabled={dayNumber === 0} className={selected ? 'active' : ''} onClick={() => setMovementDraft({ ...movementDraft, minutes: selected ? 0 : minutes })}>{minutes} min</button>
            })}
          </div>
          <div className="iris365-soft-options">
            {MOVEMENT_TYPES.map(type => {
              const selected = movementDraft.kind === type
              return <button key={type} type="button" disabled={dayNumber === 0} className={selected ? 'active' : ''} onClick={() => setMovementDraft({ ...movementDraft, kind: selected ? '' : type })}>{type}</button>
            })}
          </div>
          <div className="iris365-movement-add-row">
            <small>{movementItems.length > 0 ? `今天 ${movementItems.length} 条 · 共 ${movementMinutes} 分钟` : '选择时长和活动，再记下这一条。'}</small>
            <button type="button" className="btn btn-secondary" disabled={dayNumber === 0 || !movementDraft.minutes || !movementDraft.kind} onClick={addMovementItem}><Plus size={15} /> 记下这次活动</button>
          </div>
          {movementItems.length > 0 && (
            <div className="iris365-movement-list">
              {movementItems.map(item => (
                <article key={item.id}>
                  <div><strong>{item.kind}</strong><span>{item.minutes} min · {formatTime(item.createdAt)}</span></div>
                  <button type="button" aria-label="删除这条活动记录" onClick={() => deleteMovementItem(item.id)}><X size={14} /></button>
                </article>
              ))}
            </div>
          )}
          {anchorSync.bodyMovedAuto && <small className="iris365-auto-note"><Check size={13} /> Exercise 已记录 {anchorSync.bodyMovedMinutes} 分钟</small>}
        </section>
      </div>

      <section className="iris365-foundation-summary">
        <div className="iris365-section-heading"><div><span className="section-label">Today’s foundation</span><h3>The System Is Still Running</h3><p className="iris365-heading-cn">今天的系统仍在运转</p></div><span className="iris365-foundation-count">{foundationCount} / 3</span></div>
        <div className="iris365-foundation-items">
          <div className={englishDone ? 'done' : ''}>{englishDone ? <Check size={16} /> : <CircleDot size={16} />}<span><strong>英语环境</strong><small>{englishDone ? englishEnvironmentItems.length > 1 ? `今天记录了 ${englishEnvironmentItems.length} 个英语入口` : englishEnvironmentLabel : '还没有也没关系'}</small></span></div>
          <div className={switchDone ? 'done' : ''}>{switchDone ? <Check size={16} /> : <CircleDot size={16} />}<span><strong>换轨练习</strong><small>{switchDone ? '延迟、切换或回来都算' : '看见冲动本身也是开始'}</small></span></div>
          <div className={movementDone ? 'done' : ''}>{movementDone ? <Check size={16} /> : <CircleDot size={16} />}<span><strong>每天动一下</strong><small>{movementDone ? movementItems.length > 1 ? `${movementItems.length} 次活动 · 共 ${movementMinutes} 分钟` : `${displayedMovementMinutes || 1} 分钟也算` : '做一点点就能点亮'}</small></span></div>
        </div>
        <label className="iris365-line-field"><span>今天想留给明天的一句话 <small>可选</small></span><input value={entry.foundationNote} disabled={dayNumber === 0} onChange={event => updateEntry({ foundationNote: event.target.value })} placeholder="不补作业。明天从一个更容易的入口回来。" /></label>
        <div className="iris365-export-row">
          <small className="iris365-save-state">{saveMessage}</small>
          <div>
            <button type="button" className="btn btn-secondary" onClick={() => void copyTodaySummary()}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy Today'}
            </button>
            <button type="button" className="btn btn-primary" disabled={pushingNotion || dayNumber === 0} onClick={() => void pushTodayToNotion()}>
              <UploadCloud size={15} />
              {pushingNotion ? 'Pushing…' : 'Push to Notion'}
            </button>
          </div>
        </div>
        {notionStatus && (
          <div className="iris365-notion-status">
            <span>{notionStatus}</span>
            {notionUrl && <a href={notionUrl} target="_blank" rel="noreferrer">Open in Notion <ExternalLink size={13} /></a>}
          </div>
        )}
      </section>

      <section className="iris365-history-section">
        <div className="iris365-section-heading"><div><span className="section-label">Recent history</span><h3>Recent Foundation Evidence</h3><p className="iris365-heading-cn">最近留下的基础证据</p></div><Sparkles size={18} /></div>
        {recentEntries.length > 0 ? <div className="iris365-history-list">{recentEntries.map(item => {
          const count = [hasEnglishEnvironment(item), hasSwitch(item), hasMovement(item)].filter(Boolean).length
          return <article key={item.date}><div><strong>{formatShortDate(item.date)}</strong><span>{item.foundationNote || item.switchLogs[0]?.note || '系统仍在运转。'}</span></div><div className="iris365-history-marks"><span className={hasEnglishEnvironment(item) ? 'done' : ''}>EN</span><span className={hasSwitch(item) ? 'done' : ''}>换</span><span className={hasMovement(item) ? 'done' : ''}>动</span><small>{count} / 3</small></div></article>
        })}</div> : <p className="iris365-empty-state">从今天的一次换轨、一段英语内容，或一分钟活动开始。</p>}
      </section>

      <section className="iris365-week-overview">
        <div className="iris365-section-heading"><div><span className="section-label">This week</span><h3>This Week, Without Streak Pressure</h3><p className="iris365-heading-cn">这一周，不看连续，只看系统出现过几次</p></div><CalendarDays size={19} /></div>
        <div className="iris365-week-stats"><div><strong>{weeklyOverview.english}</strong><span>英语环境</span></div><div><strong>{weeklyOverview.switches}</strong><span>换轨 / 回来</span></div><div><strong>{weeklyOverview.movement}</strong><span>身体动过</span></div><div><strong>{weeklyOverview.morning}</strong><span>Morning Gate 记录</span></div></div>
        <div className="iris365-week-days">{weeklyOverview.dates.map(date => {
          const item = store.entries[date]
          const count = item ? [hasEnglishEnvironment(item), hasSwitch(item), hasMovement(item)].filter(Boolean).length : 0
          return <div key={date} className={date === today ? 'today' : ''}><span>{parseLocalDate(date).toLocaleDateString('zh-CN', { weekday: 'short' })}</span><i style={{ height: `${Math.max(8, count * 24)}px` }} /><small>{count || '·'}</small></div>
        })}</div>
      </section>

      <details className="iris365-method-card">
        <summary><span><strong>How This System Works</strong><small>这个系统怎么用 · 需要时再打开</small></span><ArrowRight size={17} /></summary>
        <div><p>冲动不是命令。先延迟 30 分钟，再把注意力交给一个更安全的入口，最后才决定要不要继续。</p><p>已经打开旧内容，也仍然可以记录“后来关掉了”。中断循环和回到系统，都是这 365 天真正要练的能力。</p><p>“我不是用 365 天证明自己有多自律，而是给一个新系统足够的时间，让它变成自然。”</p><small>I’m not using 365 days to prove something. I’m giving a new system enough time to become normal.</small></div>
      </details>
    </div>
  )
}

interface Iris365HomeSummaryProps {
  onOpenIris365?: () => void
}

export function Iris365HomeSummary({ onOpenIris365 }: Iris365HomeSummaryProps = {}) {
  const today = getLocalDateKey()
  const store = loadIris365Store()
  const entry = loadIris365Entry(today, store)
  const startDate = store.settings.startDate || IRIS_365_START_DATE
  const dayNumber = calculateCurrentDayNumber(startDate, today)
  const daysRemaining = calculateDaysRemaining(startDate, today)
  const foundationCount = [hasEnglishEnvironment(entry), hasSwitch(entry), hasMovement(entry)].filter(Boolean).length

  return (
    <section className="iris365-home-card iris365-home-foundation-card">
      <div>
        <div className="section-label">A calmer default</div>
        <h3>Iris 365 · Day {dayNumber}</h3>
        <p>先延迟，再换轨，最后决定。今天做一点也算。</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onOpenIris365}>进入今天</button>
      <strong>{foundationCount > 0 ? `今天已有 ${foundationCount} 项基础证据` : '今天不需要三项全满。'}</strong>
      <small>{daysRemaining} 天后 · 时间会继续，系统也可以慢慢长出来。</small>
    </section>
  )
}
