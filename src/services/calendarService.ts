import type {
  CalendarEvent,
  CreateCalendarEventInput,
  CreatedCalendarEvent,
  GoogleCalendarImportMeta,
  IntegrationResult,
} from '../types'

const notConnected = <T>(): IntegrationResult<T> => ({
  success: false,
  message: 'Integration not connected yet',
  data: null,
})

type CalendarApiResult = IntegrationResult<unknown> & {
  connected?: boolean
  calendarConnected?: boolean
  calendarWriteConnected?: boolean
  gmailConnected?: boolean
  connectionStatus?: GoogleCalendarImportMeta['connectionStatus']
  accountEmail?: string
  warning?: string
}

function deriveConnectionStatus(result: CalendarApiResult): GoogleCalendarImportMeta['connectionStatus'] {
  if (!result.connected) return 'not_connected'
  if (result.calendarWriteConnected) return 'connected'
  if (result.calendarConnected) return 'needs_reconnect'
  return 'unknown'
}

export function connectGoogleCalendar(): void {
  window.location.href = '/api/google/auth'
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarImportMeta> {
  try {
    const response = await fetch('/api/google/calendar-today?status=1')
    const result = (await response.json()) as CalendarApiResult
    const connectionStatus = result.connectionStatus ?? deriveConnectionStatus(result)
    return {
      connected: response.ok && Boolean(result.connected),
      calendarConnected: Boolean(result.calendarConnected),
      calendarWriteConnected: Boolean(result.calendarWriteConnected),
      gmailConnected: Boolean(result.gmailConnected),
      connectionStatus,
      accountEmail: result.accountEmail,
      warning: result.warning,
    }
  } catch {
    return {
      connected: false,
      connectionStatus: 'unknown',
    }
  }
}

export async function testGoogleCalendarConnection(): Promise<GoogleCalendarImportMeta> {
  return getGoogleCalendarStatus()
}

export async function createCalendarEventFromTask(
  input: CreateCalendarEventInput,
): Promise<IntegrationResult<CreatedCalendarEvent>> {
  try {
    const response = await fetch('/api/google/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const result = (await response.json()) as IntegrationResult<CreatedCalendarEvent> & CalendarApiResult
    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        message: result.message || 'Could not create calendar event.',
        data: null,
      }
    }
    return {
      success: true,
      message: result.message,
      data: result.data,
    }
  } catch {
    return {
      success: false,
      message: 'Could not reach Google Calendar.',
      data: null,
    }
  }
}

export async function fetchCalendarEvents(): Promise<IntegrationResult<CalendarEvent[]>> {
  try {
    const response = await fetch('/api/google/calendar-today')
    const result = (await response.json()) as CalendarApiResult & IntegrationResult<CalendarEvent[]>
    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        message: result.message || 'Google Calendar not connected',
        data: null,
      }
    }
    return {
      success: true,
      message: result.message,
      data: result.data,
    }
  } catch {
    return {
      success: false,
      message: 'Google Calendar not connected',
      data: null,
    }
  }
}

export async function importCalendarCommitments(): Promise<IntegrationResult<CalendarEvent[]>> {
  return fetchCalendarEvents()
}

export async function fetchManualCalendarEvents(): Promise<IntegrationResult<CalendarEvent[]>> {
  return notConnected<CalendarEvent[]>()
}

export function calendarStatusLabel(meta: GoogleCalendarImportMeta): string {
  switch (meta.connectionStatus) {
    case 'connected':
      return 'Connected'
    case 'needs_reconnect':
      return 'Needs reconnect'
    case 'not_connected':
      return 'Not connected'
    default:
      return meta.connected ? 'Calendar setup available' : 'Not connected'
  }
}

export function canScheduleToCalendar(meta: GoogleCalendarImportMeta): boolean {
  return Boolean(meta.connected && meta.calendarWriteConnected)
}
