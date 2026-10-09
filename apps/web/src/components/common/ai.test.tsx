import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { User } from '@copilot/shared'
import { authKeys } from '@/features/auth/api'
import { AiFeature } from './ai'

const user = (aiAccess: boolean): User => ({
  id: 'u1',
  email: 'jane@example.com',
  name: 'Jane',
  role: 'user',
  aiAccess,
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
})

function renderFeature(aiAccess: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(authKeys.me, user(aiAccess))
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AiFeature title="Cover letter" description="Draft with AI" preview={<p>Example preview</p>}>
          <p>Real AI content</p>
        </AiFeature>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AiFeature', () => {
  it('shows a locked preview and access link without AI access', () => {
    renderFeature(false)
    expect(screen.getByText('Example preview')).toBeInTheDocument()
    expect(screen.queryByText('Real AI content')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request ai access/i })).toHaveAttribute('href', '/app/settings#ai-access')
  })
  it('renders children with AI access', () => {
    renderFeature(true)
    expect(screen.getByText('Real AI content')).toBeInTheDocument()
    expect(screen.queryByText('Example preview')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /request ai access/i })).not.toBeInTheDocument()
  })
})
