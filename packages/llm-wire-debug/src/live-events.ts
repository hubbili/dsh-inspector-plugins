/** Wire messages for live model-request capture updates. */

export const TRACE_LIVE_PATH = '/llm-wire-debug/live'

export type TraceUpdatePhase =
  | 'request-ready'
  | 'response-headers-ready'
  | 'response-complete'
  | 'translation-complete'
  | 'transport-error'

export type TraceLiveEvent =
  | {
    readonly type: 'trace-update'
    readonly traceId: string
    readonly phase: TraceUpdatePhase
  }
  | {
    readonly type: 'response-chunk'
    readonly traceId: string
    /** Independently decodable Base64 bytes retained by the configured capture limit. */
    readonly base64: string
  }

/** Parse one complete WebSocket text message and reject unknown fields conservatively. */
export function parseTraceLiveEvent(text: string): TraceLiveEvent | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (value === null || typeof value !== 'object') return undefined
  const event = value as Record<string, unknown>
  if (event.type === 'response-chunk') {
    return typeof event.traceId === 'string' && typeof event.base64 === 'string'
      ? { type: 'response-chunk', traceId: event.traceId, base64: event.base64 }
      : undefined
  }
  if (event.type !== 'trace-update' || typeof event.traceId !== 'string') return undefined
  switch (event.phase) {
    case 'request-ready':
    case 'response-headers-ready':
    case 'response-complete':
    case 'translation-complete':
    case 'transport-error':
      return { type: 'trace-update', traceId: event.traceId, phase: event.phase }
    default:
      return undefined
  }
}
