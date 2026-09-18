import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authState: {
    data: { expires: '2099-01-01T00:00:00.000Z' } as { expires: string } | null,
    status: 'authenticated' as 'authenticated' | 'unauthenticated',
  },
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => mocks.authState,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}))

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

import LoginPage from '@/app/login/page'

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.authState.data = { expires: '2099-01-01T00:00:00.000Z' }
    mocks.authState.status = 'authenticated'
    mocks.push.mockReset()
    mocks.replace.mockReset()
    mocks.refresh.mockReset()
    mocks.signIn.mockReset()
    mocks.signOut.mockReset()
    mocks.signOut.mockImplementation(async () => {
      mocks.authState.data = null
      mocks.authState.status = 'unauthenticated'
    })
  })

  it('clears an invalidated session instead of hanging on Redirecting', async () => {
    render(<LoginPage />)

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false })
    })
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/login')
      expect(mocks.refresh).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    })
  })
})
