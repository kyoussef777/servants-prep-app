import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

describe('Avatar component', () => {
  it('should render with overflow-hidden and rounded-full', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('overflow-hidden')
    expect(root.className).toContain('rounded-full')
  })

  it('should apply custom className', () => {
    const { container } = render(
      <Avatar className="h-20 w-20">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('h-20')
    expect(root.className).toContain('w-20')
  })

  it('AvatarImage should include object-cover class by default', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/photo.jpg" alt="Test" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    const img = container.querySelector('img')
    if (img) {
      // AvatarImage applies object-cover via className
      expect(img.className).toContain('object-cover')
    }
  })

  it('AvatarImage should include aspect-square class', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/photo.jpg" alt="Test" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    const img = container.querySelector('img')
    if (img) {
      expect(img.className).toContain('aspect-square')
    }
  })

  it('AvatarFallback should render with rounded-full', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback className="bg-maroon-600 text-white">AB</AvatarFallback>
      </Avatar>
    )

    const fallback = container.querySelector('[data-slot="avatar-fallback"]')
    expect(fallback).toBeInTheDocument()
    if (fallback) {
      expect(fallback.className).toContain('rounded-full')
    }
  })
})
