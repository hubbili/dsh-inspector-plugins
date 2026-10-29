/** Pure projection from the shared Trajectory snapshot into an execution graph. */

import type {
  AssistantBlock, AssistantMessageNode, ConversationNode, RequestView, RunningToolCall,
  ToolCallBlock, ToolResultNode,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { TrajectorySnapshot } from '@deepseek-ai/dsh-client-ui-trajectory/client'

export type FlowStatus = 'waiting' | 'running' | 'complete' | 'error' | 'interrupted'

export interface FlowUsage {
  input?: number
  output?: number
  reasoning?: number
  cacheRead?: number
  cacheWrite?: number
}

export interface FlowRequestNode {
  id: string
  kind: 'request'
  attempt: number
  status: FlowStatus
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  provider?: string
  model?: string
  systemLength: number
  toolSchemaCount: number
  usage?: FlowUsage
  data: unknown
}

/** Prepared system text and tool definitions recorded for one generation attempt. */
export interface FlowPromptNode {
  id: string
  kind: 'prompt'
  status: FlowStatus
  durationMs: null
  system: string
  tools: readonly unknown[]
  config: unknown
  available: boolean
  data: unknown
}

export interface FlowResponseNode {
  id: string
  kind: 'response'
  status: FlowStatus
  startedAt: number | null
  completedAt: number | null
  durationMs: number | null
  text: string
  reasoning: string
  toolCallCount: number
  data: unknown
}

export interface FlowToolNode {
  id: string
  kind: 'tool'
  callId: string
  name: string
  status: FlowStatus
  startedAt: number | null
  completedAt: number | null
  durationMs: number | null
  argsRaw: string
  result: string
  isError: boolean
  children: readonly FlowToolNode[]
  data: unknown
}

export type FlowNode = FlowPromptNode | FlowRequestNode | FlowResponseNode | FlowToolNode

export interface FlowStepModel {
  step: number
  status: FlowStatus
  requests: readonly FlowRequestNode[]
  prompts: readonly FlowPromptNode[]
  response: FlowResponseNode | null
  tools: readonly FlowToolNode[]
  hasOverlap: boolean
}

export interface FlowTurnModel {
  turn: number
  prompt: string | null
  status: FlowStatus
  steps: readonly FlowStepModel[]
  durationMs: number | null
}

export interface FlowMapModel {
  turns: readonly FlowTurnModel[]
  requestCount: number
  toolCount: number
  errorCount: number
  criticalNodeId: string | null
}

interface UsageLike {
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

function finite(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null
}

function duration(start: number | null, end: number | null): number | null {
  return start === null || end === null ? null : Math.max(0, end - start)
}

function usage(value: unknown): FlowUsage | undefined {
  const source = value as UsageLike | undefined
  if (source === undefined) return undefined
  const result: FlowUsage = {
    ...(source.inputTokens === undefined ? {} : { input: source.inputTokens }),
    ...(source.outputTokens === undefined ? {} : { output: source.outputTokens }),
    ...(source.reasoningTokens === undefined ? {} : { reasoning: source.reasoningTokens }),
    ...(source.cacheReadTokens === undefined ? {} : { cacheRead: source.cacheReadTokens }),
    ...(source.cacheWriteTokens === undefined ? {} : { cacheWrite: source.cacheWriteTokens }),
  }
  return Object.keys(result).length === 0 ? undefined : result
}

function contentText(content: readonly unknown[]): string {
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block)
      continue
    }
    if (block === null || typeof block !== 'object') continue
    const record = block as Record<string, unknown>
    if (typeof record.text === 'string') parts.push(record.text)
    else if (typeof record.content === 'string') parts.push(record.content)
  }
  return parts.join('\n')
}

function assistantText(blocks: readonly AssistantBlock[], kind: 'text' | 'reasoning'): string {
  return blocks.flatMap(block => block.kind === kind ? [block.text] : []).join('\n')
}

