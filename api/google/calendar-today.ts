/// <reference types="node" />

import crypto from 'node:crypto'
import type { CalendarEvent, IntegrationResult } from '../../src/types.js'

const MELBOURNE_TIMEZONE = 'Australia/Melbourne'
const TOKEN_COOKIE = 'iris_google_calendar_tokens'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const TOKEN_STORAGE_WARNING =
  'Google Calendar tokens are stored in an encrypted HttpOnly cookie for this local/dev-safe version. Production token storage should use a database-backed session store.'

interface VercelRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
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

interface CalendarResponse extends IntegrationResult<CalendarEvent[]> {
  connected: boolean
  calendarConnected?: boolean
  gmailConnected?: boolean
  accountEmail?: string
  warning?: string
  diagnostic?: ReturnType<typeof getDiagnostic>
}

interface GoogleCalendarItem {
  id?: string
  summary?: string
  location?: string
  description?: string
  start?: {
    dateTime?: string
    date?: string
  }
  end?: {
    dateTime?: string
    date?: string
  }
}

function sendJson(res: VercelResponse, body: CalendarResponse, status = 200): void {
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

function getDiagnostic(req: VercelRequest) {
  return {
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasGoogleRedirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
    hasCalendarToken: Boolean(getCookie(req, TOKEN_COOKIE)),
  }
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

function notConnected(req: VercelRequest): CalendarResponse {
  return {
    success: false,
    message: 'Google Calendar is not connected yet',
    data: null,
    connected: false,
    diagnostic: getDiagnostic(req),
  }
}

function hasScope(tokens: GoogleTokens, scope: string): boolean {
  return Boolean(tokens.scope?.split(/\s+/).includes(scope))
}

function scopeStatus(tokens: GoogleTokens) {
  return {
    calendarConnected: hasScope(tokens, CALENDAR_SCOPE),
    gmailConnected: hasScope(tokens, GMAIL_SCOPE),
  }
}

function getRequestUrl(req: VercelRequest): URL {
  const hostHeader = req.headers?.['x-forwarded-host'] ?? req.headers?.host ?? 'localhost'
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const protoHeader = req.headers?.['x-forwarded-proto'] ?? 'https'
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
  return new URL(req.url ?? '/api/google/calendar-today', `${proto}://${host}`)
}

function getMelbourneYmd(referenceDate = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate)
  const year = parts.find(part => part.type === 'year')?.value ?? '1970'
  const month = parts.find(part => part.type === 'month')?.value ?? '01'
  const day = parts.find(part => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function addDaysToYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
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

function calendarDateToIso(value: string): string {
  return `${value}T00:00:00${getMelbourneOffset(value)}`
}

function toCalendarEvent(item: GoogleCalendarItem): CalendarEvent | null {
  const startValue = item.start?.dateTime ?? (item.start?.date ? calendarDateToIso(item.start.date) : null)
  const endValue = item.end?.dateTime ?? (item.end?.date ? calendarDateToIso(item.end.date) : startValue)
  if (!item.id || !startValue || !endValue) return null

  return {
    id: item.id,
    title: item.summary || 'Untitled calendar event',
    start: startValue,
    end: endValue,
    location: item.location,
    description: item.description,
    source: 'google_calendar',
  }
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
    if (req.method !== 'GET') {
      sendJson(res, {
        success: false,
        message: 'Method not allowed',
        data: null,
        connected: false,
        diagnostic: getDiagnostic(req),
      }, 405)
      return
    }

    const config = requiredGoogleConfig()
    if (!config) {
      sendJson(res, {
        success: false,
        message:
          'Google Calendar OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
        data: null,
        connected: false,
        diagnostic: getDiagnostic(req),
      })
      return
    }

    const tokens = await getUsableTokens(req, res, config)
    if (!tokens) {
      sendJson(res, notConnected(req))
      return
    }

    const url = getRequestUrl(req)
    if (url.searchParams.get('status') === '1') {
      const scopes = scopeStatus(tokens)
      sendJson(res, {
        success: true,
        message: scopes.gmailConnected
          ? 'Google Calendar and Gmail connected'
          : 'Google Calendar connected. Gmail read-only access needs reconnect.',
        data: [],
        connected: true,
        ...scopes,
        accountEmail: tokens.account_email,
        warning: TOKEN_STORAGE_WARNING,
        diagnostic: getDiagnostic(req),
      })
      return
    }

    const today = getMelbourneYmd()
    const rangeEnd = addDaysToYmd(today, 7)
    const params = new URLSearchParams({
      timeMin: `${today}T00:00:00${getMelbourneOffset(today)}`,
      timeMax: `${rangeEnd}T00:00:00${getMelbourneOffset(rangeEnd)}`,
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: MELBOURNE_TIMEZONE,
      fields: 'items(id,summary,start,end,location,description)',
    })

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      },
    )

    if (!calendarResponse.ok) {
      const scopes = scopeStatus(tokens)
      sendJson(res, {
        success: false,
        message: `Google Calendar returned ${calendarResponse.status}`,
        data: null,
        connected: true,
        ...scopes,
        accountEmail: tokens.account_email,
        warning: TOKEN_STORAGE_WARNING,
        diagnostic: getDiagnostic(req),
      }, calendarResponse.status)
      return
    }

    const payload = (await calendarResponse.json()) as { items?: GoogleCalendarItem[] }
    const events = (payload.items ?? [])
      .map(toCalendarEvent)
      .filter((event): event is CalendarEvent => event !== null)

    const scopes = scopeStatus(tokens)
    sendJson(res, {
      success: true,
      message: events.length > 0 ? `Imported ${events.length} calendar event(s) for the next 7 days` : 'No calendar events in the next 7 days',
      data: events,
      connected: true,
      ...scopes,
      accountEmail: tokens.account_email,
      warning: TOKEN_STORAGE_WARNING,
      diagnostic: getDiagnostic(req),
    })
  } catch {
    sendJson(res, {
      success: false,
      message: 'Google Calendar route failed before completing the request',
      data: null,
      connected: false,
      diagnostic: getDiagnostic(req),
    })
  }
}
