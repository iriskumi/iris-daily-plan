import { useMemo, useState } from 'react'
import { BookOpen, Copy, ExternalLink, Pencil, Plus, X } from 'lucide-react'
import {
  addMediaEntry,
  loadMediaLog,
  MEDIA_LANGUAGES,
  MEDIA_MOODS,
  MEDIA_PLATFORMS,
  MEDIA_RECOMMENDATION_POOLS,
  MEDIA_STATUSES,
  MEDIA_TYPES,
  MEDIA_USEFULNESS,
  mediaObsidianMarkdown,
  updateMediaEntry,
  type MediaLogEntry,
} from '../mediaLogStorage'

type MediaFilter = 'All' | 'Want to try' | 'In progress' | 'Finished' | 'Comfort' | 'Low-angst' | 'Audiobooks' | 'TV / Shows' | 'Podcasts' | 'Japanese' | 'English'

const MEDIA_FILTERS: MediaFilter[] = ['All', 'Want to try', 'In progress', 'Finished', 'Comfort', 'Low-angst', 'Audiobooks', 'TV / Shows', 'Podcasts', 'Japanese', 'English']

function matchesFilter(entry: MediaLogEntry, filter: MediaFilter) {
  if (filter === 'All') return true
  if (filter === 'English' || filter === 'Japanese') return entry.language === filter
  if (filter === 'Want to try' || filter === 'In progress' || filter === 'Finished') return entry.status === filter
  if (filter === 'Comfort') return entry.status === 'Comfort pick' || entry.mood.some(tag => ['comfort', 'cozy', 'favourite'].includes(tag))
  if (filter === 'Audiobooks') return entry.type === 'Audiobook'
  if (filter === 'TV / Shows') return ['TV Show', 'Drama', 'Variety Show'].includes(entry.type)
  if (filter === 'Podcasts') return entry.type === 'Podcast'
  if (filter === 'Low-angst') return entry.mood.includes('low-angst')
  return true
}

type MediaDraft = {
  title: string
  type: string
  language: string
  status: string
  mood: string[]
  usefulness: string[]
  sourcePlatform: string
  link: string
  notes: string
}

const initialDraft: MediaDraft = {
  title: '',
  type: 'Audiobook',
  language: 'English',
  status: 'Want to try',
  mood: [],
  usefulness: [],
  sourcePlatform: 'Other',
  link: '',
  notes: '',
}

function draftFromEntry(entry: MediaLogEntry): MediaDraft {
  return {
    title: entry.title,
    type: entry.type,
    language: entry.language,
    status: entry.status,
    mood: [...entry.mood],
    usefulness: [...entry.usefulness],
    sourcePlatform: entry.sourcePlatform ?? 'Other',
    link: entry.link ?? '',
    notes: entry.notes ?? '',
  }
}

