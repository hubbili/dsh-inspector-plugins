/** Provider-neutral reconstruction of captured DeepSeek JSON and SSE responses. */

export type ResponseProtocol = 'chat-completions' | 'messages' | 'unknown'

export interface ParseResponseOptions {
  /** Protocol selected by the request URL when the response cannot identify itself. */
  readonly protocolHint?: ResponseProtocol
  /** Whether the capture stopped at its configured byte limit. */
  readonly truncated?: boolean
}

export interface ParsedTextBlock {
  readonly index: number
  readonly type: 'text'
  readonly text: string
}

export interface ParsedReasoningBlock {
  readonly index: number
  readonly type: 'reasoning'
  readonly text: string
  readonly signature?: string
}

export interface ParsedToolCallBlock {
  readonly index: number
  readonly type: 'tool_call'
  readonly providerType?: string
  readonly id?: string
  readonly name?: string
  readonly argumentsRaw: string
  readonly arguments?: unknown
}

export interface ParsedOtherBlock {
  readonly index: number
  readonly type: 'other'
  readonly providerType: string
  readonly value: unknown
}

export type ParsedResponseBlock =
  | ParsedTextBlock
  | ParsedReasoningBlock
  | ParsedToolCallBlock
  | ParsedOtherBlock

/** Stable JSON document written beside each byte-for-byte response capture. */
export interface ParsedModelResponse {
  readonly version: 1
  readonly transport: 'sse' | 'json' | 'text'
  readonly protocol: ResponseProtocol
  readonly eventCount: number
  readonly streamEndObserved: boolean
  readonly truncated: boolean
  readonly id?: string
  readonly model?: string
  readonly role?: string
  readonly content: readonly ParsedResponseBlock[]
  readonly text: string
  readonly reasoning: string
  readonly toolCalls: readonly ParsedToolCallBlock[]
  readonly stopReason?: string | null
  readonly usage?: unknown
  readonly providerErrors?: readonly unknown[]
  readonly parseErrors?: readonly string[]
}

interface SseFrame {
  readonly event?: string
  readonly data: string
}

interface MutableTextBlock {
  readonly index: number
  readonly type: 'text'
  text: string
}

interface MutableReasoningBlock {
  readonly index: number
  readonly type: 'reasoning'
  text: string
  signature?: string
}

interface MutableToolCallBlock {
  readonly index: number
  readonly type: 'tool_call'
  providerType?: string
  id?: string
  name?: string
  argumentsRaw: string
  initialArguments?: unknown
}

interface MutableOtherBlock {
  readonly index: number
  readonly type: 'other'
  readonly providerType: string
  readonly value: unknown
}

type MutableBlock = MutableTextBlock | MutableReasoningBlock | MutableToolCallBlock | MutableOtherBlock

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function integer(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
}

function parseSse(raw: string): readonly SseFrame[] | undefined {
  const normalized = raw.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (!normalized.split('\n').some(line => line.startsWith('data:'))) return undefined
  const frames: SseFrame[] = []
  for (const part of normalized.split(/\n\n+/)) {
    let event: string | undefined
    const data: string[] = []
    for (const line of part.split('\n')) {
      if (line.startsWith(':')) continue
      const separator = line.indexOf(':')
      const field = separator === -1 ? line : line.slice(0, separator)
      const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '')
      if (field === 'event') event = value
      if (field === 'data') data.push(value)
    }
    if (data.length > 0) frames.push({ ...event === undefined ? {} : { event }, data: data.join('\n') })
  }
  return frames
}

function responseProtocol(values: readonly unknown[], hint: ResponseProtocol): ResponseProtocol {
  for (const value of values) {
    const item = record(value)
    if (item === undefined) continue
    if (Array.isArray(item['choices'])) return 'chat-completions'
    const type = string(item['type'])
    if (type === 'message' || type?.startsWith('message_') === true || type?.startsWith('content_block_') === true) {
      return 'messages'
    }
  }
  return hint
}

