'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  style?: CSSProperties
}

export function FadeIn({ children, className = '', delay = 0, style = {} }: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 750ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s, transform 750ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
