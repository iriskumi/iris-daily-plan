export type FocusVisualState = 'running' | 'paused' | 'complete'

const FOCUS_ARTWORK: Record<FocusVisualState, string> = {
  running: '/focus-states/focus-running.png',
  paused: '/focus-states/focus-paused.png',
  complete: '/focus-states/focus-complete.png',
}

const FOCUS_SIGN_COPY: Record<FocusVisualState, { main: string; detail: string }> = {
  running: { main: '只做这一小块', detail: '不用赶，专注就好' },
  paused: { main: '慢一点也算前进', detail: '休息一下，再继续' },
  complete: { main: '干得好', detail: '今天又靠近一点' },
}

interface FocusStateArtworkProps {
  state: FocusVisualState
}

export function FocusStateArtwork({ state }: FocusStateArtworkProps) {
  const signCopy = FOCUS_SIGN_COPY[state]

  return (
    <div className={`focus-state-artwork focus-state-artwork--${state}`} aria-hidden="true">
      <span className="focus-state-halo" />
      <span className="focus-state-orbit focus-state-orbit--one" />
      <span className="focus-state-orbit focus-state-orbit--two" />
      <span className="focus-state-spark focus-state-spark--one" />
      <span className="focus-state-spark focus-state-spark--two" />
      <span className="focus-state-spark focus-state-spark--three" />
      <div className="focus-state-character">
        <img src={FOCUS_ARTWORK[state]} alt="" decoding="async" draggable={false} />
        <span className="focus-state-sign-copy">
          <strong>{signCopy.main}</strong>
          <small>{signCopy.detail}</small>
        </span>
      </div>
    </div>
  )
}
