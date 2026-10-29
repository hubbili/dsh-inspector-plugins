import { describe, expect, it } from 'vitest'
import type { TrajectorySnapshot } from '@deepseek-ai/dsh-client-ui-trajectory/client'
import { deriveFlowMap, findFlowNode } from '../src/client/model.ts'

function snapshot(): TrajectorySnapshot {
  return {
    eventLocations: new Map(),
    callSchemas: new Map(),
    partial: null,
    requests: [{
      purpose: 'assistant',
      turn: 1,
      step: 1,
      startSeq: 2,
      startedAt: 1_100,
      completedAt: 1_400,
      status: 'complete',
      prompt: {
        config: { provider: 'deepseek', model: 'deepseek-chat' },
        system: 'Be precise.',
        tools: [],
      },
      usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: 2 },
    }],
    eventNodes: [
      { kind: 'user', seq: 1, time: 1_000, content: [{ type: 'text', text: 'Inspect the project' }], source: {} },
      {
        kind: 'assistant', seq: 3, time: 1_400, turn: 1, step: 1,
        timing: { stepStartTime: 1_100, firstTokenTime: 1_200, completedTime: 1_400 },
        blocks: [
          { kind: 'reasoning', text: 'I should inspect two independent files.' },
          { kind: 'tool-call', callId: 'a', name: 'read', argsRaw: '{"path":"a"}' },
          { kind: 'tool-call', callId: 'b', name: 'read', argsRaw: '{"path":"b"}' },
        ],
      },
      {
        kind: 'tool-result', seq: 6, time: 1_800, callId: 'a', parentCallId: undefined,
        call: { name: 'read', argsRaw: '{"path":"a"}' }, callTime: 1_500,
        content: [{ type: 'text', text: 'A' }], isError: false, subCalls: [],
      },
      {
        kind: 'tool-result', seq: 7, time: 1_900, callId: 'b', parentCallId: undefined,
        call: { name: 'read', argsRaw: '{"path":"b"}' }, callTime: 1_600,
        content: [{ type: 'text', text: 'B' }], isError: false, subCalls: [],
      },
    ],
    runningCalls: [],
  } as unknown as TrajectorySnapshot
}

describe('deriveFlowMap', () => {
  it('builds request, response, and overlapping tool branches from the shared snapshot', () => {
    const model = deriveFlowMap(snapshot())
    const turn = model.turns[0]
    const step = turn?.steps[0]

    expect(turn).toMatchObject({ turn: 1, prompt: 'Inspect the project', status: 'complete' })
    expect(step?.requests[0]).toMatchObject({ provider: 'deepseek', model: 'deepseek-chat', durationMs: 300 })
    expect(step?.prompts[0]).toMatchObject({ system: 'Be precise.', available: true, kind: 'prompt' })
    expect(findFlowNode(model, 'prompt:2')).toBe(step?.prompts[0])
    expect({ prompts: step?.prompts, request: step?.requests[0] }).toMatchSnapshot()
    expect(step?.response).toMatchObject({ status: 'complete', reasoning: 'I should inspect two independent files.' })
    expect(step?.tools.map(tool => tool.name)).toEqual(['read', 'read'])
    expect(step?.hasOverlap).toBe(true)
    expect(model).toMatchObject({ requestCount: 1, toolCount: 2, errorCount: 0 })
  })

  it('finds nodes by the stable identity stored in a deep link', () => {
    const model = deriveFlowMap(snapshot())
    expect(findFlowNode(model, 'tool:b')).toMatchObject({ callId: 'b', result: 'B' })
    expect(findFlowNode(model, 'tool:missing')).toBeNull()
  })
})
