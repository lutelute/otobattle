import { useEffect, useCallback } from 'react'

export function useCanvasSize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }, [canvasRef, containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [containerRef, resize])
}
