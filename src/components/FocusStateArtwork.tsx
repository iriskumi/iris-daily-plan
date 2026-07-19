export type FocusVisualState = 'running' | 'paused' | 'complete'

const FOCUS_ARTWORK: Record<FocusVisualState, string> = {
  running: '/focus-states/focus-running.png',
  paused: '/focus-states/focus-paused.png',
  complete: '/focus-states/focus-complete.png',
}

interface FocusStateArtworkProps {
  state: FocusVisualState
}

export function FocusStateArtwork({ state }: FocusStateArtworkProps) {
  return (
    <div className={`focus-state-artwork focus-state-artwork--${state}`} aria-hidden="true">
      <span className="focus-state-orbit focus-state-orbit--one" />
      <span className="focus-state-orbit focus-state-orbit--two" />
      <img src={FOCUS_ARTWORK[state]} alt="" decoding="async" draggable={false} />
    </div>
  )
}