function requestNode(request: RequestView, attempt: number): FlowRequestNode {
  const startedAt = finite(request.startedAt) ?? 0
  const completedAt = finite(request.completedAt)
  const requestUsage = usage(request.usage)
  const config = request.requestConfig ?? request.providerMetadata ??
    (request.purpose === 'assistant' ? request.prompt?.config : undefined)
  return {
    id: `request:${request.startSeq}`,
    kind: 'request',
    attempt,
    status: request.status,
    startedAt,
    completedAt,
    durationMs: duration(startedAt, completedAt),
    ...(config?.provider === undefined ? {} : { provider: config.provider }),
    ...(config?.model === undefined ? {} : { model: config.model }),
    systemLength: request.purpose === 'assistant' ? request.prompt?.system.length ?? 0 : 0,
    toolSchemaCount: request.purpose === 'assistant' ? request.prompt?.tools.length ?? 0 : 0,
    ...(requestUsage === undefined ? {} : { usage: requestUsage }),
    data: request,
  }
}

function promptNode(request: Extract<RequestView, { purpose: 'assistant' }>): FlowPromptNode {
  return {
    id: `prompt:${request.startSeq}`,
    kind: 'prompt',
    status: request.prompt === undefined ? 'waiting' : 'complete',
    durationMs: null,
    system: request.prompt?.system ?? '',
    tools: request.prompt?.tools ?? [],
    config: request.prompt?.config,
    available: request.prompt !== undefined,
    data: { prompt: request.prompt, change: request.promptChange },
  }
}

function responseNode(
  turn: number,
  step: number,
  assistant: AssistantMessageNode | undefined,
  partial: TrajectorySnapshot['partial'],
): FlowResponseNode | null {
  const isPartial = assistant === undefined && partial?.turn === turn && partial.step === step
  const blocks = assistant?.blocks ?? (isPartial ? partial.blocks : undefined)
  if (blocks === undefined) return null
  const startedAt = finite(assistant?.timing?.stepStartTime)
  const completedAt = finite(assistant?.timing?.completedTime ?? assistant?.time)
  return {
    id: assistant === undefined ? `response:partial:${turn}:${step}` : `response:${assistant.seq}`,
    kind: 'response',
    status: assistant?.interrupted === true ? 'interrupted' : isPartial ? 'running' : 'complete',
    startedAt,
    completedAt,
    durationMs: duration(startedAt, completedAt),
    text: assistantText(blocks, 'text'),
    reasoning: assistantText(blocks, 'reasoning'),
    toolCallCount: blocks.filter(block => block.kind === 'tool-call').length,
    data: assistant ?? partial,
  }
}

function rootCalls(
  turn: number,
  step: number,
  assistant: AssistantMessageNode | undefined,
  partial: TrajectorySnapshot['partial'],
  running: readonly RunningToolCall[],
  byId: ReadonlyMap<string, ToolCallBlock>,
): readonly ToolCallBlock[] {
  const blocks = assistant?.blocks ??
    (partial?.turn === turn && partial.step === step ? partial.blocks : [])
  const ids = blocks.flatMap(block => block.kind === 'tool-call' ? [block.callId] : [])
  const roots: ToolCallBlock[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const call = byId.get(id)
    if (call !== undefined && !seen.has(id)) {
      roots.push(call)
      seen.add(id)
    }
  }
  for (const call of running) {
    if (call.turn === turn && call.step === step && call.parentCallId === undefined && !seen.has(call.callId)) {
      roots.push(call)
      seen.add(call.callId)
    }
  }
  return roots
}

function toolNode(
  call: ToolCallBlock,
  childrenByParent: ReadonlyMap<string, readonly ToolCallBlock[]>,
  visiting: ReadonlySet<string> = new Set(),
): FlowToolNode {
  const cycle = visiting.has(call.callId)
  const next = new Set(visiting)
  next.add(call.callId)
  const settled = 'kind' in call
  const startedAt = finite(settled ? call.callTime : call.time)
  const completedAt = settled ? finite(call.time) : null
  const nested = cycle ? [] : call.subCalls.length > 0
    ? call.subCalls
    : childrenByParent.get(call.callId) ?? []
  if (settled) return {
    id: `tool:${call.callId}`,
    kind: 'tool',
    callId: call.callId,
    name: call.call?.name ?? call.callId,
    status: call.isError ? 'error' : 'complete',
    startedAt,
    completedAt,
    durationMs: duration(startedAt, completedAt),
    argsRaw: call.call?.argsRaw ?? '',
    result: contentText(call.content),
    isError: call.isError,
    children: nested.map(child => toolNode(child, childrenByParent, next)),
    data: call,
  }
  return {
    id: `tool:${call.callId}`,
    kind: 'tool',
    callId: call.callId,
    name: call.name,
    status: 'running',
    startedAt,
    completedAt,
    durationMs: null,
    argsRaw: call.argsRaw,
    result: '',
    isError: false,
    children: nested.map(child => toolNode(child, childrenByParent, next)),
    data: call,
  }
}

