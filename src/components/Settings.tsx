import { useEffect, useState } from 'react'
import { CalendarDays, Check, Download, RefreshCw, Upload, X } from 'lucide-react'
import type { AppSettings, AppBackup, GoogleCalendarImportMeta } from '../types'
import {
  connectGoogleCalendar,
  getGoogleCalendarStatus,
  importCalendarCommitments,
} from '../services/calendarService'
import {
  exportBackupData,
  importBackupData,
  loadGoogleCalendarMeta,
  loadSettings,
  saveCalendarEvents,
  saveGoogleCalendarMeta,
  saveSettings,
  validateBackup,
} from '../storage'

const TIMEZONES = ['Australia/Melbourne', 'UTC', 'Asia/Shanghai', 'America/New_York']

function downloadJson(filename: string, data: AppBackup) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [calendarMeta, setCalendarMeta] = useState<GoogleCalendarImportMeta>(() =>
    loadGoogleCalendarMeta(),
  )
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [syncingCalendar, setSyncingCalendar] = useState(false)

  useEffect(() => {
    void refreshCalendarStatus()
  }, [])

  async function refreshCalendarStatus() {
    const status = await getGoogleCalendarStatus()
    const next = {
      ...calendarMeta,
      connected: status.connected,
      calendarConnected: status.calendarConnected,
      gmailConnected: status.gmailConnected,
      accountEmail: status.accountEmail ?? calendarMeta.accountEmail,
      warning: status.warning ?? calendarMeta.warning,
    }
    setCalendarMeta(next)
    saveGoogleCalendarMeta(next)
  }

  function persist(next: AppSettings) {
    setSettings(next)
    saveSettings(next)
    setMessage('Settings saved')
  }

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    persist({ ...settings, [key]: value })
  }

  function handleExport() {
    const backup = exportBackupData()
    downloadJson(`iris-daily-plan-backup-${backup.exportedAt.slice(0, 10)}.json`, backup)
    setMessage('Backup exported')
  }

  function handleImport() {
    try {
      const parsed = JSON.parse(importText) as unknown
      const data = validateBackup(parsed)
      if (!data) {
        setMessage('Backup validation failed')
        return
      }
      if (!confirm('Import this backup? This will overwrite existing local data.')) return
      importBackupData(data)
      setSettings(data.settings)
      setImportText('')
      setMessage('Backup imported')
    } catch {
      setMessage('Backup JSON could not be read')
    }
  }

  async function handleCalendarSync() {
    setSyncingCalendar(true)
    const result = await importCalendarCommitments()
    setSyncingCalendar(false)

    if (!result.success || !result.data) {
      const next = {
        ...calendarMeta,
        connected: false,
      }
      setCalendarMeta(next)
      saveGoogleCalendarMeta(next)
      setMessage(result.message || 'Google Calendar not connected')
      return
    }

    const importedAt = new Date().toISOString()
    const status = await getGoogleCalendarStatus()
    const next = {
      connected: true,
      calendarConnected: status.calendarConnected,
      gmailConnected: status.gmailConnected,
      accountEmail: status.accountEmail ?? calendarMeta.accountEmail,
      lastImportedAt: importedAt,
      warning: status.warning ?? calendarMeta.warning,
    }
    saveCalendarEvents(result.data)
    saveGoogleCalendarMeta(next)
    setCalendarMeta(next)
    setMessage(result.message)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">
          Local defaults, backup tools, and integration preparation.
        </p>
      </div>

      {message && (
        <div className="template-toast">
          <Check size={13} />
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Planning Defaults</span>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Timezone</label>
            <select
              value={settings.timezone}
              onChange={e => set('timezone', e.target.value)}
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Default sleep target</label>
            <input
              type="time"
              value={settings.defaultSleepTarget}
              onChange={e => set('defaultSleepTarget', e.target.value)}
            />
          </div>
        </div>

        <div className="settings-toggle-list mt-1">
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.tuesdayThursdayEveningClassEnabled}
              onChange={e => set('tuesdayThursdayEveningClassEnabled', e.target.checked)}
            />
            <span>Tuesday/Thursday evening class enabled</span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.saturdayClassEnabled}
              onChange={e => set('saturdayClassEnabled', e.target.checked)}
            />
            <span>Saturday class enabled</span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={settings.defaultRecoveryBlockEnabled}
              onChange={e => set('defaultRecoveryBlockEnabled', e.target.checked)}
            />
            <span>Default recovery block enabled</span>
          </label>
        </div>
      </div>

      <div className="card mt-1 calendar-integration-card">
        <div className="card-header">
          <span className="card-title">
            <CalendarDays size={14} />
            Google Calendar
          </span>
        </div>

        <div className={`integration-status ${calendarMeta.connected ? 'connected' : 'not-connected'}`}>
          {calendarMeta.connected ? 'Connected' : 'Not Connected'}
        </div>

        <div className="scope-status-list">
          <div className={`scope-status ${calendarMeta.calendarConnected ? 'connected' : 'not-connected'}`}>
            Calendar {calendarMeta.calendarConnected ? 'connected' : 'not connected'}
          </div>
          <div className={`scope-status ${calendarMeta.gmailConnected ? 'connected' : 'not-connected'}`}>
            Gmail {calendarMeta.gmailConnected ? 'connected' : 'not connected'}
          </div>
        </div>

        {calendarMeta.accountEmail && (
          <div className="text-xs text-muted">Account: {calendarMeta.accountEmail}</div>
        )}

        <div className="text-xs text-muted mt-sm">
          Last sync:{' '}
          {calendarMeta.lastImportedAt
            ? new Date(calendarMeta.lastImportedAt).toLocaleString('en-AU')
            : 'Never'}
        </div>

        {calendarMeta.warning && (
          <p className="text-xs text-muted calendar-storage-warning">{calendarMeta.warning}</p>
        )}

        <div className="calendar-actions">
          <button className="btn btn-secondary" onClick={connectGoogleCalendar}>
            <CalendarDays size={14} />
            Connect Google Calendar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCalendarSync}
            disabled={syncingCalendar}
          >
            <RefreshCw size={14} />
            {syncingCalendar ? 'Syncing...' : 'Sync Next 7 Days'}
          </button>
        </div>

        <p className="text-xs text-muted mt-sm" style={{ lineHeight: 1.6 }}>
          Read-only calendar access. Imported events are used as fixed commitments for planning.
        </p>
      </div>

      <div className="card mt-1">
        <div className="card-header">
          <span className="card-title">JSON Backup</span>
        </div>

        <div className="form-actions" style={{ marginTop: 0 }}>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={14} />
            Export JSON
          </button>
        </div>

        <div className="form-group mt-1">
          <label>Import backup JSON</label>
          <textarea
            placeholder="Paste a previously exported Iris Daily Plan backup JSON here."
            value={importText}
            onChange={e => setImportText(e.target.value)}
            style={{ minHeight: 120, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
          />
        </div>

        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={handleImport}
            disabled={!importText.trim()}
          >
            <Upload size={14} />
            Import JSON
          </button>
          {importText && (
            <button className="btn btn-secondary" onClick={() => setImportText('')}>
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        <p className="text-xs text-muted mt-sm" style={{ lineHeight: 1.6 }}>
          Import validates the backup shape first and asks before overwriting existing local data.
          External integrations are not connected from this screen.
        </p>
      </div>
    </div>
  )
}
