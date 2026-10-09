import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage, RegisterPage } from './pages'

const fetchMock = vi.fn()

function renderPage(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('LoginPage validation', () => {
  it('shows errors on empty submit and does not call the API', async () => {
    renderPage(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid email', async () => {
    renderPage(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.queryByText('Enter your password')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('RegisterPage validation', () => {
  it('shows errors on empty submit and does not call the API', async () => {
    renderPage(<RegisterPage />)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Enter your name')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a weak password', async () => {
    renderPage(<RegisterPage />)
    await userEvent.type(screen.getByLabelText('Full name'), 'Jane Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'jane@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'abcdefgh')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Include a number')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
