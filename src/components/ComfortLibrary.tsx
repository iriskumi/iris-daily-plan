import { useMemo, useState } from 'react'
import { BookHeart, Moon, Plus, Sparkles } from 'lucide-react'
import {
  addComfortMediaItem,
  comfortLibraryStats,
  COMFORT_MEDIA_LANGUAGES,
  COMFORT_MEDIA_PLATFORMS,
  COMFORT_MEDIA_STATUSES,
  COMFORT_MEDIA_TYPES,
  COMFORT_SUGGESTED_TAGS,
  createComfortMediaDraft,
  loadComfortLibraryStore,
} from '../comfortLibraryStorage'
import type { ComfortLibraryStore, ComfortMediaDraft, ComfortMediaItem } from '../comfortLibraryTypes'

type ComfortFilter =
  | 'All'
  | 'Want to try'
  | 'Finished'
  | 'Dropped'
  | 'Bedtime safe'
  | 'English useful'
  | 'Comfort listen'
  | 'Not for me'
  | 'Short-drama replacement'

const COMFORT_FILTERS: ComfortFilter[] = [
  'All',
  'Want to try',
  'Finished',
  'Dropped',
  'Bedtime safe',
  'English useful',
  'Comfort listen',
  'Not for me',
  'Short-drama replacement',
]

function ratingDots(value: number) {
  return '●'.repeat(value) + '○'.repeat(Math.max(0, 5 - value))
}

function formatBest(item: ComfortMediaItem | null) {
  return item?.title ?? 'Add one first'
}

function matchesFilter(item: ComfortMediaItem, filter: ComfortFilter) {
  if (filter === 'All') return true
  if (filter === 'Want to try' || filter === 'Finished' || filter === 'Dropped') return item.status === filter
  if (filter === 'Bedtime safe') return item.bedtimeSafe || item.tags.includes('bedtime safe')
  if (filter === 'English useful') {
    return item.englishUsefulness >= 4 || item.tags.includes('daily English') || item.tags.includes('English shadowing material')
  }
  if (filter === 'Comfort listen') {
    return item.tags.includes('comfort listen') || item.tags.includes('comfort show') || item.comfortLevel >= 4
  }
  if (filter === 'Not for me') return item.status === 'Dropped' || item.tags.includes('not for me') || item.tags.includes('too boring')
  if (filter === 'Short-drama replacement') return item.tags.includes('short-drama replacement')
  return true
}

function toggleTag(draft: ComfortMediaDraft, tag: string): ComfortMediaDraft {
  const hasTag = draft.tags.includes(tag)
  return {
    ...draft,
    tags: hasTag ? draft.tags.filter(item => item !== tag) : [...draft.tags, tag],
  }
}