function parseJsonEvents(frames: readonly SseFrame[], errors: string[]): {
  readonly values: readonly unknown[]
  readonly streamEndObserved: boolean
} {
  const values: unknown[] = []
  let streamEndObserved = false
  frames.forEach((frame, index) => {
    if (frame.data === '[DONE]') {
      streamEndObserved = true
      return
    }
    try {
      const value = JSON.parse(frame.data) as unknown
      values.push(value)
      if (record(value)?.['type'] === 'message_stop') streamEndObserved = true
    } catch (error) {
      errors.push(`SSE event ${index + 1} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
  return { values, streamEndObserved }
}

function parsedArguments(
  block: MutableToolCallBlock,
  errors: string[],
): Pick<ParsedToolCallBlock, 'argumentsRaw' | 'arguments'> {
  const argumentsRaw = block.argumentsRaw !== ''
    ? block.argumentsRaw
    : block.initialArguments === undefined ? '' : JSON.stringify(block.initialArguments)
  if (argumentsRaw === '') return { argumentsRaw }
  try {
    return { argumentsRaw, arguments: JSON.parse(argumentsRaw) as unknown }
  } catch (error) {
    errors.push(`Tool call block ${block.index} contains invalid arguments JSON: ${error instanceof Error ? error.message : String(error)}`)
    return { argumentsRaw }
  }
}

function finalizeBlocks(blocks: readonly MutableBlock[], errors: string[]): readonly ParsedResponseBlock[] {
  return blocks
    .toSorted((left, right) => left.index - right.index)
    .map((block): ParsedResponseBlock => {
      if (block.type !== 'tool_call') return block
      return {
        index: block.index,
        type: 'tool_call',
        ...block.providerType === undefined ? {} : { providerType: block.providerType },
        ...block.id === undefined ? {} : { id: block.id },
        ...block.name === undefined ? {} : { name: block.name },
        ...parsedArguments(block, errors),
      }
    })
}

function blockText(blocks: readonly ParsedResponseBlock[], type: 'text' | 'reasoning'): string {
  return blocks.flatMap(block => block.type === type ? [block.text] : []).join('')
}

function finish(
  base: Omit<ParsedModelResponse, 'content' | 'text' | 'reasoning' | 'toolCalls' | 'parseErrors'>,
  blocks: readonly MutableBlock[],
  errors: string[],
): ParsedModelResponse {
  const content = finalizeBlocks(blocks, errors)
  return {
    ...base,
    content,
    text: blockText(content, 'text'),
    reasoning: blockText(content, 'reasoning'),
    toolCalls: content.filter((block): block is ParsedToolCallBlock => block.type === 'tool_call'),
    ...errors.length === 0 ? {} : { parseErrors: errors },
  }
}

function messageBlock(value: unknown, index: number): MutableBlock {
  const block = record(value)
  const providerType = string(block?.['type']) ?? 'unknown'
  if (providerType === 'text') {
    return { index, type: 'text', text: string(block?.['text']) ?? '' }
  }
  if (providerType === 'thinking' || providerType === 'reasoning') {
    const signature = string(block?.['signature'])
    return {
      index,
      type: 'reasoning',
      text: string(block?.['thinking']) ?? string(block?.['text']) ?? '',
      ...signature === undefined ? {} : { signature },
    }
  }
  if (providerType.endsWith('tool_use')) {
    const id = string(block?.['id'])
    const name = string(block?.['name'])
    return {
      index,
      type: 'tool_call',
      providerType,
      ...id === undefined ? {} : { id },
      ...name === undefined ? {} : { name },
      argumentsRaw: '',
      ...block?.['input'] === undefined ? {} : { initialArguments: block['input'] },
    }
  }
  return { index, type: 'other', providerType, value }
}

function messagesResponse(
  values: readonly unknown[],
  base: Pick<ParsedModelResponse, 'transport' | 'eventCount' | 'streamEndObserved' | 'truncated'>,
  errors: string[],
): ParsedModelResponse {
  const blocks = new Map<number, MutableBlock>()
  let id: string | undefined
  let model: string | undefined
  let role: string | undefined
  let stopReason: string | null | undefined
  let usage: unknown
  const providerErrors: unknown[] = []

  for (const value of values) {
    const event = record(value)
    if (event === undefined) continue
    const type = string(event['type'])
    if (type === 'message') {
      id = string(event['id']) ?? id
      model = string(event['model']) ?? model
      role = string(event['role']) ?? role
      stopReason = string(event['stop_reason']) ?? (event['stop_reason'] === null ? null : stopReason)
      usage = event['usage'] ?? usage
      if (Array.isArray(event['content'])) {
        event['content'].forEach((block, index) => blocks.set(index, messageBlock(block, index)))
      }
      continue
    }
    if (type === 'message_start') {
      const message = record(event['message'])
      id = string(message?.['id']) ?? id
      model = string(message?.['model']) ?? model
      role = string(message?.['role']) ?? role
      usage = message?.['usage'] ?? usage
      continue
    }
    if (type === 'content_block_start') {
      const index = integer(event['index'])
      if (index === undefined) errors.push('Messages content_block_start has no integer index.')
      else blocks.set(index, messageBlock(event['content_block'], index))
      continue
    }
    if (type === 'content_block_delta') {
      const index = integer(event['index'])
      const delta = record(event['delta'])
      if (index === undefined || delta === undefined) {
        errors.push('Messages content_block_delta has no integer index or delta object.')
        continue
      }
      const block = blocks.get(index)
      const deltaType = string(delta['type'])
      if (block?.type === 'text' && deltaType === 'text_delta') block.text += string(delta['text']) ?? ''
      else if (block?.type === 'reasoning' && (deltaType === 'thinking_delta' || deltaType === 'reasoning_delta')) {
        block.text += string(delta['thinking']) ?? string(delta['text']) ?? ''
      } else if (block?.type === 'reasoning' && deltaType === 'signature_delta') {
        block.signature = `${block.signature ?? ''}${string(delta['signature']) ?? ''}`
      } else if (block?.type === 'tool_call' && deltaType === 'input_json_delta') {
        block.argumentsRaw += string(delta['partial_json']) ?? ''
      }
      continue
    }
    if (type === 'message_delta') {
      const delta = record(event['delta'])
      stopReason = string(delta?.['stop_reason']) ?? (delta?.['stop_reason'] === null ? null : stopReason)
      usage = event['usage'] ?? usage
      continue
    }
    if (type === 'error') providerErrors.push(event['error'] ?? value)
  }

  return finish({
    version: 1,
    ...base,
    protocol: 'messages',
    ...id === undefined ? {} : { id },
    ...model === undefined ? {} : { model },
    ...role === undefined ? {} : { role },
    ...stopReason === undefined ? {} : { stopReason },
    ...usage === undefined ? {} : { usage },
    ...providerErrors.length === 0 ? {} : { providerErrors },
  }, [...blocks.values()], errors)
}

function chatResponse(
  values: readonly unknown[],
  base: Pick<ParsedModelResponse, 'transport' | 'eventCount' | 'streamEndObserved' | 'truncated'>,
  errors: string[],
): ParsedModelResponse {
  let id: string | undefined
  let model: string | undefined
  let role: string | undefined
  let stopReason: string | null | undefined
  let usage: unknown
  let text = ''
  let reasoning = ''
  const toolCalls = new Map<number, MutableToolCallBlock>()
  const providerErrors: unknown[] = []

  for (const value of values) {
    const event = record(value)
    if (event === undefined) continue
    id = string(event['id']) ?? id
    model = string(event['model']) ?? model
    usage = event['usage'] ?? usage
    if (event['error'] !== undefined) providerErrors.push(event['error'])
    const first = Array.isArray(event['choices']) ? record(event['choices'][0]) : undefined
    if (first === undefined) continue
    stopReason = string(first['finish_reason']) ?? (first['finish_reason'] === null ? null : stopReason)
    const message = record(first['delta']) ?? record(first['message'])
    if (message === undefined) continue
    role = string(message['role']) ?? role
    text += string(message['content']) ?? ''
    reasoning += string(message['reasoning_content']) ?? string(message['reasoning']) ?? ''
    if (!Array.isArray(message['tool_calls'])) continue
    message['tool_calls'].forEach((candidate, offset) => {
      const call = record(candidate)
      if (call === undefined) return
      const index = integer(call['index']) ?? offset
      const current = toolCalls.get(index) ?? { index: index + 2, type: 'tool_call', argumentsRaw: '' }
      const callId = string(call['id'])
      if (callId !== undefined) current.id = callId
      const fn = record(call['function'])
      const namePart = string(fn?.['name'])
      if (namePart !== undefined) current.name = `${current.name ?? ''}${namePart}`
      current.argumentsRaw += string(fn?.['arguments']) ?? ''
      toolCalls.set(index, current)
    })
  }

  const blocks: MutableBlock[] = []
  if (reasoning !== '') blocks.push({ index: 0, type: 'reasoning', text: reasoning })
  if (text !== '') blocks.push({ index: 1, type: 'text', text })
  blocks.push(...toolCalls.values())
  return finish({
    version: 1,
    ...base,
    protocol: 'chat-completions',
    ...id === undefined ? {} : { id },
    ...model === undefined ? {} : { model },
    ...role === undefined ? {} : { role },
    ...stopReason === undefined ? {} : { stopReason },
    ...usage === undefined ? {} : { usage },
    ...providerErrors.length === 0 ? {} : { providerErrors },
  }, blocks, errors)
}

/**
 * Reconstruct text, reasoning, tool calls, completion metadata, and usage from one raw provider response.
 * @param raw - Exact UTF-8 response body retained by the wire debugger.
 * @param options - Capture completeness and request-derived protocol hint.
 * @returns A pretty-printable and program-readable normalized response.
 */
export function parseModelResponse(raw: string, options: ParseResponseOptions = {}): ParsedModelResponse {
  const truncated = options.truncated ?? false
  const hint = options.protocolHint ?? 'unknown'
  const errors: string[] = []
  const frames = parseSse(raw)
  if (frames !== undefined) {
    const parsed = parseJsonEvents(frames, errors)
    const base = {
      transport: 'sse' as const,
      eventCount: frames.length,
      streamEndObserved: parsed.streamEndObserved,
      truncated,
    }
    const protocol = responseProtocol(parsed.values, hint)
    if (protocol === 'messages') return messagesResponse(parsed.values, base, errors)
    if (protocol === 'chat-completions') return chatResponse(parsed.values, base, errors)
    return finish({ version: 1, ...base, protocol }, [], errors)
  }

  try {
    const value = JSON.parse(raw) as unknown
    const values = [value]
    const base = { transport: 'json' as const, eventCount: 1, streamEndObserved: true, truncated }
    const protocol = responseProtocol(values, hint)
    if (protocol === 'messages') return messagesResponse(values, base, errors)
    if (protocol === 'chat-completions') return chatResponse(values, base, errors)
    const item = record(value)
    const providerErrors = item?.['error'] === undefined ? [] : [item['error']]
    return finish({
      version: 1,
      ...base,
      protocol,
      ...providerErrors.length === 0 ? {} : { providerErrors },
    }, [], errors)
  } catch (error) {
    errors.push(`Response is neither SSE nor JSON: ${error instanceof Error ? error.message : String(error)}`)
    return finish({
      version: 1,
      transport: 'text',
      protocol: hint,
      eventCount: 0,
      streamEndObserved: false,
      truncated,
    }, [], errors)
  }
}
