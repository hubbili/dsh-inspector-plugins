/** Extension catalog and related Session evidence; records do not establish hook invocation. */
import type { ExecutionEvent } from './execution-events.ts'
import type { FlowLensKey } from './locales.ts'

/** Ordered runtime stages followed by independent registration categories. */
export const EXTENSION_PHASES = [
  'initialization', 'prompt', 'admission', 'model', 'tools', 'finish', 'observation',
  'providers', 'data', 'ui', 'composition',
] as const

export type ExtensionPhase = typeof EXTENSION_PHASES[number]
export type ExtensionMode = 'waterfall' | 'serial' | 'emit' | 'register' | 'context' | 'compose'

/** Documented entry point, with explicitly related event types rather than inferred execution. */
export interface ExtensionPoint {
  readonly id: string
  readonly phase: ExtensionPhase
  readonly mode: ExtensionMode
  readonly description: FlowLensKey
  readonly evidenceTypes: readonly string[]
}

/** Curated extension points supported by the Harness and the conversation plugin. */
export const EXTENSION_POINTS: readonly ExtensionPoint[] = [
  { id: 'agent/created', phase: 'initialization', mode: 'serial', description: 'extension.created', evidenceTypes: [] },
  { id: 'ctx.systemPrompt.section()', phase: 'prompt', mode: 'register', description: 'extension.section', evidenceTypes: ['system/message'] },
  { id: 'ctx.systemPrompt.variable()', phase: 'prompt', mode: 'register', description: 'extension.variable', evidenceTypes: [] },
  { id: 'system-prompt/assemble', phase: 'prompt', mode: 'waterfall', description: 'extension.assemble', evidenceTypes: ['system/message', 'request/header'] },
  { id: 'agent.inject() / agent.steer()', phase: 'prompt', mode: 'context', description: 'extension.context', evidenceTypes: ['user/message'] },
  { id: 'agent/pre-step', phase: 'admission', mode: 'waterfall', description: 'extension.preStep', evidenceTypes: ['user/message', 'step/start', 'turn/end'] },
  { id: 'agent/request', phase: 'model', mode: 'waterfall', description: 'extension.request', evidenceTypes: ['request/header', 'request/context'] },
  { id: 'agent/request-error', phase: 'model', mode: 'waterfall', description: 'extension.requestError', evidenceTypes: ['assistant/attempt'] },
  { id: 'llm/stream', phase: 'model', mode: 'waterfall', description: 'extension.stream', evidenceTypes: ['assistant/live-chunk', 'assistant/message', 'assistant/attempt'] },
  { id: 'agent/assistant-stream', phase: 'model', mode: 'emit', description: 'extension.assistantStream', evidenceTypes: ['assistant/live-chunk', 'assistant/message', 'assistant/attempt'] },
  { id: 'ctx.tools.register()', phase: 'tools', mode: 'register', description: 'extension.toolRegister', evidenceTypes: ['request/header'] },
  { id: 'tools/pre-execute', phase: 'tools', mode: 'waterfall', description: 'extension.toolPre', evidenceTypes: ['tool/call', 'tool/result'] },
  { id: 'tools/execute', phase: 'tools', mode: 'waterfall', description: 'extension.toolExecute', evidenceTypes: ['tool/call', 'tool/result'] },
  { id: 'tools/post-execute', phase: 'tools', mode: 'waterfall', description: 'extension.toolPost', evidenceTypes: ['tool/result'] },
  { id: 'agent/turn-stopping', phase: 'finish', mode: 'serial', description: 'extension.stopping', evidenceTypes: ['turn/end'] },
  { id: 'agent/inbox/*', phase: 'observation', mode: 'emit', description: 'extension.inbox', evidenceTypes: ['agent/inbox/spliced'] },
  { id: 'agent/status / agent/error', phase: 'observation', mode: 'emit', description: 'extension.status', evidenceTypes: ['turn/start', 'turn/end'] },
  { id: 'tools/result / tools/change', phase: 'observation', mode: 'emit', description: 'extension.toolObserve', evidenceTypes: ['tool/result', 'request/header'] },
  { id: 'ctx.llm', phase: 'providers', mode: 'register', description: 'extension.adapter', evidenceTypes: ['request/header', 'request/context'] },
  { id: 'ctx.fs / fs/*', phase: 'providers', mode: 'register', description: 'extension.fs', evidenceTypes: [] },
  { id: 'ctx.shell', phase: 'providers', mode: 'register', description: 'extension.shell', evidenceTypes: [] },
  { id: 'ctx.terminals', phase: 'providers', mode: 'register', description: 'extension.terminal', evidenceTypes: [] },
  { id: 'ctx.sandbox', phase: 'providers', mode: 'register', description: 'extension.sandbox', evidenceTypes: [] },
  { id: 'ctx.jobs', phase: 'providers', mode: 'register', description: 'extension.jobs', evidenceTypes: [] },
  { id: 'ctx.commands', phase: 'providers', mode: 'register', description: 'extension.commands', evidenceTypes: [] },
  { id: 'ctx.webhookRuntime', phase: 'providers', mode: 'register', description: 'extension.webhook', evidenceTypes: [] },
  { id: 'SessionPersistence', phase: 'data', mode: 'register', description: 'extension.persistence', evidenceTypes: [] },
  { id: 'SessionEventMap / session/event', phase: 'data', mode: 'emit', description: 'extension.session', evidenceTypes: [] },
  { id: 'ctx.sessionProjections', phase: 'data', mode: 'register', description: 'extension.projection', evidenceTypes: [] },
  { id: 'ConversationNodeDefinition + Renderer', phase: 'ui', mode: 'register', description: 'extension.renderer', evidenceTypes: [] },
  { id: 'ctx.slots · conversation.view', phase: 'ui', mode: 'register', description: 'extension.tab', evidenceTypes: [] },
  { id: 'Profile', phase: 'composition', mode: 'compose', description: 'extension.profile', evidenceTypes: [] },
  { id: 'Preset', phase: 'composition', mode: 'compose', description: 'extension.preset', evidenceTypes: [] },
]

/** Related records in the loaded range; absence says nothing about activation or execution. */
export interface ExtensionEvidence {
  readonly point: ExtensionPoint
  readonly events: readonly ExecutionEvent[]
}

/**
 * Associate only documented event types, retaining raw records and loaded ordering.
 * @param events - Loaded Session records, optionally filtered by turn.
 * @returns Catalog with related evidence, without synthesizing hook status or timing.
 */
export function deriveExtensionEvidence(events: readonly ExecutionEvent[]): readonly ExtensionEvidence[] {
  return EXTENSION_POINTS.map(point => ({
    point,
    events: events.filter(event => point.evidenceTypes.includes(event.type)),
  }))
}
