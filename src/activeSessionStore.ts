export type ActiveSessionOrigin =
  | 'today-start-panel'
  | 'study'
  | 'english-listening-draw'
  | 'block-queue'
  | 'exercise'

export type ActiveSessionKind = 'study' | 'english-output' | 'english-input' | 'exercise'
export type ActiveSessionTargetTab = 'study' | 'exercise'
export type ActiveSessionStatus = 'active' | 'paused'

export interface ActiveSession {
  id: string
  origin: ActiveSessionOrigin
  kind: ActiveSessionKind
  category: string
  title: string
  startedAt: string
  plannedMinutes?: number
  linkedTaskId?: string
  linkedQueueBlockId?: string
  targetTab: ActiveSessionTargetTab
  status: ActiveSessionStatus
}

export type StartActiveSessionPayload = Omit<ActiveSession, 'id' | 'startedAt' | 'status'> & {
  id?: string
  startedAt?: string
  status?: ActiveSessionStatus
}

const STORAGE_KEY = 'iris-active-session'
export const ACTIVE_SESSION_CHANGED_EVENT = 'iris-active-session-changed'

function notifyActiveSessionChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT))
}

function safeParse(value: string | null): ActiveSession | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ActiveSession>
    if (!parsed.id || !parsed.title || !parsed.startedAt || !parsed.origin || !parsed.kind || !parsed.targetTab) {
      return null
    }
    return {
      id: parsed.id,
      origin: parsed.origin,
      kind: parsed.kind,
      category: parsed.category ?? '',
      title: parsed.title,
      startedAt: parsed.startedAt,
      plannedMinutes: parsed.plannedMinutes,
      linkedTaskId: parsed.linkedTaskId,
      linkedQueueBlockId: parsed.linkedQueueBlockId,
      targetTab: parsed.targetTab,
      status: parsed.status === 'paused' ? 'paused' : 'active',
    }
  } catch {
    return null
  }
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `active-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getActiveSession(): ActiveSession | null {
  if (typeof localStorage === 'undefined') return null
  return safeParse(localStorage.getItem(STORAGE_KEY))
}

export function restoreActiveSession(): ActiveSession | null {
  return getActiveSession()
}

export function startActiveSession(payload: StartActiveSessionPayload): ActiveSession {
  const session: ActiveSession = {
    id: payload.id ?? makeId(),
    origin: payload.origin,
    kind: payload.kind,
    category: payload.category,
    title: payload.title,
    startedAt: payload.startedAt ?? new Date().toISOString(),
    plannedMinutes: payload.plannedMinutes,
    linkedTaskId: payload.linkedTaskId,
    linkedQueueBlockId: payload.linkedQueueBlockId,
    targetTab: payload.targetTab,
    status: payload.status ?? 'active',
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }
  notifyActiveSessionChanged()
  return session
}

export function updateActiveSession(patch: Partial<Omit<ActiveSession, 'id'>>): ActiveSession | null {
  const current = getActiveSession()
  if (!current) return null
  const next = {
    ...current,
    ...patch,
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  notifyActiveSessionChanged()
  return next
}

export function clearActiveSession(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
  notifyActiveSessionChanged()
}
