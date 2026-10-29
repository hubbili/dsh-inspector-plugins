/** Lossless-source, derived reading models for request bodies and reconstructed responses. */

interface JsonRecord { readonly [key: string]: unknown }

/** One request message retains its content and all additional message fields. */
export interface ReadableMessage {
  readonly role: string | undefined
  readonly content: unknown
  readonly fields: JsonRecord
}

/** Tool definitions can use Messages names or Chat Completions function fields. */
export interface ReadableTool {
  readonly name: string | undefined
  readonly description: string | undefined
  readonly schema: unknown
  readonly raw: unknown
}

/** Additional request fields remain available in folded metadata, including journal extensions. */
export interface ReadableRequest {
  readonly kind: 'request'
  readonly model: unknown
  readonly system: unknown
  readonly messages: readonly ReadableMessage[]
  readonly tools: readonly ReadableTool[]
  readonly parameters: JsonRecord
  readonly metadata: JsonRecord
}

/** Recorded tool calls describe model output, not evidence of tool execution. */
export interface ReadableToolCall {
  readonly name: string | undefined
  readonly id: string | undefined
  readonly arguments: unknown
  readonly raw: unknown
}

/** Response reading exposes only fields already present in the parsed capture. */
export interface ReadableResponse {
  readonly kind: 'response'
  readonly text: string
  readonly reasoning: string
  readonly toolCalls: readonly ReadableToolCall[]
  readonly usage: unknown
  readonly stopReason: unknown
  readonly warnings: JsonRecord
  readonly metadata: JsonRecord
  readonly blocks: unknown
}

/** Only final request JSON and the plugin's versioned parsed response have reading models. */
export type ReadableArtifact = ReadableRequest | ReadableResponse

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function except(value: JsonRecord, names: readonly string[]): JsonRecord {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !names.includes(key)))
}

function readableRequest(value: JsonRecord): ReadableRequest | undefined {
  if (!Array.isArray(value.messages)) return undefined
  const parameterNames = ['stream', 'temperature', 'top_p', 'max_tokens', 'thinking', 'reasoning_effort', 'tool_choice', 'parallel_tool_calls']
  return {
    kind: 'request',
    model: value.model,
    system: value.system,
    messages: value.messages.map(message => {
      const entry = record(message)
      return entry === undefined
        ? { role: undefined, content: message, fields: {} }
        : { role: string(entry.role), content: entry.content, fields: except(entry, ['role', 'content']) }
    }),
    tools: Array.isArray(value.tools) ? value.tools.map(tool => {
      const entry = record(tool)
      const definition = record(entry?.function) ?? entry
      return { name: string(definition?.name), description: string(definition?.description), schema: definition?.parameters ?? definition?.input_schema, raw: tool }
    }) : [],
    parameters: Object.fromEntries(Object.entries(value).filter(([key]) => parameterNames.includes(key))),
    metadata: except(value, ['model', 'system', 'messages', ...Array.isArray(value.tools) ? ['tools'] : [], ...parameterNames]),
  }
}

function readableResponse(value: JsonRecord): ReadableResponse | undefined {
  if (value.version !== 1 || typeof value.text !== 'string') return undefined
  return {
    kind: 'response',
    text: value.text,
    reasoning: string(value.reasoning) ?? '',
    toolCalls: Array.isArray(value.toolCalls) ? value.toolCalls.map(tool => {
      const entry = record(tool)
      return { name: string(entry?.name), id: string(entry?.id), arguments: entry?.arguments ?? entry?.argumentsRaw, raw: tool }
    }) : [],
    usage: value.usage,
    stopReason: value.stopReason,
    warnings: Object.fromEntries(Object.entries(value).filter(([key]) => ['parseErrors', 'providerErrors', 'truncated', 'streamEndObserved'].includes(key))),
    metadata: except(value, ['text', 'reasoning', 'toolCalls', 'usage', 'stopReason', 'content', 'parseErrors', 'providerErrors', 'truncated', 'streamEndObserved']),
    blocks: value.content,
  }
}

/** Parse only supported capture artifacts; invalid JSON remains available as original text.
 * @param file Selected allowlisted filename.
 * @param raw Unchanged file text used separately for copying and raw display.
 * @returns A derived reading model, or undefined for invalid or unsupported documents.
 */
export function parseReadableArtifact(file: string | undefined, raw: string | undefined): ReadableArtifact | undefined {
  if ((file !== 'request-body.json' && file !== 'response.parsed.json') || raw === undefined) return undefined
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  const document = record(value)
  if (document === undefined) return undefined
  return file === 'request-body.json' ? readableRequest(document) : readableResponse(document)
}

/** Pretty-print derived JSON fields without changing or reserializing the source file.
 * @param value A field from the parsed capture.
 * @returns JSON text or an empty string for an absent field.
 */
export function readableJson(value: unknown): string {
  return JSON.stringify(value, undefined, 2) ?? ''
}
