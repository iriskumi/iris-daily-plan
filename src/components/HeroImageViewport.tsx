import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { TodayHeroImageSettings } from '../appearanceSettings'

interface HeroImageViewportProps {
  image: TodayHeroImageSettings
  className?: string
  interactive?: boolean
  onChange?: (patch: Partial<TodayHeroImageSettings>) => void
  children?: ReactNode
}

interface ViewportSize {
  width: number
  height: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getHeroImageBounds(image: TodayHeroImageSettings, viewport: ViewportSize) {
  const naturalWidth = image.naturalWidth || 1
  const naturalHeight = image.naturalHeight || 1
  const viewportWidth = Math.max(1, viewport.width)
  const viewportHeight = Math.max(1, viewport.height)
  const coverScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight)
  const containScale = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight)
  const baseScale = image.objectFit === 'contain' ? containScale : coverScale
  const finalScale = baseScale * image.zoom
  const renderedWidth = naturalWidth * finalScale
  const renderedHeight = naturalHeight * finalScale
  const maxOffsetX = image.objectFit === 'cover'
    ? Math.max(0, (renderedWidth - viewportWidth) / 2)
    : Math.max(0, (viewportWidth - renderedWidth) / 2 + Math.max(0, renderedWidth - viewportWidth) / 2)
  const maxOffsetY = image.objectFit === 'cover'
    ? Math.max(0, (renderedHeight - viewportHeight) / 2)
    : Math.max(0, (viewportHeight - renderedHeight) / 2 + Math.max(0, renderedHeight - viewportHeight) / 2)

  return {
    renderedWidth,
    renderedHeight,
    maxOffsetX,
    maxOffsetY,
    offsetX: clamp(image.offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(image.offsetY, -maxOffsetY, maxOffsetY),
  }
}

export default function HeroImageViewport({
  image,
  className = '',
  interactive = false,
  onChange,
  children,
}: HeroImageViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<ViewportSize>({ width: 1, height: 1 })
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const update = () => {
      const rect = node.getBoundingClientRect()
      setViewport({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const bounds = useMemo(() => getHeroImageBounds(image, viewport), [image, viewport])

  useEffect(() => {
    if (!onChange) return
    if (bounds.offsetX !== image.offsetX || bounds.offsetY !== image.offsetY) {
      onChange({ offsetX: bounds.offsetX, offsetY: bounds.offsetY })
    }
  }, [bounds.offsetX, bounds.offsetY, image.offsetX, image.offsetY, onChange])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!interactive || !onChange || !(image.sourceType === 'upload' && image.dataUrl)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: bounds.offsetX,
      offsetY: bounds.offsetY,
    })
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || !onChange || drag.pointerId !== event.pointerId) return
    onChange({
      offsetX: clamp(drag.offsetX + event.clientX - drag.startX, -bounds.maxOffsetX, bounds.maxOffsetX),
      offsetY: clamp(drag.offsetY + event.clientY - drag.startY, -bounds.maxOffsetY, bounds.maxOffsetY),
    })
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (drag?.pointerId === event.pointerId) setDrag(null)
  }

  return (
    <div
      ref={viewportRef}
      className={`hero-image-viewport ${interactive ? 'is-interactive' : ''} ${drag ? 'is-dragging' : ''} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {image.sourceType === 'upload' && image.dataUrl && (
        <img
          className="hero-image-transform-layer"
          src={image.dataUrl}
          alt=""
          draggable={false}
          style={{
            width: `${bounds.renderedWidth}px`,
            height: `${bounds.renderedHeight}px`,
            transform: `translate(-50%, -50%) translate(${bounds.offsetX}px, ${bounds.offsetY}px)`,
          }}
        />
      )}
      {children}
    </div>
  )
}
