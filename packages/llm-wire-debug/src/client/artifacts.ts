/** Ordered learning navigation and identity-bound content for captured model requests. */

import type { LlmWireDebugKey } from './locales.ts'

/** Capture summaries do not contain Session identifiers or causal links to Agent steps. */
export interface TraceSummary {
  readonly id: string
  readonly createdAt: string
  readonly files: readonly string[]
}

/** Navigation categories follow request construction, response reading, and diagnostics. */
export type ArtifactGroup = 'request' | 'response' | 'diagnostics'

/** Repository paths and searchable symbols have no runtime trace attribution. */
export interface SourceReference {
  readonly label: LlmWireDebugKey
  readonly path: string
  readonly symbol: string
}

/** Static source references explain file production, not observed callback execution. */
export interface ArtifactDefinition {
  readonly file: string
  readonly group: ArtifactGroup
  readonly label: LlmWireDebugKey
  readonly explanation: LlmWireDebugKey
  readonly phase: LlmWireDebugKey
  readonly focus: LlmWireDebugKey
  readonly source: string
  readonly symbol: string
  readonly coreSources?: readonly SourceReference[]
}

const REQUEST_SOURCES: readonly SourceReference[] = [
  { label: 'help.sourceLoop', path: 'packages/core/agent-loop/src/agent.ts', symbol: 'ReactLoopAgent.step / prepareRequest / buildRequest' },
  { label: 'help.sourceMessagesRequest', path: 'packages/llm/llm-deepseek/src/protocols/messages/serialize.ts', symbol: 'serialize' },
  { label: 'help.sourceChatRequest', path: 'packages/llm/llm-deepseek/src/protocols/chat-completions/serialize.ts', symbol: 'serializeRequest / serializeRequestWithImages' },
]

const RESPONSE_SOURCES: readonly SourceReference[] = [
  { label: 'help.sourceMessagesResponse', path: 'packages/llm/llm-deepseek/src/protocols/messages/sse.ts', symbol: 'parseSse' },
  { label: 'help.sourceChatResponse', path: 'packages/llm/llm-deepseek/src/protocols/chat-completions/sse.ts', symbol: 'parseSse' },
  { label: 'help.sourceLoop', path: 'packages/core/agent-loop/src/agent.ts', symbol: 'ReactLoopAgent.step' },
]

/** File order starts with the complete outgoing body rather than an auxiliary translation. */
export const ARTIFACTS: readonly ArtifactDefinition[] = [
  { file: 'request-body.json', group: 'request', label: 'artifact.request', explanation: 'help.request.what', phase: 'help.request.phase', focus: 'help.request.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'captureRequest / apply', coreSources: REQUEST_SOURCES },
  { file: 'prompt.original.json', group: 'request', label: 'artifact.promptOriginal', explanation: 'help.promptOriginal.what', phase: 'help.promptOriginal.phase', focus: 'help.promptOriginal.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'promptInput / writeTranslation', coreSources: REQUEST_SOURCES },
  { file: 'prompt.zh.md', group: 'request', label: 'artifact.promptZh', explanation: 'help.promptZh.what', phase: 'help.promptZh.phase', focus: 'help.promptZh.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'translationRequest / writeTranslation' },
  { file: 'request-headers.json', group: 'request', label: 'artifact.requestHeaders', explanation: 'help.requestHeaders.what', phase: 'help.requestHeaders.phase', focus: 'help.requestHeaders.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'captureRequest / apply' },
  { file: 'response.parsed.json', group: 'response', label: 'artifact.responseParsed', explanation: 'help.responseParsed.what', phase: 'help.responseParsed.phase', focus: 'help.responseParsed.focus', source: 'packages/llm-wire-debug/src/response-parser.ts', symbol: 'parseModelResponse', coreSources: RESPONSE_SOURCES },
  { file: 'response.raw', group: 'response', label: 'artifact.response', explanation: 'help.response.what', phase: 'help.response.phase', focus: 'help.response.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'captureResponse / writeCapturedResponse', coreSources: RESPONSE_SOURCES },
  { file: 'response-headers.json', group: 'response', label: 'artifact.responseHeaders', explanation: 'help.responseHeaders.what', phase: 'help.responseHeaders.phase', focus: 'help.responseHeaders.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'apply' },
  { file: 'response-meta.json', group: 'response', label: 'artifact.responseMeta', explanation: 'help.responseMeta.what', phase: 'help.responseMeta.phase', focus: 'help.responseMeta.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'writeCapturedResponse' },
  { file: 'curl.sh', group: 'diagnostics', label: 'artifact.curl', explanation: 'help.curl.what', phase: 'help.curl.phase', focus: 'help.curl.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'renderCurl' },
  { file: 'transport-error.txt', group: 'diagnostics', label: 'artifact.transportError', explanation: 'help.transportError.what', phase: 'help.transportError.phase', focus: 'help.transportError.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'apply' },
  { file: 'prompt.zh.error.txt', group: 'diagnostics', label: 'artifact.promptZhError', explanation: 'help.promptZhError.what', phase: 'help.promptZhError.phase', focus: 'help.promptZhError.focus', source: 'packages/llm-wire-debug/src/llm-wire-debug.ts', symbol: 'writeTranslation' },
]

/** Three navigation groups preserve every allowlisted artifact without a long flat tab row. */
export const ARTIFACT_GROUPS: readonly { readonly id: ArtifactGroup; readonly label: LlmWireDebugKey }[] = [
  { id: 'request', label: 'group.request' },
  { id: 'response', label: 'group.response' },
  { id: 'diagnostics', label: 'group.diagnostics' },
]

/** Return capture files in learning order, including captures with only partial response data.
 * @param files Names supplied by the capture API.
 * @returns Recognized artifacts that are available for this trace.
 */
export function availableArtifacts(files: readonly string[]): readonly ArtifactDefinition[] {
  return ARTIFACTS.filter(artifact => files.includes(artifact.file))
}

/** Search trace identifiers and recorded timestamp strings without inspecting secret-bearing files.
 * @param traces Capture summaries in server order.
 * @param query Case-insensitive identifier or timestamp substring.
 * @param timestamp Optional displayed timestamp formatter, for matching the list's locale-specific text.
 * @returns Matching summaries, preserving server order.
 */
export function filterTraces(traces: readonly TraceSummary[], query: string, timestamp?: (trace: TraceSummary) => string): readonly TraceSummary[] {
  const needle = query.trim().toLowerCase()
  return needle.length === 0 ? traces : traces.filter(trace => `${trace.id} ${trace.createdAt} ${timestamp?.(trace) ?? ''}`.toLowerCase().includes(needle))
}

/** A fetch result belongs to one trace and file, even if selection changes before it resolves. */
export interface ArtifactContent {
  readonly traceId: string
  readonly file: string
  readonly text?: string
  readonly error?: string
}

/** Hide stale content immediately, before React runs the next file-loading effect.
 * @param content Most recently settled file read.
 * @param traceId Currently selected trace.
 * @param file Currently selected file.
 * @returns Matching result, or undefined while the selection has no settled result.
 */
export function selectedArtifactContent(content: ArtifactContent | undefined, traceId: string | undefined, file: string | undefined): ArtifactContent | undefined {
  return content?.traceId === traceId && content?.file === file ? content : undefined
}
