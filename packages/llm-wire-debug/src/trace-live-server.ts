/** Local WebSocket broadcaster for capture invalidations and retained response bytes. */

import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import WebSocket, { WebSocketServer } from 'ws'
import type { TraceLiveEvent } from './live-events.ts'

const MAX_BUFFERED_BYTES = 1024 * 1024

/** Own all sockets for the raw-capture live view. */
export class TraceLiveServer {
  private readonly server = new WebSocketServer({ noServer: true })
  private closed = false

  /** Upgrade one authenticated HTTP request. */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (this.closed) {
      socket.destroy()
      return
    }
    this.server.handleUpgrade(request, socket, head, (websocket) => {
      websocket.on('error', () => {
        // The WebServer owns socket error logging; this listener prevents an
        // unhandled WebSocket error from terminating the process.
      })
    })
  }

  /** Send one event to responsive clients; slow clients catch up from the HTTP artifacts. */
  publish(event: TraceLiveEvent): void {
    if (this.closed) return
    const payload = JSON.stringify(event)
    for (const socket of this.server.clients) {
      if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > MAX_BUFFERED_BYTES) continue
      socket.send(payload)
    }
  }

  /** Stop accepting events, terminate clients, and wait for the acceptor to close. */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    for (const socket of this.server.clients) socket.terminate()
    const closed = Promise.withResolvers<void>()
    this.server.close((error) => {
      if (error === undefined) closed.resolve()
      else closed.reject(error)
    })
    await closed.promise
  }
}
