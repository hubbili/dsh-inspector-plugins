import { describe, expect, it } from 'vitest'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { FlowStepModel, FlowTurnModel } from '../src/client/model.ts'
import { deriveExecutionEvents } from '../src/client/execution-events.ts'
import { LEARNING_STAGES, deriveLearningEvidence, recordedTurnEndReason, withRecordedLifecycle } from '../src/client/learning-stages.ts'
import { en, zh } from '../src/client/locales.ts'

const step: FlowStepModel = {
  step: 2, status: 'complete', hasOverlap: false,
  prompts: [{ id: 'prompt:20', kind: 'prompt', status: 'complete', durationMs: null,
    system: 'Translate accurately.', tools: [], config: {}, available: true, data: {} }],
  requests: [{ id: 'request:20', kind: 'request', attempt: 1, status: 'complete', startedAt: 2_000,
    completedAt: 3_000, durationMs: 1_000, systemLength: 21, toolSchemaCount: 0, data: {} }],
  response: { id: 'response:21', kind: 'response', status: 'complete', startedAt: 2_000, completedAt: 3_000,
    durationMs: 1_000, text: '你好', reasoning: '', toolCallCount: 0, data: {} },
  tools: [],
}
const turn: FlowTurnModel = { turn: 1, prompt: 'Hello', status: 'complete', steps: [step], durationMs: 1_000 }

function records() {
  const rows = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'user/message', data: { content: [{ type: 'text', text: 'Earlier input' }] } },
    { type: 'step/end', data: { turn: 1, step: 1 } },
    { type: 'step/start', data: { turn: 1, step: 2 } },
    { type: 'system/message', data: { content: [{ type: 'text', text: 'Translate accurately.' }] } },
    { type: 'request/header', data: { config: { provider: 'example', model: 'example' } } },
    { type: 'assistant/message', data: { content: [{ type: 'text', text: '你好' }] } },
    { type: 'step/end', data: { turn: 1, step: 2 } },
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
    { type: 'turn/start', data: { turn: 2 } },
    { type: 'turn/end', data: { turn: 2, reason: { kind: 'blocked' } } },
  ]
  return deriveExecutionEvents(rows.map((event, index) => ({
    type: 'event', event: { ...event, seq: index + 1, time: 1_000 + index },
  })) as unknown as readonly SessionEventLikeEntry[])
}

describe('beginner learning stages', () => {
  it('keeps six ordered stages, bilingual copy, and relative Harness source references', () => {
    expect(LEARNING_STAGES.map(stage => stage.id)).toEqual(['input', 'prompt', 'request', 'response', 'tools', 'continuation'])
    for (const stage of LEARNING_STAGES) {
      for (const key of [stage.title, stage.explanation, stage.question]) {
        expect(zh[key]).toBeTruthy()
        expect(en[key]).toBeTruthy()
      }
      for (const source of stage.sources) {
        expect(source.path).toMatch(/^packages\/[a-z0-9/-]+\.ts$/)
        expect(source.path.split('/')).not.toContain('..')
        expect(source.symbol.length).toBeGreaterThan(0)
      }
    }
  })

  it('does not attribute another step or turn to the selected stage', () => {
    const evidence = deriveLearningEvidence(turn, step, records())
    expect(evidence.find(row => row.stage.id === 'input')?.records).toEqual([])
    expect(evidence.find(row => row.stage.id === 'prompt')?.records.map(event => event.type)).toEqual(['system/message', 'request/header'])
    expect(evidence.find(row => row.stage.id === 'response')?.nodeId).toBe('response:21')
    expect(evidence.find(row => row.stage.id === 'tools')?.nodeId).toBeUndefined()
    expect(evidence.find(row => row.stage.id === 'continuation')?.records.map(event => event.type)).toEqual(['step/end', 'turn/end'])
  })

  it('supports rejected turns, unavailable history, and no invented tool execution', () => {
    const rejected = { ...turn, turn: 2, steps: [] }
    const evidence = deriveLearningEvidence(rejected, undefined, records())
    expect(evidence.every(row => row.nodeId === undefined)).toBe(true)
    expect(evidence.find(row => row.stage.id === 'input')?.records).toHaveLength(0)
    expect(evidence.find(row => row.stage.id === 'continuation')?.records).toHaveLength(1)
    expect(deriveLearningEvidence(undefined, undefined, []).every(row => row.records.length === 0)).toBe(true)
  })

  it('includes real lifecycle-only rejected turns without pretending a step or request happened', () => {
    const map = withRecordedLifecycle({ turns: [turn], requestCount: 1, toolCount: 0, errorCount: 0, criticalNodeId: null }, records())
    expect(map.turns.map(item => item.turn)).toEqual([1, 2])
    expect(map.turns[1]).toMatchObject({ turn: 2, prompt: null, steps: [], status: 'interrupted' })
    expect(map.requestCount).toBe(1)
    expect(recordedTurnEndReason(2, records())).toBe('blocked')
    expect(recordedTurnEndReason(3, records())).toBeUndefined()
    expect(map.turns[1]).toMatchSnapshot()
  })

  it('uses the durable turn end rather than request or tool errors to label turn completion', () => {
    const map = withRecordedLifecycle({ turns: [{ ...turn, status: 'error' }], requestCount: 1,
      toolCount: 0, errorCount: 1, criticalNodeId: null }, records())
    expect(map.turns[0]?.status).toBe('complete')
    expect(map.errorCount).toBe(1)
    expect(map.turns[0]?.steps).toHaveLength(2)
    expect(map.turns[0]?.steps[0]).toMatchObject({ step: 1, requests: [], response: null, tools: [] })
  })

  it.each(['before request', 'after completed step'] as const)('does not infer turn completion %s without an end record', phase => {
    const loaded = records().filter(event => event.turn === 1 && event.type !== 'turn/end')
    const map = withRecordedLifecycle({ turns: phase === 'before request' ? [] : [turn],
      requestCount: phase === 'before request' ? 0 : 1, toolCount: 0, errorCount: 0, criticalNodeId: null },
    phase === 'before request' ? loaded.slice(0, 1) : loaded)
    expect(map.turns[0]).toMatchObject({ turn: 1, status: 'waiting', durationMs: null })
    expect(map.turns[0]?.steps).toHaveLength(phase === 'before request' ? 0 : 2)
    expect(recordedTurnEndReason(1, loaded)).toBeUndefined()
  })

  it('pins the reading guide and evidence selection without hook execution claims', () => {
    expect(deriveLearningEvidence(turn, step, records()).map(({ stage, records: events, nodeId }) => ({
      title: zh[stage.title], question: zh[stage.question], explanation: zh[stage.explanation],
      sources: stage.sources, hooks: stage.hooks, nodeId,
      records: events.map(event => `${event.seq}:${event.type}`),
    }))).toMatchSnapshot()
  })
})
