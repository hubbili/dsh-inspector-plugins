/** Source-reading guide and recorded evidence for one selected loop step. */
import type { ExecutionEvent } from './execution-events.ts'
import type { FlowMapModel, FlowStatus, FlowStepModel, FlowTurnModel } from './model.ts'
import { recordedTurnInput } from './execution-events.ts'
import type { FlowLensKey } from './locales.ts'

export type LearningStageId = 'input' | 'prompt' | 'request' | 'response' | 'tools' | 'continuation'

/** Repository-relative source location, without assumptions about checkout paths or line numbers. */
export interface LearningSource {
  readonly path: string
  readonly symbol: string
}

/** Educational stage, not an instrumented function invocation. */
export interface LearningStage {
  readonly id: LearningStageId
  readonly title: FlowLensKey
  readonly explanation: FlowLensKey
  readonly question: FlowLensKey
  readonly hooks: readonly string[]
  readonly sources: readonly LearningSource[]
  readonly eventTypes: readonly string[]
  readonly inspect: 'prompt' | 'graph' | 'events'
}

const LOOP_SOURCE = 'packages/core/agent-loop/src/agent.ts'

/**
 * Read the durable end reason independently of request or tool node failures.
 * @param turn - Turn number to inspect.
 * @param events - Loaded records.
 * @returns Recorded reason tag, or undefined when the turn end is outside this window.
 */
export function recordedTurnEndReason(turn: number, events: readonly ExecutionEvent[]): string | undefined {
  const end = events.findLast(event => event.turn === turn && event.type === 'turn/end')
  return (end?.data as { reason?: { kind?: string } } | undefined)?.reason?.kind
}

/**
 * Include lifecycle-only turns and steps without creating model requests or tool calls.
 * @param model - Trajectory-derived execution map.
 * @param events - Loaded lifecycle and message records.
 * @returns Map with navigable rejected/empty turns and authoritative recorded turn status.
 */
export function withRecordedLifecycle(model: FlowMapModel, events: readonly ExecutionEvent[]): FlowMapModel {
  const turns = new Map(model.turns.map(turn => [turn.turn, turn]))
  for (const event of events) {
    if (event.turn === null || !['turn/start', 'turn/end', 'step/start', 'step/end'].includes(event.type)) continue
    if (!turns.has(event.turn)) turns.set(event.turn, {
      turn: event.turn, prompt: null, status: 'waiting', steps: [], durationMs: null,
    })
  }
  return { ...model, turns: [...turns.values()].sort((left, right) => left.turn - right.turn).map(turn => {
    const start = events.find(event => event.turn === turn.turn && event.type === 'turn/start')
    const end = events.findLast(event => event.turn === turn.turn && event.type === 'turn/end')
    const reason = recordedTurnEndReason(turn.turn, events)
    const status: FlowStatus = reason === 'completed' ? 'complete' : reason === 'error' ? 'error'
      : reason === 'blocked' || reason === 'aborted' || reason === 'max-tokens' ? 'interrupted'
        : end === undefined ? 'waiting' : turn.status
    const steps = new Map(turn.steps.map(step => [step.step, step]))
    for (const event of events) {
      if (event.turn !== turn.turn || event.step === null || event.type !== 'step/start' || steps.has(event.step)) continue
      steps.set(event.step, { step: event.step, status: 'waiting', requests: [], prompts: [], response: null, tools: [], hasOverlap: false })
    }
    return { ...turn, status, prompt: recordedTurnInput(events, turn.turn) ?? turn.prompt,
      steps: [...steps.values()].sort((left, right) => left.step - right.step),
      durationMs: start === undefined || end === undefined ? null : Math.max(0, end.time - start.time) }
  }) }
}