export default function ComfortLibrary() {
  const [store, setStore] = useState<ComfortLibraryStore>(() => loadComfortLibraryStore())
  const [draft, setDraft] = useState<ComfortMediaDraft>(() => createComfortMediaDraft())
  const [activeFilter, setActiveFilter] = useState<ComfortFilter>('All')
  const [message, setMessage] = useState('')

  const stats = useMemo(() => comfortLibraryStats(store.items), [store.items])
  const visibleItems = useMemo(
    () => store.items.filter(item => matchesFilter(item, activeFilter)),
    [activeFilter, store.items],
  )

  function updateDraft<K extends keyof ComfortMediaDraft>(key: K, value: ComfortMediaDraft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function handleAddItem() {
    if (!draft.title.trim()) {
      setMessage('Add a title first. One tiny note is enough.')
      return
    }
    const result = addComfortMediaItem(draft, store)
    setStore(result.store)
    setDraft(createComfortMediaDraft())
    setActiveFilter('All')
    setMessage(`${result.item.title} saved to your comfort library.`)
  }

  return (
    <div className="page comfort-library-page">
      <div className="page-header comfort-library-header">
        <div>
          <h2 className="page-title">Comfort Library</h2>
          <p className="page-subtitle">What did I watch, read, or listen to?</p>
        </div>
        <span className="comfort-library-mark" aria-hidden="true">
          <BookHeart />
        </span>
      </div>

      <section className="comfort-hero-card" aria-label="Comfort library purpose">
        <div>
          <div className="section-label">Media Log</div>
          <h3>Was it actually good for me?</h3>
          <p>Comfort is allowed. New rabbit holes are optional.</p>
        </div>
        <p className="comfort-hero-note">Build a library of things that actually work.</p>
      </section>

      <section className="comfort-stats-grid" aria-label="Comfort library stats">
        <div className="comfort-stat-card">
          <span>Total logged</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="comfort-stat-card">
          <span>Finished</span>
          <strong>{stats.finished}</strong>
        </div>
        <div className="comfort-stat-card">
          <span>Dropped</span>
          <strong>{stats.dropped}</strong>
        </div>
        <div className="comfort-stat-card comfort-stat-wide">
          <span>Best comfort</span>
          <strong>{formatBest(stats.bestComfort)}</strong>
        </div>
        <div className="comfort-stat-card comfort-stat-wide">
          <span>Best English-useful</span>
          <strong>{formatBest(stats.bestEnglish)}</strong>
        </div>
        <div className="comfort-stat-card comfort-stat-wide">
          <span>Highest dopamine risk</span>
          <strong>{formatBest(stats.highestRisk)}</strong>
        </div>
      </section>

      <section className="comfort-form-card" aria-label="Add media item">
        <div className="comfort-section-heading">
          <div>
            <div className="section-label">Add one thing</div>
            <h3>Remember what worked</h3>
          </div>
          <Sparkles aria-hidden="true" />
        </div>

        <div className="comfort-form-grid">
          <label className="comfort-field comfort-field-title">
            <span>Title</span>
            <input
              value={draft.title}
              onChange={event => updateDraft('title', event.target.value)}
              placeholder="e.g. Modern Family, Puckboy, a YouTube video..."
            />
          </label>

          <label className="comfort-field">
            <span>Type</span>
            <select value={draft.type} onChange={event => updateDraft('type', event.target.value as ComfortMediaDraft['type'])}>
              {COMFORT_MEDIA_TYPES.map(type => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="comfort-field">
            <span>Status</span>
            <select value={draft.status} onChange={event => updateDraft('status', event.target.value as ComfortMediaDraft['status'])}>
              {COMFORT_MEDIA_STATUSES.map(status => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="comfort-field">
            <span>Language</span>
            <select value={draft.language} onChange={event => updateDraft('language', event.target.value as ComfortMediaDraft['language'])}>
              {COMFORT_MEDIA_LANGUAGES.map(language => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>

          <label className="comfort-field">
            <span>Platform</span>
            <select value={draft.platform} onChange={event => updateDraft('platform', event.target.value as ComfortMediaDraft['platform'])}>
              {COMFORT_MEDIA_PLATFORMS.map(platform => (
                <option key={platform}>{platform}</option>
              ))}
            </select>
          </label>

          <label className="comfort-field">
            <span>Comfort level</span>
            <input
              type="range"
              min="1"
              max="5"
              value={draft.comfortLevel}
              onChange={event => updateDraft('comfortLevel', Number(event.target.value))}
            />
            <small>{ratingDots(draft.comfortLevel)}</small>
          </label>

          <label className="comfort-field">
            <span>English usefulness</span>
            <input
              type="range"
              min="1"
              max="5"
              value={draft.englishUsefulness}
              onChange={event => updateDraft('englishUsefulness', Number(event.target.value))}
            />
            <small>{ratingDots(draft.englishUsefulness)}</small>
          </label>

          <label className="comfort-field">
            <span>Dopamine risk</span>
            <input
              type="range"
              min="1"
              max="5"
              value={draft.dopamineRisk}
              onChange={event => updateDraft('dopamineRisk', Number(event.target.value))}
            />
            <small>{ratingDots(draft.dopamineRisk)}</small>
          </label>

          <label className="comfort-field">
            <span>Rewatch / relisten value</span>
            <input
              type="range"
              min="1"
              max="5"
              value={draft.rewatchValue}
              onChange={event => updateDraft('rewatchValue', Number(event.target.value))}
            />
            <small>{ratingDots(draft.rewatchValue)}</small>
          </label>

          <label className="comfort-checkbox">
            <input
              type="checkbox"
              checked={draft.bedtimeSafe}
              onChange={event => updateDraft('bedtimeSafe', event.target.checked)}
            />
            <span>Bedtime safe</span>
          </label>

          <label className="comfort-field">
            <span>Low angst</span>
            <select value={draft.lowAngst} onChange={event => updateDraft('lowAngst', event.target.value as ComfortMediaDraft['lowAngst'])}>
              <option value="yes">yes</option>
              <option value="no">no</option>
              <option value="unknown">unknown</option>
            </select>
          </label>

          <label className="comfort-field comfort-field-notes">
            <span>Notes</span>
            <textarea
              value={draft.notes}
              onChange={event => updateDraft('notes', event.target.value)}
              placeholder="Was it calming, useful, boring, too addictive, or a good short-drama replacement?"
              rows={3}
            />
          </label>
        </div>

        <div className="comfort-tag-palette" aria-label="Suggested tags">
          {COMFORT_SUGGESTED_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              className={draft.tags.includes(tag) ? 'selected' : ''}
              onClick={() => setDraft(prev => toggleTag(prev, tag))}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="comfort-form-actions">
          <button className="btn-primary" type="button" onClick={handleAddItem}>
            <Plus />
            Add to library
          </button>
          {message && <small>{message}</small>}
        </div>
      </section>

      <section className="comfort-log-section" aria-label="Comfort media log">
        <div className="comfort-section-heading">
          <div>
            <div className="section-label">Personal taste profile</div>
            <h3>Things that actually work</h3>
          </div>
          <Moon aria-hidden="true" />
        </div>

        <div className="comfort-filter-row" aria-label="Comfort library filters">
          {COMFORT_FILTERS.map(filter => (
            <button
              key={filter}
              className={activeFilter === filter ? 'active' : ''}
              type="button"
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <div className="comfort-empty-state">No items in this view yet. Try another filter or add one soft data point.</div>
        ) : (
          <div className="comfort-media-grid">
            {visibleItems.map(item => (
              <article className="comfort-media-card" key={item.id}>
                <div className="comfort-media-card-header">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.type} · {item.language} · {item.platform}</p>
                  </div>
                  <span>{item.status}</span>
                </div>

                <div className="comfort-rating-row">
                  <span>Comfort {item.comfortLevel}/5</span>
                  <span>English {item.englishUsefulness}/5</span>
                  <span>Risk {item.dopamineRisk}/5</span>
                  <span>Repeat {item.rewatchValue}/5</span>
                </div>

                <div className="comfort-safety-row">
                  {item.bedtimeSafe && <span>bedtime safe</span>}
                  <span>low angst: {item.lowAngst}</span>
                </div>

                {item.notes && <p className="comfort-media-notes">{item.notes}</p>}

                {item.tags.length > 0 && (
                  <div className="comfort-tag-list">
                    {item.tags.map(tag => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
