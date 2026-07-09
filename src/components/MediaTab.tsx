import { useMemo, useState } from 'react'
import { BookOpen, Copy, ExternalLink, Plus } from 'lucide-react'
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
  type MediaLogEntry,
} from '../mediaLogStorage'

type MediaFilter = 'All' | 'English' | 'Japanese' | 'Audiobook' | 'TV' | 'Podcast' | 'Useful for Shadowing' | 'Low-angst'

const MEDIA_FILTERS: MediaFilter[] = ['All', 'English', 'Japanese', 'Audiobook', 'TV', 'Podcast', 'Useful for Shadowing', 'Low-angst']

function matchesFilter(entry: MediaLogEntry, filter: MediaFilter) {
  if (filter === 'All') return true
  if (filter === 'English' || filter === 'Japanese') return entry.language === filter
  if (filter === 'Audiobook') return entry.type === 'Audiobook'
  if (filter === 'TV') return entry.type === 'TV Show' || entry.type === 'Variety Show'
  if (filter === 'Podcast') return entry.type === 'Podcast'
  if (filter === 'Useful for Shadowing') return entry.usefulness.includes('English output material')
  if (filter === 'Low-angst') return entry.mood.includes('low-angst')
  return true
}

const initialDraft = {
  title: '',
  type: 'Audiobook',
  language: 'English',
  status: 'Want to try',
  mood: [] as string[],
  usefulness: [] as string[],
  sourcePlatform: 'Other',
  link: '',
  notes: '',
}

export default function MediaTab() {
  const [store, setStore] = useState(() => loadMediaLog())
  const [draft, setDraft] = useState(initialDraft)
  const [filter, setFilter] = useState<MediaFilter>('All')
  const [message, setMessage] = useState('')

  const entries = useMemo(() => store.entries.filter(entry => matchesFilter(entry, filter)), [filter, store.entries])

  function toggleList(key: 'mood' | 'usefulness', value: string) {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(item => item !== value) : [...prev[key], value],
    }))
  }

  function addEntry() {
    if (!draft.title.trim()) {
      setMessage('Add a title first.')
      return
    }
    const result = addMediaEntry(draft, store)
    setStore(result.store)
    setDraft(initialDraft)
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
        <p className="page-subtitle">Light log for comfort, English input, Japanese maintenance, and shadowing candidates.</p>
      </div>

      <section className="life-system-card media-links-card">
        <div>
          <div className="section-label">Quick links</div>
          <h3 className="media-section-title">Find and reuse good material</h3>
          <p className="media-helper">Comfort is allowed. New rabbit holes are optional.</p>
        </div>
        <div className="life-link-row">
          <a href="https://iris-book-finder.vercel.app/" target="_blank" rel="noreferrer">
            <BookOpen size={16} />
            Find books / audiobooks
            <ExternalLink size={14} />
          </a>
          <a href="https://iris-expression-review-hub.vercel.app/" target="_blank" rel="noreferrer">
            <Copy size={16} />
            Turn expressions into output
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <section className="life-system-card media-form-card">
        <div className="life-card-heading">
          <div>
            <div className="section-label">Add media entry</div>
            <h3 className="media-form-title">记录一个素材</h3>
            <p className="media-helper media-helper-cn">书、剧、播客、有声书、精听片段都可以。</p>
          </div>
          <button className="btn-primary" type="button" onClick={addEntry}><Plus size={14} />Save</button>
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
        <div className="life-chip-group">
          {MEDIA_USEFULNESS.map(item => <button key={item} type="button" className={draft.usefulness.includes(item) ? 'active' : ''} onClick={() => toggleList('usefulness', item)}>{item}</button>)}
        </div>
      </section>

      <section className="life-system-card media-pools-card">
        <div className="section-label">Recommended pools</div>
        <p className="media-helper">Soft places to look when you want input without a new spiral.</p>
        <div className="recommendation-grid">
          {MEDIA_RECOMMENDATION_POOLS.map(pool => (
            <div className="recommendation-card" key={pool.title}>
              <h3>{pool.title}</h3>
              <ul>{pool.items.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="life-system-card media-log-section">
        <div className="life-card-heading">
          <div>
            <div className="section-label">Media log</div>
            <h3 className="media-section-title">{entries.length} item{entries.length === 1 ? '' : 's'}</h3>
            <p className="media-helper">Was it actually good for me?</p>
          </div>
        </div>
        <div className="life-filter-row">{MEDIA_FILTERS.map(item => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
        <div className="life-card-list">
          {entries.length === 0 ? <p className="life-empty">No media here yet.</p> : entries.map(entry => (
            <article className="life-log-card" key={entry.id}>
              <div>
                <h3>{entry.title}</h3>
                <p>{entry.type} · {entry.language} · {entry.status} · {entry.sourcePlatform}</p>
                {entry.notes && <small>{entry.notes}</small>}
                <div className="life-tag-row">{[...entry.mood, ...entry.usefulness].map(tag => <span key={tag}>{tag}</span>)}</div>
              </div>
              <div className="life-log-actions">
                <button type="button" onClick={() => copyMediaNote(entry)}>Copy Obsidian note</button>
                <button type="button" onClick={() => navigator.clipboard.writeText(`${entry.title} — ${entry.type} — ${entry.usefulness.join(', ')}`)}>Copy task summary</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {message && <div className="start-now-message">{message}</div>}
    </div>
  )
}