/** Source-reading order: accepted input, prompt snapshot, request, response, tools, and continuation. */
export const LEARNING_STAGES: readonly LearningStage[] = [
  {
    id: 'input', title: 'learn.input.title', explanation: 'learn.input.explanation', question: 'learn.input.question',
    hooks: ['agent/pre-step'], sources: [{ path: LOOP_SOURCE, symbol: 'preStep() / turn()' }],
    eventTypes: ['user/message', 'agent/inbox/spliced'], inspect: 'events',
  },
  {
    id: 'prompt', title: 'learn.prompt.title', explanation: 'learn.prompt.explanation', question: 'learn.prompt.question',
    hooks: ['system-prompt/assemble', 'ctx.systemPrompt.section()'],
    sources: [{ path: 'packages/core/system-prompt/src/index.ts', symbol: 'SystemPrompt.assemble() / renderPrompt()' },
      { path: LOOP_SOURCE, symbol: 'preStep() / step()' }],
    eventTypes: ['system/message', 'request/header'], inspect: 'prompt',
  },
  {
    id: 'request', title: 'learn.request.title', explanation: 'learn.request.explanation', question: 'learn.request.question',
    hooks: ['agent/request', 'llm/stream'],
    sources: [{ path: LOOP_SOURCE, symbol: 'prepareRequest() / buildRequest() / step()' },
      { path: 'packages/llm/llm/src/index.ts', symbol: 'LlmRuntime.prepareCall() / stream()' }],
    eventTypes: ['request/header', 'request/context', 'assistant/attempt'], inspect: 'graph',
  },
  {
    id: 'response', title: 'learn.response.title', explanation: 'learn.response.explanation', question: 'learn.response.question',
    hooks: ['agent/assistant-stream'],
    sources: [{ path: 'packages/core/agent-loop/src/assistant-stream.ts', symbol: 'AssistantStreamAttempt' },
      { path: LOOP_SOURCE, symbol: 'step()' }],
    eventTypes: ['assistant/message', 'assistant/attempt', 'assistant/live-chunk'], inspect: 'graph',
  },
  {
    id: 'tools', title: 'learn.tools.title', explanation: 'learn.tools.explanation', question: 'learn.tools.question',
    hooks: ['tools/pre-execute', 'tools/execute', 'tools/post-execute'],
    sources: [{ path: 'packages/core/agent-loop/src/tool-calls.ts', symbol: 'executeToolCalls()' },
      { path: 'packages/core/tools/src/index.ts', symbol: 'ToolRuntime.execute()' }],
    eventTypes: ['tool/call', 'tool/result'], inspect: 'graph',
  },
  {
    id: 'continuation', title: 'learn.continuation.title', explanation: 'learn.continuation.explanation', question: 'learn.continuation.question',
    hooks: ['agent/turn-stopping'], sources: [{ path: LOOP_SOURCE, symbol: 'turn()' }],
    eventTypes: ['step/end', 'turn/end'], inspect: 'events',
  },
]

/** Loaded records and model nodes available for one educational stage. */
export interface LearningEvidence {
  readonly stage: LearningStage
  readonly records: readonly ExecutionEvent[]
  readonly nodeId: string | undefined
}

/**
 * Associate a selected step with recorded facts; never synthesize hook status or decisions.
 * @param turn - Selected turn, including partial history.
 * @param step - Selected step, absent when a turn never entered a step.
 * @param events - Loaded durable and transient records.
 * @returns Six stable learning stages with only matching recorded evidence.
 */
export function deriveLearningEvidence(
  turn: FlowTurnModel | undefined, step: FlowStepModel | undefined, events: readonly ExecutionEvent[],
): readonly LearningEvidence[] {
  const nodeIds: Record<LearningStageId, string | undefined> = {
    input: undefined,
    prompt: step?.prompts[0]?.id,
    request: step?.requests[0]?.id,
    response: step?.response?.id,
    tools: step?.tools[0]?.id,
    continuation: undefined,
  }
  return LEARNING_STAGES.map(stage => ({
    stage,
    nodeId: nodeIds[stage.id],
    records: turn === undefined ? [] : events.filter(event => event.turn === turn.turn
      && (event.step === step?.step || event.step === null
        && (stage.id === 'input' || stage.id === 'continuation'))
      && stage.eventTypes.includes(event.type)),
  }))
}
