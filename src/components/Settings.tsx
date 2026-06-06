import { useState } from 'react'
import { Check, Download, Upload, X } from 'lucide-react'
import type { AppSettings, AppBackup } from '../types'
import {
  exportBackupData,
  importBackupData,
  loadSettings,
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
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState<string | null>(null)

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
