import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const themeProvider = vi.fn(({ children }: { children: React.ReactNode }) => children)

vi.mock('next-themes', () => ({
  ThemeProvider: (props: { children: React.ReactNode }) => themeProvider(props),
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import { Providers } from '@/app/providers'

describe('Providers', () => {
  beforeEach(() => {
    themeProvider.mockClear()
  })

  it('follows the device theme by default', () => {
    render(
      <Providers>
        <span>Application</span>
      </Providers>
    )

    expect(screen.getByText('Application')).toBeInTheDocument()
    expect(themeProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        attribute: 'class',
        defaultTheme: 'system',
        enableSystem: true,
      })
    )
  })
})
