import { describe, expect, it } from 'vitest'
import { readFlowSelection, writeFlowSelection } from '../src/client/url-state.ts'

describe('Flow Lens URL selection', () => {
  it('preserves unrelated route parameters', () => {
    const href = writeFlowSelection('https://example.test/session?id=abc#messages', {
      turn: 3,
      step: 2,
      node: 'tool:call/with spaces',
    })

    const parsed = new URL(href)
    expect(parsed.searchParams.get('id')).toBe('abc')
    expect(parsed.hash).toBe('#messages')
    expect(readFlowSelection(href)).toEqual({ turn: 3, step: 2, node: 'tool:call/with spaces' })
  })

  it('rejects malformed coordinates', () => {
    expect(readFlowSelection('https://example.test/?flow-turn=three')).toBeNull()
    expect(readFlowSelection('https://example.test/?flow-turn=1&flow-step=-1')).toBeNull()
  })
})
