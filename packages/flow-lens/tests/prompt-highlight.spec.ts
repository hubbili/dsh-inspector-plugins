import { describe, expect, it } from 'vitest'
import { highlightTokens, splitPromptBlocks } from '../src/client/prompt-highlight.ts'

describe('prompt display', () => {
  it('preserves CRLF and blank lines within fenced code', () => {
    const text = '# Rules\r\n\r\nUse `read` at /workspace/src.\r\n\r\n```json\r\n{\r\n\r\n  "path": "{{path}}"\r\n}\r\n```\r\nNext paragraph.'
    const blocks = splitPromptBlocks(text)
    expect(blocks.map(block => block.text).join('')).toBe(text)
    expect(blocks.filter(block => block.kind === 'code')).toHaveLength(1)
    expect(blocks).toMatchSnapshot()
  })

  it('keeps prompt and JSON syntax literal, including HTML and escaped strings', () => {
    const text = '<script>alert(1)</script> `read` {{name}} ${path} https://example.com /workspace/src @file.ts'
    const tokens = highlightTokens(text)
    expect(tokens.map(token => token.text).join('')).toBe(text)
    expect(tokens.filter(token => token.kind === 'variable')).toHaveLength(2)
    const json = '{"message": "a\\\"b", "ok": true, "count": -1}'
    const jsonTokens = highlightTokens(json, true)
    expect(jsonTokens.map(token => token.text).join('')).toBe(json)
    expect(jsonTokens.filter(token => token.kind === 'key')).toHaveLength(3)
  })
})
