import { BookOpen, CheckCircle2, ChevronDown, Dumbbell, Image as ImageIcon, ListChecks, Mic, Pencil, Play, StickyNote, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  ACTIVE_SESSION_CHANGED_EVENT,
  restoreActiveSession,
  startActiveSession,
  type ActiveSession,
} from '../activeSessionStore'
import {
  DEFAULT_TODAY_HERO_IMAGE,
  compressTodayHeroImage,
  loadAppearanceSettings,
  saveAppearanceSettings,
  type TodayHeroImageSettings,
  type TodayHeroObjectFit,
  type TodayHeroObjectPosition,
} from '../appearanceSettings'
import { loadExerciseLog } from '../exerciseStorage'
import { getLocalDateKey } from '../focus'
import { IRIS365_MOMENTUM_START_DATE } from '../iris365MomentumStorage'
import { loadActiveStudySession, loadStudySessionRecordsForDate, saveActiveStudySession } from '../studyStorage'
import type { StudyActiveSession, StudyCategory, StudySessionRecord } from '../studyTypes'
import { ensureCustomStudyTaskInTaskStore } from '../taskStore'
import * as timerEngine from '../timerEngine'
import type { DayBlock } from '../types'

const STUDY_TIMER_ENGINE_KEY = 'iris-study-timer-engine-active'

type StartKind = 'study' | 'english-output' | 'english-input'
export type TodayStartModule = 'note' | 'done' | 'queue'

