/** Chronological inspection of the loaded durable and transient Session events. */
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'

export type ExecutionCategory = 'loop' | 'prompt' | 'model' | 'tool' | 'other'

export interface ExecutionEvent {
  readonly id: string
  readonly type: string
  readonly seq: number
  readonly time: number
  readonly turn: number | null
  readonly step: number | null
  readonly category: ExecutionCategory
  readonly transient: boolean
  readonly data: unknown
  readonly raw: unknown
}

function category(type: string): ExecutionCategory {
  if (type.startsWith('turn/') || type.startsWith('step/') || type.startsWith('agent/')) return 'loop'
  if (type === 'system/message' || type === 'user/message' || type === 'request/header' || type === 'request/context'
    || type.startsWith('context/') || type.startsWith('compaction/')) return 'prompt'
  if (type.startsWith('assistant/') || type.startsWith('request/')) return 'model'
  if (type.startsWith('tool/')) return 'tool'
  return 'other'
}

/**
 * Read committed human input even when admission happens after step/start.
 * @param events - Loaded event timeline.
 * @param turn - Turn to inspect.
 * @returns Human input text, or null when absent from the loaded records.
 */
export function recordedTurnInput(events: readonly ExecutionEvent[], turn: number): string | null {
  const texts = events.filter(event => event.turn === turn && event.type === 'user/message').flatMap(event => {
    const message = event.data as { source?: { kind?: string }; content?: readonly { text?: string }[] }
    return message.source?.kind === 'user'
      ? (message.content ?? []).flatMap(block => typeof block.text === 'string' ? [block.text] : [])
      : []
  })
  return texts.length === 0 ? null : texts.join('\n\n')
}

/**
 * Keep every loaded event and inherit turn/step only while their lifecycle is open.
 * @param entries - Ordered Session window, including transient stream chunks.
 * @returns Events with stable selection IDs and explicit lifecycle ownership.
 */
export function deriveExecutionEvents(entries: readonly SessionEventLikeEntry[]): readonly ExecutionEvent[] {
  let activeTurn: number | null = null
  let activeStep: number | null = null
  return entries.map((entry, index) => {
    const event = entry.event
    const data = event.data as unknown
    const fields = data !== null && typeof data === 'object' ? data as Record<string, unknown> : {}
    const turn = typeof fields.turn === 'number' ? fields.turn : activeTurn
    const step = typeof fields.step === 'number' ? fields.step : activeStep
    if (event.type === 'turn/start') { activeTurn = turn; activeStep = null }
    if (event.type === 'step/start') activeStep = step
    const row: ExecutionEvent = {
      id: entry.type === 'transient' ? `transient:${event.seq}:${index}` : `event:${event.seq}`,
      type: event.type,
      seq: event.seq,
      time: event.time,
      turn,
      step: event.type === 'turn/start' ? null : step,
      category: category(event.type),
      transient: entry.type === 'transient',
      data,
      raw: event,
    }
    if (event.type === 'step/end') activeStep = null
    if (event.type === 'turn/end') { activeTurn = null; activeStep = null }
    return row
  })
}