function flattenTools(tools: readonly FlowToolNode[]): readonly FlowToolNode[] {
  return tools.flatMap(tool => [tool, ...flattenTools(tool.children)])
}

function overlaps(tools: readonly FlowToolNode[]): boolean {
  const intervals = tools
    .filter(tool => tool.startedAt !== null && tool.completedAt !== null)
    .map(tool => ({ start: tool.startedAt as number, end: tool.completedAt as number }))
    .sort((left, right) => left.start - right.start)
  let latestEnd = Number.NEGATIVE_INFINITY
  for (const interval of intervals) {
    if (interval.start < latestEnd) return true
    latestEnd = Math.max(latestEnd, interval.end)
  }
  return false
}

function lastStatus(steps: readonly FlowStepModel[]): FlowStatus {
  return steps.at(-1)?.status ?? 'waiting'
}

function stepStatus(
  requests: readonly FlowRequestNode[],
  response: FlowResponseNode | null,
  tools: readonly FlowToolNode[],
  hasTurnError: boolean,
): FlowStatus {
  if (hasTurnError) return 'error'
  if (response?.status === 'interrupted') return 'interrupted'
  const nodes: readonly FlowNode[] = [...requests, ...(response === null ? [] : [response]), ...flattenTools(tools)]
  if (nodes.some(node => node.status === 'running')) return 'running'
  if (nodes.some(node => node.status === 'error')) return 'error'
  return nodes.length === 0 ? 'waiting' : 'complete'
}

function turnPrompt(
  turn: number,
  starts: ReadonlyMap<number, number>,
  nodes: readonly ConversationNode[],
): string | null {
  const start = starts.get(turn)
  if (start === undefined) return null
  const priorStart = [...starts.entries()]
    .filter(([candidate]) => candidate < turn)
    .map(([, seq]) => seq)
    .sort((left, right) => right - left)[0] ?? Number.NEGATIVE_INFINITY
  const inputs = nodes.filter(
    (node): node is Extract<ConversationNode, { kind: 'user' | 'steering' }> =>
      (node.kind === 'user' || node.kind === 'steering')
      && node.seq > priorStart && node.seq <= start,
  )
  const text = inputs.map(node => contentText(node.content)).filter(Boolean).join('\n\n')
  return text === '' ? null : text
}

