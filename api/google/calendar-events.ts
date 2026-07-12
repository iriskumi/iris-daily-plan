/// <reference types="node" />

import crypto from 'node:crypto'
import type { CreatedCalendarEvent, IntegrationResult } from '../../src/types.js'

const MELBOURNE_TIMEZONE = 'Australia/Melbourne'
const TOKEN_COOKIE = 'iris_google_calendar_tokens'
const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN_STORAGE_WARNING =
  'Google Calendar tokens are stored in an encrypted HttpOnly cookie for this local/dev-safe version. Production token storage should use a database-backed session store.'

interface VercelRequest {
  method?: string
  headers?: Record<string, string | string[] | undefined>
  body?: string | Record<string, unknown>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string | string[]) => void
}

interface GoogleConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  scope?: string
  token_type?: string
  account_email?: string
}

interface CreateEventBody {
  summary?: string
  date?: string
  startTime?: string
  durationMinutes?: number
  reminderMinutes?: number
  description?: string
  location?: string
  taskId?: string
  allDay?: boolean
}

type CreateEventResponse = IntegrationResult<CreatedCalendarEvent> & {
  connected?: boolean
  calendarWriteConnected?: boolean
  accountEmail?: string
  warning?: string
}

function sendJson(res: VercelResponse, body: CreateEventResponse, status = 200): void {
  res.setHeader('Content-Type', 'application/json')
  res.status(status).json(body)
}

function getCookie(req: VercelRequest, name: string): string | null {
  const rawHeader = req.headers?.cookie
  const raw = Array.isArray(rawHeader) ? rawHeader.join('; ') : rawHeader
  if (!raw) return null
  const cookies = raw.split(';').map(part => part.trim())
  const prefix = `${name}=`
  const match = cookies.find(cookie => cookie.startsWith(prefix))
  return match ? decodeURIComponent(match.slice(prefix.length)) : null
}

function requiredGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return null
  return { clientId, clientSecret, redirectUri }
}

function createCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds?: number; httpOnly?: boolean } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax']
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  if (typeof options.maxAgeSeconds === 'number') parts.push(`Max-Age=${options.maxAgeSeconds}`)
  return parts.join('; ')
}

function getEncryptionKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

function encryptTokens(tokens: GoogleTokens, secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokens), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url')
}

function decryptTokens(value: string, secret: string): GoogleTokens | null {
  try {
    const payload = Buffer.from(value, 'base64url')
    const iv = payload.subarray(0, 12)
    const authTag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return JSON.parse(decrypted) as GoogleTokens
  } catch {
    return null
  }
}

async function refreshAccessToken(
  tokens: GoogleTokens,
  config: { clientId: string; clientSecret: string },
): Promise<GoogleTokens | null> {
  if (!tokens.refresh_token) return null
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const refreshed = (await response.json()) as {
    access_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }
  if (!refreshed.access_token || !refreshed.expires_in) return null
  return {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope ?? tokens.scope,
    token_type: refreshed.token_type ?? tokens.token_type,
  }
}

function hasScope(tokens: GoogleTokens, scope: string): boolean {
  if (!tokens.scope) return false
  return tokens.scope.split(/\s+/).includes(scope)
}