export default function MediaTab() {
  const [store, setStore] = useState(() => loadMediaLog())
  const [draft, setDraft] = useState<MediaDraft>(initialDraft)
  const [filter, setFilter] = useState<MediaFilter>('All')
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  const entries = useMemo(() => store.entries.filter(entry => matchesFilter(entry, filter)), [filter, store.entries])
  const isEditing = Boolean(editingEntryId)

  function toggleList(key: 'mood' | 'usefulness', value: string) {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(item => item !== value) : [...prev[key], value],
    }))
  }

  function resetForm() {
    setDraft(initialDraft)
    setEditingEntryId(null)
    setShowForm(false)
  }

  function openAddForm() {
    setDraft(initialDraft)
    setEditingEntryId(null)
    setShowForm(true)
    window.setTimeout(() => {
      document.getElementById('media-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  function startEdit(entry: MediaLogEntry) {
    setDraft(draftFromEntry(entry))
    setEditingEntryId(entry.id)
    setShowForm(true)
    window.setTimeout(() => {
      document.getElementById('media-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  function saveEntry() {
    if (!draft.title.trim()) {
      setMessage('Add a title first.')
      return
    }
    if (editingEntryId) {
      const result = updateMediaEntry(editingEntryId, draft, store)
      if (!result) {
        setMessage('Could not find that entry to update.')
        return
      }
      setStore(result.store)
      resetForm()
      setMessage(`${result.entry.title} updated.`)
      return
    }
    const result = addMediaEntry(draft, store)
    setStore(result.store)
    resetForm()
    setMessage(`${result.entry.title} saved.`)
  }

  async function copyMediaNote(entry: MediaLogEntry) {
    const note = mediaObsidianMarkdown(entry)
    await navigator.clipboard.writeText(note.markdown)
    setMessage(`Copied Obsidian media note. Suggested destination: ${note.destination}`)
  }

  return (
    <div className="page media-tab-page">
      <div className="page-header">
        <h2 className="page-title">Media</h2>
        <p className="page-subtitle">Browse your log first. Add entries when something is worth remembering.</p>
      </div>

      <div className="media-shortcut-row">
        <a href="https://iris-book-finder.vercel.app/" target="_blank" rel="noreferrer">
          <BookOpen size={16} />
          Find books / audiobooks
          <ExternalLink size={14} />
        </a>
        <a href="https://iris-expression-review-hub.vercel.app/" target="_blank" rel="noreferrer">
          <Copy size={16} />
          Expression Review Hub
          <ExternalLink size={14} />
        </a>
      </div>

      <section className="life-system-card media-log-section media-log-primary">
        <div className="life-card-heading">
          <div>
            <p className="hub-card-kicker">Your media log</p>
            <h3 className="media-section-title">{entries.length} item{entries.length === 1 ? '' : 's'}</h3>
            <p className="page-subtitle media-helper">Was it actually good for me?</p>
          </div>
          <button className="btn-primary" type="button" onClick={() => (showForm && !isEditing ? resetForm() : openAddForm())}>
            <Plus size={14} />
            {showForm && !isEditing ? 'Hide form' : 'Add entry'}
          </button>
        </div>
        <div className="life-filter-row">{MEDIA_FILTERS.map(item => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <div className="life-card-list">
          {entries.length === 0 ? <p className="life-empty">No media here yet.</p> : entries.map(entry => (
            <article className={`life-log-card ${editingEntryId === entry.id ? 'selected' : ''}`} key={entry.id}>
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.type} · {entry.language} · {entry.status} · {entry.sourcePlatform}</p>
                {entry.notes && <small>{entry.notes}</small>}
                <div className="life-tag-row">{[...entry.mood, ...entry.usefulness].map(tag => <span key={tag}>{tag}</span>)}</div>
              </div>
              <div className="life-log-actions">
                <button type="button" className="life-log-action-edit" onClick={() => startEdit(entry)}>
                  <Pencil size={13} />
                  Edit
                </button>
                <button type="button" onClick={() => navigator.clipboard.writeText(`${entry.title} — ${entry.type} — ${entry.status}`)}>Copy quick note</button>
                <button type="button" onClick={() => copyMediaNote(entry)}>Copy Obsidian note</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showForm && (
      <section className="life-system-card media-form-card" id="media-entry-form">
        <div className="life-card-heading">
          <div>
            <div className="section-label">{isEditing ? 'Edit media entry' : 'Add media entry'}</div>
            <h3 className="media-form-title">{isEditing ? draft.title || 'Edit entry' : '记录一个娱乐条目'}</h3>
            <p className="media-helper media-helper-cn">
              {isEditing ? 'Update anything, then save.' : '书、剧、综艺、有声书、播客、电影都可以。随手记一下就好。'}
            </p>
          </div>
          <div className="media-form-heading-actions">
            <button className="btn-secondary" type="button" onClick={resetForm}>
              <X size={14} />
              Cancel
            </button>
            <button className="btn-primary" type="button" onClick={saveEntry}>
              <Plus size={14} />
              {isEditing ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
        <div className="life-form-grid">
          <label className="life-field wide">Title<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Fisk, Puckboy, podcast episode..." /></label>
          <label className="life-field">Type<select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}>{MEDIA_TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field">Language<select value={draft.language} onChange={event => setDraft({ ...draft, language: event.target.value })}>{MEDIA_LANGUAGES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field">Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{MEDIA_STATUSES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field">Platform<select value={draft.sourcePlatform} onChange={event => setDraft({ ...draft, sourcePlatform: event.target.value })}>{MEDIA_PLATFORMS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="life-field wide">Link<input value={draft.link} onChange={event => setDraft({ ...draft, link: event.target.value })} placeholder="Optional" /></label>
          <label className="life-field wide">Notes<textarea value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="One line is enough." /></label>
        </div>
        <div className="life-chip-group">
          {MEDIA_MOODS.map(item => <button key={item} type="button" className={draft.mood.includes(item) ? 'active' : ''} onClick={() => toggleList('mood', item)}>{item}</button>)}
        </div>
        <details className="media-optional-learning">
          <summary>Optional learning use</summary>
          <div className="life-chip-group">
            {MEDIA_USEFULNESS.map(item => <button key={item} type="button" className={draft.usefulness.includes(item) ? 'active' : ''} onClick={() => toggleList('usefulness', item)}>{item}</button>)}
          </div>
        </details>
      </section>
      )}

      <details className="hub-secondary-details">
        <summary>Comfort shelves &amp; recommendations</summary>
      <section className="life-system-card media-pools-card">
        <div className="section-label">Comfort shelves</div>
        <p className="media-helper">Low-pressure places to look when you want something familiar, funny, or gentle.</p>
        <div className="recommendation-grid">
          {MEDIA_RECOMMENDATION_POOLS.map(pool => (
            <div className="recommendation-card" key={pool.title}>
              <h3>{pool.title}</h3>
              <ul>{pool.items.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      </details>

      {message && <div className="start-now-message">{message}</div>}
    </div>
  )
}
