import { useState } from 'react'
import { Check, Clock, X } from 'lucide-react'
import {
  importStudyPlan,
  studyPlanDraft,
  type StudyPlanBlockDraft,
  type StudyPlanImportPayload,
} from '../studyPlanImport'

export type StudyPlanImportDialogState =
  | { status: 'preview'; payload: StudyPlanImportPayload }
  | { status: 'error'; message: string }

interface StudyPlanImportDialogProps {
  dialog: StudyPlanImportDialogState
  onClose: () => void
  onImported: (message: string) => void
}

export default function StudyPlanImportDialog({
  dialog,
  onClose,
  onImported,
}: StudyPlanImportDialogProps) {
  if (dialog.status === 'error') {
    return (
      <div className="external-task-import-backdrop" role="presentation">
        <section className="external-task-import-modal" role="dialog" aria-modal="true" aria-label="Study plan import error">
          <div className="section-label">Import from Iris Study OS</div>
          <h2>Could not read this study plan.</h2>
          <p>{dialog.message}</p>
          <div className="external-task-import-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </section>
      </div>
    )
  }

  return <StudyPlanPreview payload={dialog.payload} onClose={onClose} onImported={onImported} />
}

function StudyPlanPreview({
  payload,
  onClose,
  onImported,
}: {
  payload: StudyPlanImportPayload
  onClose: () => void
  onImported: (message: string) => void
}) {
  const [blocks, setBlocks] = useState<StudyPlanBlockDraft[]>(() => studyPlanDraft(payload))
  const [message, setMessage] = useState('')
  const selected = blocks.filter(block => block.selected)
  const totalMinutes = selected.reduce((sum, block) => sum + block.estimatedMinutes, 0)

  function updateBlock(id: string, patch: Partial<StudyPlanBlockDraft>) {
    setBlocks(current => current.map(block => block.id === id ? { ...block, ...patch } : block))
    setMessage('')
  }

  function handleImport() {
    if (selected.length === 0) {
      setMessage('Choose at least one study block.')
      return
    }
    try {
      const result = importStudyPlan(payload, blocks)
      const existingText = result.alreadyExisting
        ? ` ${result.alreadyExisting} existing task${result.alreadyExisting === 1 ? '' : 's'} reused.`
        : ''
      onImported(`${result.scheduled} study blocks added to Today’s Queue.${existingText}`)
    } catch {
      setMessage('Could not add this plan. Nothing was removed from Daily Hub.')
    }
  }

  return (
    <div className="external-task-import-backdrop" role="presentation">
      <section className="external-task-import-modal study-plan-import-modal" role="dialog" aria-modal="true" aria-label="Review study plan before importing">
        <div className="external-task-import-heading">
          <div>
            <div className="section-label">Import from Iris Study OS</div>
            <h2>Review today’s study plan</h2>
            <p className="study-plan-import-intro">Choose the blocks that belong in Daily Hub. Uncheck Cyber or AI when today only needs one serious task.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cancel study plan import"><X /></button>
        </div>

        <div className="study-plan-import-summary">
          <div><span>Mode</span><strong>{payload.title}</strong></div>
          <div><span>Date</span><strong>{payload.date}</strong></div>
          <div><span>Selected</span><strong>{selected.length} blocks · {totalMinutes}m</strong></div>
        </div>

        <div className="study-plan-import-list">
          {blocks.map(block => (
            <article className={`study-plan-import-block ${block.selected ? 'selected' : ''}`} key={block.id}>
              <label className="study-plan-import-check">
                <input
                  type="checkbox"
                  checked={block.selected}
                  onChange={event => updateBlock(block.id, { selected: event.target.checked })}
                />
                <span aria-hidden="true"><Check /></span>
              </label>
              <div className="study-plan-import-copy">
                <div className="study-plan-import-title-row">
                  <strong>{block.title}</strong>
                  <span>{block.category}</span>
                  {block.alreadyImported && <span className="study-plan-existing">Already in Inbox</span>}
                </div>
                {block.minimum && <p><b>Minimum:</b> {block.minimum}</p>}
                {block.tools && <p><b>Tools:</b> {block.tools}</p>}
              </div>
              <label className="study-plan-duration">
                <Clock aria-hidden="true" />
                <input
                  type="number"
                  min="5"
                  max="180"
                  step="5"
                  value={block.estimatedMinutes}
                  disabled={block.alreadyImported}
                  aria-label={`Minutes for ${block.title}`}
                  onChange={event => updateBlock(block.id, {
                    estimatedMinutes: Math.min(180, Math.max(5, Number(event.target.value) || 5)),
                  })}
                />
                <span>min</span>
              </label>
            </article>
          ))}
        </div>

        {payload.finishLine && <p className="study-plan-finish-line"><strong>Finish line:</strong> {payload.finishLine}</p>}
        {message && <p className="external-task-import-message">{message}</p>}
        <div className="external-task-import-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleImport} disabled={selected.length === 0}>
            Add {selected.length} blocks to Today
          </button>
        </div>
      </section>
    </div>
  )
}