interface StartNowDashboardProps {
  onOpenStudy?: () => void
  onOpenExercise?: () => void
  nextBlock?: DayBlock | null
  onStartNextBlock?: () => void
  queueCount?: number
  expandedModule?: TodayStartModule | null
  onExpandedModuleChange?: (module: TodayStartModule | null) => void
  todayNote?: {
    lines: string[]
    caption: string
  }
  eveningNote?: string
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getIris365DayNumber() {
  const start = new Date(`${IRIS365_MOMENTUM_START_DATE}T00:00:00`)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.max(1, Math.min(365, diff + 1))
}

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function labelFromToken(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function startTitle(kind: StartKind) {
  if (kind === 'english-output') return 'English Output Session'
  if (kind === 'english-input') return 'English Input Session'
  return 'Study Session'
}

function startCategory(kind: StartKind): StudyCategory {
  if (kind === 'english-output') return 'English Output'
  if (kind === 'english-input') return 'English Input'
  return 'Review / NotebookLM'
}

function studyDoneSummary(sessions: StudySessionRecord[]) {
  const completed = sessions.filter(session => session.status === 'completed')
  const studyMinutes = completed
    .filter(session => !['English Output', 'English Input', 'Admin / Life'].includes(session.category))
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishOutputMinutes = completed
    .filter(session => session.category === 'English Output')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishInputMinutes = completed
    .filter(session => session.category === 'English Input')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const adminMinutes = completed
    .filter(session => session.category === 'Admin / Life')
    .reduce((sum, session) => sum + session.actualMinutes, 0)
  const englishReps = completed.filter(session => session.category === 'English Output').length

  return { completed, studyMinutes, englishOutputMinutes, englishInputMinutes, adminMinutes, englishReps }
}

export default function StartNowDashboard({
  onOpenStudy,
  onOpenExercise,
  nextBlock,
  onStartNextBlock,
  queueCount = 0,
  expandedModule = null,
  onExpandedModuleChange,
  todayNote,
  eveningNote,
}: StartNowDashboardProps) {
  const today = getLocalDateKey()
  const [message, setMessage] = useState<string | null>(null)
  const [studySessions, setStudySessions] = useState(() => loadStudySessionRecordsForDate(today))
  const [exerciseEntries, setExerciseEntries] = useState(() => loadExerciseLog().entries.filter(entry => entry.date === today))
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => restoreActiveSession())
  const [heroImage, setHeroImage] = useState<TodayHeroImageSettings>(() =>
    loadAppearanceSettings().todayHeroImage ?? DEFAULT_TODAY_HERO_IMAGE,
  )
  const [heroDraft, setHeroDraft] = useState<TodayHeroImageSettings>(() => heroImage)
  const [heroPanelOpen, setHeroPanelOpen] = useState(false)
  const [heroMessage, setHeroMessage] = useState<string | null>(null)
  const [processingHeroImage, setProcessingHeroImage] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const activeStudySession = loadActiveStudySession()
  const irisDay = useMemo(() => getIris365DayNumber(), [])
  const summary = studyDoneSummary(studySessions)
  const movementMinutes = exerciseEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
  const doneItems = [
    ...summary.completed.map(session => ({
      id: session.id,
      time: timeLabel(session.completedAt),
      title: session.title,
      meta: `${session.actualMinutes} min · ${session.category}`,
    })),
    ...exerciseEntries.map(entry => ({
      id: entry.id,
      time: timeLabel(entry.createdAt),
      title: `${entry.movementType} movement`,
      meta: `${entry.durationMinutes} min · Movement`,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time))

  function refreshDone() {
    setStudySessions(loadStudySessionRecordsForDate(today))
    setExerciseEntries(loadExerciseLog().entries.filter(entry => entry.date === today))
  }

  useEffect(() => {
    const refresh = () => setActiveSession(restoreActiveSession())
    const interval = window.setInterval(() => {
      setNow(Date.now())
      refresh()
    }, 30_000)
    window.addEventListener(ACTIVE_SESSION_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(ACTIVE_SESSION_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const refresh = () => setHeroImage(loadAppearanceSettings().todayHeroImage ?? DEFAULT_TODAY_HERO_IMAGE)
    window.addEventListener('iris-appearance-settings-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('iris-appearance-settings-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  function startStudy(kind: StartKind) {
    const existing = loadActiveStudySession()
    if (existing) {
      setMessage(`A Study Session is already active: ${existing.title}. Finish it in Study first.`)
      onOpenStudy?.()
      return
    }
    const start = Date.now()
    const sessionId = makeId('today-study')
    const customTaskId = `today-start:${kind}:${sessionId}`
    const category = startCategory(kind)
    const timerSession = timerEngine.start(`manual-study:${customTaskId}`, 25, 'study', {
      id: sessionId,
      startedAt: new Date(start).toISOString(),
    })
    const session: StudyActiveSession = {
      id: sessionId,
      customTaskId,
      source: 'today-start-panel',
      title: startTitle(kind),
      category,
      sessionStartTime: start,
      durationMinutes: 25,
      expectedEndTime: start + 25 * 60_000,
      pausedAccumulatedMs: 0,
      status: 'running',
      noteDestination: category === 'English Output' || category === 'English Input'
        ? 'Obsidian/Study/English Daily Log.md'
        : 'Obsidian/Study/Daily Study Log.md',
      notes: 'Started from Today Start Panel. 统计只计算完成的 Study Session。',
      resourceUsed: 'Today Start Panel',
      timerSession,
    }
    saveActiveStudySession(session)
    timerEngine.save(STUDY_TIMER_ENGINE_KEY, timerSession)
    startActiveSession({
      id: session.id,
      origin: 'today-start-panel',
      kind,
      category,
      title: session.title,
      startedAt: new Date(start).toISOString(),
      plannedMinutes: 25,
      linkedTaskId: customTaskId,
      targetTab: 'study',
      status: 'active',
    })
    ensureCustomStudyTaskInTaskStore({
      customTaskId,
      title: session.title,
      category,
      durationMinutes: 25,
      noteDestination: session.noteDestination,
      notes: session.notes,
      activeSession: session,
    })
    setMessage(`${session.title} started. Complete it in Study for minutes to count.`)
    onOpenStudy?.()
  }

  function openEnglishStart() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('iris-study-focus-target', 'english')
    }
    onOpenStudy?.()
  }

  function openExerciseLog() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('iris-exercise-focus-target', 'movement-log')
    }
    setMessage('Exercise log opened. Nothing counts until you save a movement.')
    onOpenExercise?.()
  }

  function handleNextUsefulThing() {
    if (activeStudySession) {
      onOpenStudy?.()
      return
    }
    if (nextBlock && onStartNextBlock) {
      onStartNextBlock()
      return
    }
    startStudy('study')
  }

  function toggleModule(module: TodayStartModule) {
    onExpandedModuleChange?.(expandedModule === module ? null : module)
  }

  function openActiveSession() {
    if (activeSession?.targetTab === 'exercise') {
      onOpenExercise?.()
      return
    }
    onOpenStudy?.()
  }

  function openHeroPanel() {
    setHeroDraft(heroImage)
    setHeroMessage(null)
    setHeroPanelOpen(true)
  }

  function saveHeroDraft(nextDraft = heroDraft) {
    const current = loadAppearanceSettings()
    const result = saveAppearanceSettings({
      ...current,
      todayHeroImage: nextDraft,
    })
    if (!result.success) {
      setHeroMessage(result.message)
      return false
    }
    setHeroImage(nextDraft)
    setHeroPanelOpen(false)
    setHeroMessage(null)
    return true
  }

  async function handleHeroUpload(file: File | undefined) {
    if (!file) return
    setProcessingHeroImage(true)
    setHeroMessage(null)
    try {
      const compressed = await compressTodayHeroImage(file)
      setHeroDraft({
        ...heroDraft,
        sourceType: 'upload',
        dataUrl: compressed.dataUrl,
      })
      setHeroMessage(`Image ready (${Math.round(compressed.bytes / 1024)} KB).`)
    } catch (error) {
      setHeroMessage(error instanceof Error ? error.message : 'Image could not be saved.')
    } finally {
      setProcessingHeroImage(false)
    }
  }

  function updateHeroPosition(objectPosition: TodayHeroObjectPosition) {
    setHeroDraft(prev => ({ ...prev, objectPosition }))
  }

  function updateHeroFit(objectFit: TodayHeroObjectFit) {
    setHeroDraft(prev => ({ ...prev, objectFit }))
  }

  function removeHeroImage() {
    setHeroDraft(DEFAULT_TODAY_HERO_IMAGE)
  }

  const activeStartedAt = activeSession ? new Date(activeSession.startedAt).getTime() : Number.NaN
  const activeElapsedMinutes = activeSession && Number.isFinite(activeStartedAt)
    ? Math.max(0, Math.floor((now - activeStartedAt) / 60_000))
    : 0
  const doneCount = summary.completed.length + exerciseEntries.length
  const progressItems = [
    { label: 'Study', value: `${summary.studyMinutes}m` },
    { label: 'English', value: `${summary.englishReps} rep${summary.englishReps === 1 ? '' : 's'}` },
    { label: 'Move', value: `${movementMinutes}m` },
    { label: 'Sessions', value: String(summary.completed.length) },
  ]

  const moduleRows = [
    { id: 'note' as const, icon: <StickyNote size={16} />, label: 'Note', badge: 'today' },
    { id: 'done' as const, icon: <CheckCircle2 size={16} />, label: 'Done', badge: `${doneCount} completed` },
    { id: 'queue' as const, icon: <ListChecks size={16} />, label: 'Queue', badge: `${queueCount} block${queueCount === 1 ? '' : 's'}` },
  ]

  const nextTitle = activeStudySession?.title ?? (nextBlock ? nextBlock.title : 'Start one 25-min Study Session')
  const nextCategory = activeStudySession?.category ?? (nextBlock ? labelFromToken(nextBlock.area) : 'Study')
  const nextDuration = activeStudySession?.durationMinutes ?? (nextBlock ? Math.min(nextBlock.estimatedMinutes, 50) : 25)
  const hasCustomHeroImage = heroImage.sourceType === 'upload' && Boolean(heroImage.dataUrl)

  return (
    <section className="start-now-dashboard today-start-flow" aria-label="Today start flow">
      {activeSession ? (
        <section className="today-active-surface" aria-label="Current session">
          <div className="today-active-copy">
            <span className="today-soft-label">正在进行</span>
            <h2>{activeSession.title}</h2>
            <div className="today-active-meta">
              <span>{activeSession.category}</span>
              <span>{activeElapsedMinutes} min</span>
              {activeSession.status === 'paused' && <span>paused</span>}
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={openActiveSession}>
            <Play size={16} />
            Open session
          </button>
        </section>
      ) : (
        <>
          <section className="today-start-panel">
            <div className={`today-start-photo-panel ${hasCustomHeroImage ? 'has-custom-image' : ''}`}>
              {hasCustomHeroImage ? (
                <img
                  src={heroImage.dataUrl}
                  alt=""
                  style={{
                    objectFit: heroImage.objectFit,
                    objectPosition: heroImage.objectPosition,
                  }}
                />
              ) : (
                <>
                  <span className="today-photo-vase" />
                  <span className="today-photo-candle" />
                  <span className="today-photo-linen" />
                </>
              )}
              <button
                type="button"
                className="today-hero-edit-button"
                aria-label="Change Today hero image"
                onClick={openHeroPanel}
              >
                <Pencil size={14} />
                <span>更换图片</span>
              </button>
            </div>
            <div className="today-start-panel-copy">
              <span className="today-soft-label">Today</span>
              <h2>Start</h2>
              <p>先开始一个小块。</p>
            </div>
            <div className="today-start-actions">
              <button type="button" className="today-start-action-card primary" onClick={() => startStudy('study')}>
                <span className="start-action-card__icon"><BookOpen size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">Study</span>
                  <span className="start-action-card__helper">Start a focus session</span>
                </span>
              </button>
              <button type="button" className="today-start-action-card" onClick={openEnglishStart}>
                <span className="start-action-card__icon"><Mic size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">English</span>
                  <span className="start-action-card__helper">Listening or output</span>
                </span>
              </button>
              <button type="button" className="today-start-action-card" onClick={openExerciseLog}>
                <span className="start-action-card__icon"><Dumbbell size={20} /></span>
                <span className="start-action-card__content">
                  <span className="start-action-card__label">Exercise</span>
                  <span className="start-action-card__helper">Log movement</span>
                </span>
              </button>
            </div>
          </section>

          <div className="today-progress-strip" aria-label="Today progress">
            {progressItems.map(item => (
              <span key={item.label} className="today-progress-pill">
                <strong>{item.label}</strong>
                {item.value}
              </span>
            ))}
            <span className="today-progress-pill muted">Day {irisDay}</span>
          </div>
        </>
      )}

      {!activeSession && (
        <section className="today-next-useful-card">
          <div className="today-next-copy">
            <span className="today-soft-label">Next</span>
            <h3>{nextTitle}</h3>
            <div className="today-next-chips">
              <span>{nextCategory}</span>
              <span>{nextDuration} min</span>
            </div>
          </div>
          <div className="today-next-image-panel" aria-hidden="true">
            <span className="today-next-coffee" />
            <span className="today-next-notebook" />
          </div>
          <button type="button" className="btn btn-primary" onClick={handleNextUsefulThing}>
            <Play size={15} />
            {activeStudySession ? 'Open' : nextCategory.toLowerCase().includes('study') ? 'Start 25-min' : 'Start Study'}
          </button>
        </section>
      )}

      <div className="today-module-row" aria-label="Today modules">
        {moduleRows.map(row => (
          <button
            key={row.id}
            type="button"
            className={`today-module-chip ${expandedModule === row.id ? 'active' : ''}`}
            onClick={() => toggleModule(row.id)}
          >
            {row.icon}
            <span>{row.label}</span>
            <small>{row.badge}</small>
            <ChevronDown size={15} />
          </button>
        ))}
      </div>

      {expandedModule === 'note' && (
        <section className="today-module-panel today-note-module">
          <div className="today-note-lines">
            {(todayNote?.lines?.length ? todayNote.lines : ['不用先规划完整一天。先开始一个小块。']).map(line => (
              <p key={line}>{line}</p>
            ))}
          </div>
          {(todayNote?.caption || eveningNote) && (
            <small>
              {todayNote?.caption}
              {todayNote?.caption && eveningNote ? ' · ' : ''}
              {eveningNote}
            </small>
          )}
        </section>
      )}

      {expandedModule === 'done' && (
        <section className="today-module-panel today-done-card">
          <div className="today-done-header">
            <div>
              <span className="today-soft-label">Done</span>
              <h3>看得见的进展。</h3>
            </div>
            <button type="button" className="btn btn-secondary" onClick={refreshDone}>Refresh</button>
          </div>
          <div className="today-done-grid">
            <div><strong>{summary.studyMinutes}</strong><span>Study min</span></div>
            <div><strong>{summary.englishReps}</strong><span>English reps</span></div>
            <div><strong>{summary.englishOutputMinutes}/{summary.englishInputMinutes}</strong><span>English out/in</span></div>
            <div><strong>{movementMinutes}</strong><span>Move min</span></div>
            <div><strong>{summary.adminMinutes}</strong><span>Admin min</span></div>
          </div>
          <div className="today-done-list">
            {doneItems.length > 0 ? doneItems.slice(0, 8).map(item => (
              <div key={item.id}>
                <span>{item.time}</span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </div>
            )) : (
              <p>完成后才会记录。</p>
            )}
          </div>
        </section>
      )}

      {message && (
        <div className="start-now-message">
          {message}
        </div>
      )}

      {heroPanelOpen && (
        <div className="today-hero-modal-backdrop" role="presentation" onMouseDown={() => setHeroPanelOpen(false)}>
          <section
            className="today-hero-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-hero-modal-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="today-hero-modal-header">
              <div>
                <span className="today-soft-label">Appearance</span>
                <h3 id="today-hero-modal-title">Today hero image</h3>
              </div>
              <button type="button" aria-label="Close image settings" onClick={() => setHeroPanelOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <div className="today-hero-preview">
              {heroDraft.sourceType === 'upload' && heroDraft.dataUrl ? (
                <img
                  src={heroDraft.dataUrl}
                  alt=""
                  style={{
                    objectFit: heroDraft.objectFit,
                    objectPosition: heroDraft.objectPosition,
                  }}
                />
              ) : (
                <div className="today-hero-preview-placeholder">
                  <ImageIcon size={22} />
                  <span>Default soft image</span>
                </div>
              )}
            </div>

            <label className="today-hero-upload">
              <ImageIcon size={16} />
              <span>{processingHeroImage ? 'Processing image...' : 'Upload image'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={processingHeroImage}
                onChange={event => void handleHeroUpload(event.target.files?.[0])}
              />
            </label>

            <div className="today-hero-setting-grid">
              <div>
                <span>Position</span>
                <div className="today-hero-segmented">
                  {(['left', 'center', 'right'] as const).map(position => (
                    <button
                      key={position}
                      type="button"
                      className={heroDraft.objectPosition === position ? 'active' : ''}
                      onClick={() => updateHeroPosition(position)}
                    >
                      {position}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span>Fit</span>
                <div className="today-hero-segmented">
                  {(['cover', 'contain'] as const).map(fit => (
                    <button
                      key={fit}
                      type="button"
                      className={heroDraft.objectFit === fit ? 'active' : ''}
                      onClick={() => updateHeroFit(fit)}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {heroMessage && <p className="today-hero-message">{heroMessage}</p>}

            <div className="today-hero-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={removeHeroImage}>
                <Trash2 size={15} />
                Remove
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setHeroPanelOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => saveHeroDraft()} disabled={processingHeroImage}>
                Save
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