function getMelbourneOffset(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`)
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIMEZONE,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)
  const offset = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT+10'
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return '+10:00'
  const [, sign, hour, minute = '00'] = match
  return `${sign}${hour.padStart(2, '0')}:${minute}`
}

function parseBody(req: VercelRequest): CreateEventBody {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as CreateEventBody
    } catch {
      return {}
    }
  }
  return req.body as CreateEventBody
}

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

async function getUsableTokens(
  req: VercelRequest,
  res: VercelResponse,
  config: { clientId: string; clientSecret: string },
): Promise<GoogleTokens | null> {
  const cookie = getCookie(req, TOKEN_COOKIE)
  if (!cookie) return null
  const tokens = decryptTokens(cookie, config.clientSecret)
  if (!tokens) return null
  if (tokens.expires_at - Date.now() > 60 * 1000) return tokens
  const refreshed = await refreshAccessToken(tokens, config)
  if (!refreshed) return null
  res.setHeader(
    'Set-Cookie',
    createCookie(TOKEN_COOKIE, encryptTokens(refreshed, config.clientSecret), {
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  )
  return refreshed
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      sendJson(res, { success: false, message: 'Method not allowed', data: null, connected: false }, 405)
      return
    }

    const config = requiredGoogleConfig()
    if (!config) {
      sendJson(res, { success: false, message: 'Google Calendar OAuth is not configured.', data: null, connected: false })
      return
    }

    const tokens = await getUsableTokens(req, res, config)
    if (!tokens) {
      sendJson(res, { success: false, message: 'Google Calendar is not connected yet.', data: null, connected: false })
      return
    }

    if (!hasScope(tokens, CALENDAR_EVENTS_SCOPE)) {
      sendJson(res, {
        success: false,
        message: 'Reconnect Google Calendar to allow creating events from tasks.',
        data: null,
        connected: true,
        calendarWriteConnected: false,
        accountEmail: tokens.account_email,
        warning: TOKEN_STORAGE_WARNING,
      }, 403)
      return
    }

    const body = parseBody(req)
    const summary = body.summary?.trim()
    const date = body.date?.trim()
    const durationMinutes = Math.max(1, Math.round(Number(body.durationMinutes) || 25))
    const reminderMinutes = Math.max(0, Math.round(Number(body.reminderMinutes) || 10))

    if (!summary || !date) {
      sendJson(res, {
        success: false,
        message: 'Event title and date are required.',
        data: null,
        connected: true,
        calendarWriteConnected: true,
      }, 400)
      return
    }

    const offset = getMelbourneOffset(date)
    const allDay = Boolean(body.allDay)

    if (!allDay && !body.startTime?.trim()) {
      sendJson(res, {
        success: false,
        message: 'Choose a start time or select all-day.',
        data: null,
        connected: true,
        calendarWriteConnected: true,
      }, 400)
      return
    }

    const startTime = body.startTime?.trim() ?? ''

    const eventPayload: Record<string, unknown> = {
      summary,
      description: body.description?.trim() || undefined,
      location: body.location?.trim() || undefined,
      extendedProperties: body.taskId
        ? { private: { taskId: body.taskId, source: 'iris-daily-plan-hub' } }
        : undefined,
      reminders: {
        useDefault: false,
        overrides: reminderMinutes > 0 ? [{ method: 'popup', minutes: reminderMinutes }] : [],
      },
    }

    if (allDay) {
      eventPayload.start = { date }
      eventPayload.end = { date: addDaysToYmd(date, 1) }
    } else {
      const [hour, minute] = startTime.split(':').map(Number)
      const startIso = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offset}`
      const startDate = new Date(startIso)
      const endDate = new Date(startDate.getTime() + durationMinutes * 60_000)
      const endParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: MELBOURNE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(endDate)
      const endY = endParts.find(p => p.type === 'year')?.value ?? '1970'
      const endM = endParts.find(p => p.type === 'month')?.value ?? '01'
      const endD = endParts.find(p => p.type === 'day')?.value ?? '01'
      const endH = endParts.find(p => p.type === 'hour')?.value ?? '00'
      const endMin = endParts.find(p => p.type === 'minute')?.value ?? '00'
      const endIso = `${endY}-${endM}-${endD}T${endH}:${endMin}:00${getMelbourneOffset(`${endY}-${endM}-${endD}`)}`
      eventPayload.start = { dateTime: startIso, timeZone: MELBOURNE_TIMEZONE }
      eventPayload.end = { dateTime: endIso, timeZone: MELBOURNE_TIMEZONE }
    }

    const createResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      },
    )

    if (!createResponse.ok) {
      sendJson(res, {
        success: false,
        message: `Google Calendar returned ${createResponse.status} while creating the event.`,
        data: null,
        connected: true,
        calendarWriteConnected: true,
        accountEmail: tokens.account_email,
        warning: TOKEN_STORAGE_WARNING,
      }, createResponse.status)
      return
    }

    const created = (await createResponse.json()) as {
      id?: string
      htmlLink?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
    }

    if (!created.id) {
      sendJson(res, {
        success: false,
        message: 'Calendar event was created but no event id was returned.',
        data: null,
        connected: true,
        calendarWriteConnected: true,
      }, 502)
      return
    }

    const start = created.start?.dateTime ?? (created.start?.date ? `${created.start.date}T00:00:00${offset}` : '')
    const end = created.end?.dateTime ?? (created.end?.date ? `${created.end.date}T00:00:00${offset}` : start)

    sendJson(res, {
      success: true,
      message: 'Calendar event created.',
      data: { id: created.id, htmlLink: created.htmlLink, start, end },
      connected: true,
      calendarWriteConnected: true,
      accountEmail: tokens.account_email,
      warning: TOKEN_STORAGE_WARNING,
    })
  } catch {
    sendJson(res, { success: false, message: 'Google Calendar create-event route failed.', data: null, connected: false }, 500)
  }
}
