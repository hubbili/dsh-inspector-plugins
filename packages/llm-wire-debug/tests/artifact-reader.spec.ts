/** Keyless reading models preserve source JSON while separating primary content from metadata. */

import { expect, it } from 'vitest'
import { parseReadableArtifact, readableJson } from '../src/client/artifact-reader.ts'

it('separates Chat Completions messages, tool definitions, parameters, and journal metadata', () => {
  const raw = JSON.stringify({
    model: 'fixture-model', stream: true, temperature: 0.5,
    messages: [
      { role: 'system', content: 'Translate without changing code identifiers.' },
      { role: 'user', content: 'Translate the following document.' },
      { role: 'assistant', tool_calls: [{ id: 'fixture-call', type: 'function', function: { name: 'read_file', arguments: '{"path":"notes.md"}' } }] },
      { role: 'tool', tool_call_id: 'fixture-call', content: 'Document text.' },
    ],
    tools: [{ type: 'function', function: { name: 'read_file', description: 'Read a document.', parameters: { type: 'object', properties: { path: { type: 'string' } } } } }],
    dsh_session_log: { session: 'fixture-session', journal: ['fixture event 1', 'fixture event 2'] },
    custom_extension: { unchanged: 'synthetic-unredacted-value' },
  })
  const before = raw
  const artifact = parseReadableArtifact('request-body.json', raw)
  expect(artifact?.kind).toBe('request')
  if (artifact?.kind !== 'request') throw new Error('request reading model expected')
  expect(artifact.messages.map(message => message.role)).toEqual(['system', 'user', 'assistant', 'tool'])
  expect(artifact.metadata.dsh_session_log).toEqual({ session: 'fixture-session', journal: ['fixture event 1', 'fixture event 2'] })
  expect(artifact.messages[2]?.fields.tool_calls).toEqual([{ id: 'fixture-call', type: 'function', function: { name: 'read_file', arguments: '{"path":"notes.md"}' } }])
  expect(artifact).toMatchSnapshot()
  expect(raw).toBe(before)
})

it('reads Messages system blocks and native tool schemas without requiring Chat fields', () => {
  const raw = JSON.stringify({
    model: 'fixture-messages-model', max_tokens: 4096, thinking: { type: 'enabled' },
    system: [{ type: 'text', text: 'Translate faithfully.' }],
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Keep formatting.' }] }],
    tools: [{ name: 'write_file', description: 'Save the translation.', input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } }],
  })
  const artifact = parseReadableArtifact('request-body.json', raw)
  expect(artifact?.kind).toBe('request')
  if (artifact?.kind !== 'request') throw new Error('request reading model expected')
  expect(artifact.system).toEqual([{ type: 'text', text: 'Translate faithfully.' }])
  expect(artifact.tools[0]?.name).toBe('write_file')
  expect(artifact.tools[0]?.schema).toEqual({ type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } })
  expect(artifact).toMatchSnapshot()
})

it('exposes captured text, public reasoning fields, proposed calls, usage, and parse failures', () => {
  const raw = JSON.stringify({
    version: 1, transport: 'sse', protocol: 'messages',
    model: 'fixture-model', text: 'Translated text.', reasoning: 'Fixture public reasoning field.',
    toolCalls: [{ id: 'fixture-call', name: 'write_file', argumentsRaw: '{"path":"translation.md"}', arguments: { path: 'translation.md' } }],
    content: [{ type: 'text', index: 0, text: 'Translated text.' }],
    stopReason: 'tool_use', usage: { input_tokens: 12, output_tokens: 30 },
    truncated: true, streamEndObserved: false, parseErrors: ['Fixture incomplete SSE'],
    providerErrors: [{ message: 'Fixture service warning' }], eventCount: 3,
  })
  const artifact = parseReadableArtifact('response.parsed.json', raw)
  expect(artifact?.kind).toBe('response')
  if (artifact?.kind !== 'response') throw new Error('response reading model expected')
  expect(artifact.toolCalls[0]?.arguments).toEqual({ path: 'translation.md' })
  expect(artifact.warnings.truncated).toBe(true)
  expect(artifact.warnings.parseErrors).toEqual(['Fixture incomplete SSE'])
  expect(artifact).toMatchSnapshot()
})

it('falls back to raw text for invalid JSON, unsupported files, and unrecognized documents', () => {
  for (const [file, raw] of [
    ['request-body.json', '{'], ['request-body.json', 'null'], ['request-body.json', '[]'],
    ['request-body.json', '{"model":"fixture"}'], ['response.parsed.json', '{"version":2,"text":"future"}'],
    ['response.parsed.json', '{"version":1,"text":42}'], ['response.raw', '{"version":1,"text":"not a parsed file"}'],
    ['curl.sh', 'curl --header "Authorization: fixture-only"'],
  ]) expect(parseReadableArtifact(file, raw)).toBeUndefined()
  expect(parseReadableArtifact(undefined, undefined)).toBeUndefined()
  expect(parseReadableArtifact('request-body.json', undefined)).toBeUndefined()
})

it('keeps unknown fields available and formats absent fields without inventing values', () => {
  const artifact = parseReadableArtifact('request-body.json', '{"messages":[42,{"role":"custom","content":"fixture","extra":true}],"tools":{"future":"field"}}')
  expect(artifact?.kind).toBe('request')
  if (artifact?.kind !== 'request') throw new Error('request reading model expected')
  expect(artifact.messages[0]?.content).toBe(42)
  expect(artifact.messages[1]?.fields).toEqual({ extra: true })
  expect(artifact.metadata.tools).toEqual({ future: 'field' })
  expect(readableJson(undefined)).toBe('')
  expect(readableJson({ unchanged: 'fixture' })).toBe('{\n  "unchanged": "fixture"\n}')
})
