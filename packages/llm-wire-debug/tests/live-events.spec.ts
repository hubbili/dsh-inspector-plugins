import { describe, expect, it } from 'vitest'
import { parseTraceLiveEvent } from '../src/live-events.ts'
import { TraceLiveServer } from '../src/trace-live-server.ts'

describe('live capture protocol', () => {
  it('accepts update and response chunk messages', () => {
    expect(parseTraceLiveEvent(JSON.stringify({
      type: 'trace-update', traceId: 'trace-1', phase: 'response-complete',
    }))).toEqual({ type: 'trace-update', traceId: 'trace-1', phase: 'response-complete' })
    expect(parseTraceLiveEvent(JSON.stringify({
      type: 'response-chunk', traceId: 'trace-1', base64: 'aGVsbG8=',
    }))).toEqual({ type: 'response-chunk', traceId: 'trace-1', base64: 'aGVsbG8=' })
  })

  it('rejects malformed or unknown messages', () => {
    expect(parseTraceLiveEvent('{')).toBeUndefined()
    expect(parseTraceLiveEvent(JSON.stringify({ type: 'trace-update', traceId: 1, phase: 'request-ready' }))).toBeUndefined()
    expect(parseTraceLiveEvent(JSON.stringify({ type: 'trace-update', traceId: 'trace-1', phase: 'unknown' }))).toBeUndefined()
  })

  it('closes without clients and ignores later publications', async () => {
    const server = new TraceLiveServer()
    await server.close()
    server.publish({ type: 'trace-update', traceId: 'late', phase: 'request-ready' })
  })
})
