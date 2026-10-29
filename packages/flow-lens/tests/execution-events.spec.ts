import { describe, expect, it } from 'vitest'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import { deriveExecutionEvents, recordedTurnInput } from '../src/client/execution-events.ts'

describe('execution event timeline', () => {
  it('reads user input admitted after the step starts without treating runtime context as human input', () => {
    const entries = [
      { type: 'turn/start', data: { turn: 1 } },
      { type: 'step/start', data: { turn: 1, step: 1 } },
      { type: 'user/message', data: { source: { kind: 'user' }, content: [{ text: 'Inspect this' }] } },
      { type: 'user/message', data: { source: { kind: 'plugin' }, content: [{ text: 'runtime context' }] } },
    ].map((event, index) => ({ type: 'event', event: { ...event, seq: index, time: 1_000 } })) as unknown as readonly SessionEventLikeEntry[]
    expect(recordedTurnInput(deriveExecutionEvents(entries), 1)).toBe('Inspect this')
    expect(recordedTurnInput(deriveExecutionEvents(entries), 2)).toBeNull()
  })
  it('attributes header and plugin records only inside an active turn and step', () => {
    const types = [
      ['turn/start', { turn: 2 }], ['step/start', { turn: 2, step: 1 }],
      ['request/header', { header: { tools: [] } }], ['custom/plugin', { output: 'done' }],
      ['step/end', { turn: 2, step: 1 }], ['turn/end', { turn: 2 }],
      ['custom/plugin', { output: 'outside' }],
    ]
    const entries = types.map(([type, data], index) => ({
      type: 'event', event: { type, data, seq: index + 1, time: 1_000 + index },
    })) as unknown as readonly SessionEventLikeEntry[]
    const rows = deriveExecutionEvents(entries)
    expect(rows[2]).toMatchObject({ turn: 2, step: 1, category: 'prompt', id: 'event:3' })
    expect(rows[3]).toMatchObject({ turn: 2, step: 1, category: 'other' })
    expect(rows[6]).toMatchObject({ turn: null, step: null })
    expect(rows[3]?.raw).toBe(entries[3]?.event)
  })

  it('preserves transient chunks and explicit ownership in a partial history window', () => {
    const entries = [{ type: 'transient', event: {
      type: 'assistant/live-chunk', seq: 20.5, time: 3_000,
      data: { turn: 4, step: 3, chunk: { type: 'text', text: 'live' } },
    } }, { type: 'event', event: {
      type: 'tool/result', seq: 21, time: 3_100,
      data: { turn: 4, step: 3, callId: 'a', content: [] },
    } }] as unknown as readonly SessionEventLikeEntry[]
    expect(deriveExecutionEvents(entries)).toMatchObject([
      { turn: 4, step: 3, transient: true, category: 'model' },
      { turn: 4, step: 3, transient: false, category: 'tool' },
    ])
  })
})
