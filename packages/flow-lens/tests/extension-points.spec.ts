import { describe, expect, it } from 'vitest'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import { deriveExecutionEvents } from '../src/client/execution-events.ts'
import { EXTENSION_PHASES, EXTENSION_POINTS, deriveExtensionEvidence } from '../src/client/extension-points.ts'
import { zh, en } from '../src/client/locales.ts'

function records() {
  const events = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'agent/inbox/spliced', data: { target: 'next-turn', inserted: [], removed: [] } },
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'system/message', data: { content: [{ type: 'text', text: 'Translate precisely.' }] } },
    { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Hello' }] } },
    { type: 'request/header', data: { provider: 'deepseek', model: 'example', tools: [] } },
    { type: 'tool/call', data: { callId: 'a', name: 'read', args: { path: 'example.txt' } } },
    { type: 'tool/result', data: { callId: 'a', content: [{ type: 'text', text: 'Hello' }] } },
    { type: 'assistant/message', data: { content: [{ type: 'text', text: '你好' }] } },
    { type: 'step/end', data: { turn: 1, step: 1 } },
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'custom/review', data: { decision: 'allow' } },
  ].map((event, index) => ({ type: 'event', event: { ...event, seq: index + 1, time: 1_000 + index } }))
  return deriveExecutionEvents(events as unknown as readonly SessionEventLikeEntry[])
}

describe('extension reference and related evidence', () => {
  it('has unique entry points, ordered phases, and complete bilingual descriptions', () => {
    expect(new Set(EXTENSION_POINTS.map(point => point.id)).size).toBe(EXTENSION_POINTS.length)
    for (const point of EXTENSION_POINTS) {
      expect(EXTENSION_PHASES).toContain(point.phase)
      expect(zh[point.description]).toBeTruthy()
      expect(en[point.description]).toBeTruthy()
      expect(zh[`extension.mode.${point.mode}`]).toBeTruthy()
      expect(en[`extension.rule.${point.mode}`]).toBeTruthy()
    }
    expect(EXTENSION_PHASES.indexOf('prompt')).toBeLessThan(EXTENSION_PHASES.indexOf('admission'))
  })

  it('retains the full reference for an empty event window without inventing observations', () => {
    const evidence = deriveExtensionEvidence([])
    expect(evidence).toHaveLength(33)
    expect(evidence.every(row => row.events.length === 0)).toBe(true)
  })

  it('associates exact records without treating tool names as backend or hook evidence', () => {
    const events = records()
    const evidence = deriveExtensionEvidence(events)
    const pre = evidence.find(row => row.point.id === 'tools/pre-execute')
    expect(pre?.events.map(event => event.type)).toEqual(['tool/call', 'tool/result'])
    expect(pre?.events[0]).toBe(events[6])
    expect(evidence.find(row => row.point.id === 'ctx.fs / fs/*')?.events).toEqual([])
    expect(evidence.find(row => row.point.id === 'agent/inbox/*')?.events[0]?.type).toBe('agent/inbox/spliced')
    expect(evidence.some(row => row.events.some(event => event.type === 'custom/review'))).toBe(false)
    expect(pre).not.toHaveProperty('status')
    expect(pre).not.toHaveProperty('durationMs')
  })

  it('keeps partial and transient history as related data with no synthetic invocation records', () => {
    const events = records().slice(7)
    const evidence = deriveExtensionEvidence(events)
    expect(evidence.find(row => row.point.id === 'tools/execute')?.events.map(event => event.type)).toEqual(['tool/result'])
    const chunks = deriveExecutionEvents([{ type: 'transient', event: {
      type: 'assistant/live-chunk', seq: 20.5, time: 2_000, data: { turn: 2, step: 1, chunk: { type: 'text', text: 'Hi' } },
    } }] as unknown as readonly SessionEventLikeEntry[])
    expect(deriveExtensionEvidence(chunks).find(row => row.point.id === 'llm/stream')?.events[0]).toMatchObject({ transient: true })
  })

  it('pins the Chinese extension descriptions and explicit evidence labels', () => {
    const evidence = deriveExtensionEvidence(records())
    expect(evidence.map(({ point, events }) => ({
      id: point.id, phase: zh[`extension.phase.${point.phase}`],
      mode: zh[`extension.mode.${point.mode}`], description: zh[point.description],
      relatedRecords: events.map(event => `${event.seq}:${event.type}`),
    }))).toMatchSnapshot()
  })
})
