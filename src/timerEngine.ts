import type { TimerEngineKind, TimerSession } from './timerEngineTypes'

interface VersionedValue<T> {
  schemaVersion: number
  value: T
}

interface StartOptions {
  id?: string
  startedAt?: string
}

const TIMER_ENGINE_SCHEMA_VERSION = 1

function isVersionedValue<T>(value: unknown): value is VersionedValue<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    'value' in value
  )
}

function timestamp(value = Date.now()): string {
  return new Date(value).toISOString()
}

function parseTime(value?: string): number | null {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function activePauseStartedAt(session: TimerSession): number | null {
  const latest = session.pausedIntervals[session.pausedIntervals.length - 1]
  if (!latest || latest.resumedAt) return null
  return parseTime(latest.pausedAt)
}

function pausedMs(session: TimerSession, now = Date.now()): number {
  return session.pausedIntervals.reduce((total, interval) => {
    const pausedAt = parseTime(interval.pausedAt)
    if (pausedAt === null) return total
    const resumedAt = parseTime(interval.resumedAt) ?? now
    return total + Math.max(0, resumedAt - pausedAt)
  }, 0)
}

export function start(
  taskId: string,
  durationMin: number,
  engine: TimerEngineKind,
  options: StartOptions = {},
): TimerSession {
  return {
    id: options.id ?? crypto.randomUUID(),
    taskId,
    engine,
    durationPlannedMin: Math.max(1, Math.round(durationMin)),
    startedAt: options.startedAt ?? timestamp(),
    pausedIntervals: [],
    outcome: 'in-progress',
  }
}

export function pause(session: TimerSession, now = Date.now()): TimerSession {
  if (session.outcome !== 'in-progress' || activePauseStartedAt(session) !== null) return session
  return {
    ...session,
    pausedIntervals: [
      ...session.pausedIntervals,
      { pausedAt: timestamp(now) },
    ],
  }
}

export function resume(session: TimerSession, now = Date.now()): TimerSession {
  if (session.outcome !== 'in-progress' || activePauseStartedAt(session) === null) return session
  return {
    ...session,
    pausedIntervals: session.pausedIntervals.map((interval, index) =>
      index === session.pausedIntervals.length - 1 && !interval.resumedAt
        ? { ...interval, resumedAt: timestamp(now) }
        : interval,
    ),
  }
}

export function complete(session: TimerSession, now = Date.now()): TimerSession {
  const resumed = resume(session, now)
  return {
    ...resumed,
    endedAt: timestamp(now),
    outcome: 'completed',
  }
}

export function abandon(session: TimerSession, now = Date.now()): TimerSession {
  const resumed = resume(session, now)
  return {
    ...resumed,
    endedAt: timestamp(now),
    outcome: 'abandoned',
  }
}

export function elapsedMs(session: TimerSession, now = Date.now()): number {
  const startedAt = parseTime(session.startedAt)
  if (startedAt === null) return 0
  const endedAt = parseTime(session.endedAt)
  const reference = endedAt ?? activePauseStartedAt(session) ?? now
  return Math.max(0, reference - startedAt - pausedMs(session, reference))
}

export function remainingMs(session: TimerSession, now = Date.now()): number {
  if (session.outcome !== 'in-progress') return 0
  const plannedMs = session.durationPlannedMin * 60_000
  return Math.max(0, plannedMs - elapsedMs(session, now))
}

export function expectedEndTime(session: TimerSession, now = Date.now()): number {
  const startedAt = parseTime(session.startedAt) ?? now
  return startedAt + session.durationPlannedMin * 60_000 + pausedMs(session, now)
}

export function isPaused(session: TimerSession): boolean {
  return session.outcome === 'in-progress' && activePauseStartedAt(session) !== null
}

export function isFinished(session: TimerSession, now = Date.now()): boolean {
  return session.outcome === 'in-progress' && remainingMs(session, now) <= 0
}

export function save(storageKey: string, session: TimerSession): void {
  const payload: VersionedValue<TimerSession> = {
    schemaVersion: TIMER_ENGINE_SCHEMA_VERSION,
    value: session,
  }
  localStorage.setItem(storageKey, JSON.stringify(payload))
}

export function restore(storageKey: string): TimerSession | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    const candidate = isVersionedValue<TimerSession>(parsed) ? parsed.value : parsed
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in candidate &&
      'taskId' in candidate &&
      'engine' in candidate &&
      'durationPlannedMin' in candidate &&
      'startedAt' in candidate
    ) {
      return {
        ...(candidate as TimerSession),
        pausedIntervals: (candidate as TimerSession).pausedIntervals ?? [],
        outcome: (candidate as TimerSession).outcome ?? 'in-progress',
      }
    }
    return null
  } catch {
    return null
  }
}

export function clear(storageKey: string): void {
  localStorage.removeItem(storageKey)
}