/** Derive the complete loaded execution map without copying Trajectory's presentation layout. */
export function deriveFlowMap(snapshot: TrajectorySnapshot): FlowMapModel {
  const assistantRequests = snapshot.requests.filter(
    (request): request is Extract<RequestView, { purpose: 'assistant' }> => request.purpose === 'assistant',
  )
  const assistants = snapshot.eventNodes.filter(
    (node): node is AssistantMessageNode => node.kind === 'assistant',
  )
  const results = snapshot.eventNodes.filter(
    (node): node is ToolResultNode => node.kind === 'tool-result',
  )
  const byId = new Map<string, ToolCallBlock>()
  const childrenByParent = new Map<string, ToolCallBlock[]>()
  const indexCall = (call: ToolCallBlock): void => {
    byId.set(call.callId, call)
    if (call.parentCallId !== undefined) {
      const children = childrenByParent.get(call.parentCallId) ?? []
      children.push(call)
      childrenByParent.set(call.parentCallId, children)
    }
    for (const child of call.subCalls) indexCall(child)
  }
  for (const result of results) indexCall(result)
  for (const call of snapshot.runningCalls) indexCall(call)

  const turns = new Set<number>()
  const stepsByTurn = new Map<number, Set<number>>()
  const addStep = (turn: number, step: number): void => {
    turns.add(turn)
    const steps = stepsByTurn.get(turn) ?? new Set<number>()
    steps.add(step)
    stepsByTurn.set(turn, steps)
  }
  for (const request of assistantRequests) addStep(request.turn, request.step)
  for (const assistant of assistants) addStep(assistant.turn, assistant.step)
  for (const call of snapshot.runningCalls) addStep(call.turn, call.step)
  if (snapshot.partial !== null) addStep(snapshot.partial.turn, snapshot.partial.step)

  const turnStarts = new Map<number, number>()
  for (const turn of turns) {
    const seqs = [
      ...assistantRequests.filter(request => request.turn === turn).map(request => request.startSeq),
      ...assistants.filter(node => node.turn === turn).map(node => node.seq),
    ]
    if (seqs.length > 0) turnStarts.set(turn, Math.min(...seqs))
  }

  let requestCount = 0
  let toolCount = 0
  let errorCount = 0
  let criticalNodeId: string | null = null
  let criticalDuration = Number.NEGATIVE_INFINITY
  const observe = (node: FlowNode): void => {
    if (node.status === 'error') errorCount += 1
    if (node.durationMs !== null && node.durationMs > criticalDuration) {
      criticalDuration = node.durationMs
      criticalNodeId = node.id
    }
  }

  const modelTurns: FlowTurnModel[] = [...turns].sort((a, b) => a - b).map(turn => {
    const stepModels = [...(stepsByTurn.get(turn) ?? [])].sort((a, b) => a - b).map(step => {
      const matchingRequests = assistantRequests
        .filter(request => request.turn === turn && request.step === step)
        .sort((a, b) => a.startSeq - b.startSeq)
        .map((request, index) => requestNode(request, index + 1))
      requestCount += matchingRequests.length
      const assistant = assistants.find(node => node.turn === turn && node.step === step)
      const response = responseNode(turn, step, assistant, snapshot.partial)
      const tools = rootCalls(turn, step, assistant, snapshot.partial, snapshot.runningCalls, byId)
        .map(call => toolNode(call, childrenByParent))
      const allTools = flattenTools(tools)
      toolCount += allTools.length
      for (const node of matchingRequests) observe(node)
      if (response !== null) observe(response)
      for (const node of allTools) observe(node)
      const turnError = snapshot.eventNodes.some(node =>
        node.kind === 'turn-error' && node.turn === turn && node.step === step)
      return {
        step,
        requests: matchingRequests,
        prompts: assistantRequests
          .filter(request => request.turn === turn && request.step === step)
          .sort((a, b) => a.startSeq - b.startSeq)
          .map(promptNode),
        response,
        tools,
        hasOverlap: overlaps(tools),
        status: stepStatus(matchingRequests, response, tools, turnError),
      }
    })
    const times = stepModels.flatMap(step => [
      ...step.requests.flatMap(request => [request.startedAt, request.completedAt]),
      ...(step.response === null ? [] : [step.response.startedAt, step.response.completedAt]),
      ...flattenTools(step.tools).flatMap(tool => [tool.startedAt, tool.completedAt]),
    ]).filter((value): value is number => value !== null)
    return {
      turn,
      prompt: turnPrompt(turn, turnStarts, snapshot.eventNodes),
      status: lastStatus(stepModels),
      steps: stepModels,
      durationMs: times.length < 2 ? null : Math.max(...times) - Math.min(...times),
    }
  })

  return { turns: modelTurns, requestCount, toolCount, errorCount, criticalNodeId }
}

/** Find a selectable node by its stable URL identity. */
export function findFlowNode(model: FlowMapModel, id: string | undefined): FlowNode | null {
  if (id === undefined) return null
  for (const turn of model.turns) {
    for (const step of turn.steps) {
      for (const prompt of step.prompts) if (prompt.id === id) return prompt
      for (const request of step.requests) if (request.id === id) return request
      if (step.response?.id === id) return step.response
      for (const tool of flattenTools(step.tools)) if (tool.id === id) return tool
    }
  }
  return null
}
