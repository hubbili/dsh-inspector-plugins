/** Reconstruction tests for both DeepSeek streaming protocols and JSON responses. */

import { expect, it } from 'vitest'
import { parseModelResponse } from '../src/response-parser.ts'

it('assembles Messages SSE text, thinking, tool input, stop reason, and usage', () => {
  const raw = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"message-1","role":"assistant","model":"deepseek","usage":{"input_tokens":12}}}',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"plan"}}',
    'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"hello "}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"world"}}',
    'event: content_block_start\ndata: {"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"call-1","name":"bash","input":{}}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\\"command\\":\\"date\\"}"}}',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":9}}',
    'event: message_stop\ndata: {"type":"message_stop"}',
  ].join('\n\n')

  expect(parseModelResponse(raw)).toMatchObject({
    transport: 'sse',
    protocol: 'messages',
    eventCount: 10,
    streamEndObserved: true,
    id: 'message-1',
    model: 'deepseek',
    role: 'assistant',
    text: 'hello world',
    reasoning: 'plan',
    stopReason: 'tool_use',
    usage: { output_tokens: 9 },
    toolCalls: [{ id: 'call-1', name: 'bash', arguments: { command: 'date' } }],
  })
})

it('assembles Chat Completions SSE deltas and observes the done marker', () => {
  const raw = [
    'data: {"id":"chat-1","model":"deepseek-chat","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"check "},"finish_reason":null}]}',
    'data: {"choices":[{"index":0,"delta":{"reasoning_content":"facts"},"finish_reason":null}]}',
    'data: {"choices":[{"index":0,"delta":{"content":"answer"},"finish_reason":null}]}',
    'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"bash","arguments":"{\\"command\\":"}}]},"finish_reason":null}]}',
    'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"date\\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"completion_tokens":8}}',
    'data: [DONE]',
  ].join('\n\n')

  expect(parseModelResponse(raw)).toMatchObject({
    transport: 'sse',
    protocol: 'chat-completions',
    eventCount: 6,
    streamEndObserved: true,
    text: 'answer',
    reasoning: 'check facts',
    stopReason: 'tool_calls',
    usage: { completion_tokens: 8 },
    toolCalls: [{ id: 'call-1', name: 'bash', arguments: { command: 'date' } }],
  })
})

it('normalizes a non-streaming Messages response and preserves unknown content blocks', () => {
  const raw = JSON.stringify({
    id: 'message-2',
    type: 'message',
    role: 'assistant',
    model: 'deepseek',
    content: [
      { type: 'thinking', thinking: 'reason' },
      { type: 'text', text: 'result' },
      { type: 'server_tool_use', id: 'server-1', name: 'web_search', input: { query: 'weather' } },
      { type: 'web_search_tool_result', content: [{ title: 'forecast' }] },
    ],
    stop_reason: 'end_turn',
    usage: { output_tokens: 4 },
  })

  expect(parseModelResponse(raw)).toMatchObject({
    transport: 'json',
    protocol: 'messages',
    streamEndObserved: true,
    text: 'result',
    reasoning: 'reason',
    toolCalls: [{ providerType: 'server_tool_use', name: 'web_search', arguments: { query: 'weather' } }],
    content: [{ type: 'reasoning' }, { type: 'text' }, { type: 'tool_call' }, {
      type: 'other', providerType: 'web_search_tool_result',
    }],
  })
})

it('returns a readable parse error for truncated tool arguments', () => {
  const raw = [
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","name":"bash","input":{}}}',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"command\\":"}}',
  ].join('\n\n')

  expect(parseModelResponse(raw, { truncated: true, protocolHint: 'messages' })).toMatchObject({
    truncated: true,
    streamEndObserved: false,
    toolCalls: [{ name: 'bash', argumentsRaw: '{"command":' }],
    parseErrors: [expect.stringContaining('invalid arguments JSON')],
  })
})
