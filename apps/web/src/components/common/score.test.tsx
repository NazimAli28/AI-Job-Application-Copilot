import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreRing, scoreTone } from './score'

describe('ScoreRing', () => {
  it('shows the rounded score', () => {
    render(<ScoreRing score={72.6} />)
    expect(screen.getByText('73')).toBeInTheDocument()
  })
  it('clamps scores above 100', () => {
    render(<ScoreRing score={150} />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })
  it('clamps scores below 0', () => {
    render(<ScoreRing score={-20} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
  it('renders the label', () => {
    render(<ScoreRing score={50} label="Fit" />)
    expect(screen.getByText('Fit')).toBeInTheDocument()
  })
  it('picks tones by threshold', () => {
    expect(scoreTone(80)).toBe('text-success')
    expect(scoreTone(60)).toBe('text-warning')
    expect(scoreTone(10)).toBe('text-destructive')
  })
})
