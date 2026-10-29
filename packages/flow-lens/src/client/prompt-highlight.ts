/** Lossless display tokens and paragraph groups for recorded prompt text. */

export interface PromptBlock {
  readonly text: string
  readonly kind: 'heading' | 'code' | 'paragraph'
  readonly line: number
}

export interface HighlightToken {
  readonly text: string
  readonly kind: 'text' | 'code' | 'variable' | 'tag' | 'path' | 'key' | 'string' | 'literal'
}

/**
 * Group paragraphs without splitting fenced code or changing recorded bytes.
 * @param text - Original prompt text.
 * @returns Blocks whose concatenated text equals the original input.
 */
export function splitPromptBlocks(text: string): readonly PromptBlock[] {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const blocks: PromptBlock[] = []
  let buffer = ''
  let firstLine = 1
  let fence: string | undefined
  const flush = (): void => {
    if (buffer === '') return
    blocks.push({ text: buffer, line: firstLine, kind: /^\s*(```|~~~)/.test(buffer)
      ? 'code' : /^\s*#{1,6}\s/.test(buffer) ? 'heading' : 'paragraph' })
    buffer = ''
  }
  lines.forEach((line, index) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (buffer === '') firstLine = index + 1
    if (fence === undefined && marker !== undefined) {
      flush()
      firstLine = index + 1
      fence = marker
    } else if (fence !== undefined && marker !== undefined
      && marker[0] === fence[0] && marker.length >= fence.length
      && line.trim() === marker) {
      buffer += line
      fence = undefined
      flush()
      return
    }
    if (fence === undefined && /^\s*#{1,6}\s/.test(line)) {
      flush()
      firstLine = index + 1
    }
    buffer += line
    if (fence === undefined && line.trim() === '') flush()
  })
  flush()
  return blocks
}

/**
 * Identify visible syntax using text spans rather than rendered HTML.
 * @param text - Original prompt or formatted JSON.
 * @param json - Whether JSON tokens should be highlighted.
 * @returns Ordered tokens that preserve the exact input when concatenated.
 */
export function highlightTokens(text: string, json = false): readonly HighlightToken[] {
  const expression = json
    ? /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g
    : /`[^`\n]+`|\{\{[^{}\n]+\}\}|\$\{[^{}\n]+\}|<\/?[a-zA-Z][^>\n]*>|https?:\/\/[^\s<>]+|(?:\/[\w.~-]+){2,}(?:\/[\w.~-]+)*|@[\w./-]+/g
  const tokens: HighlightToken[] = []
  let offset = 0
  for (const match of text.matchAll(expression)) {
    if (match.index > offset) tokens.push({ text: text.slice(offset, match.index), kind: 'text' })
    const value = match[0]
    const kind: HighlightToken['kind'] = json
      ? value.startsWith('"') ? /^\s*:/.test(text.slice(match.index + value.length)) ? 'key' : 'string' : 'literal'
      : value.startsWith('`') ? 'code'
        : value.startsWith('{{') || value.startsWith('${') ? 'variable'
          : value.startsWith('<') ? 'tag' : 'path'
    tokens.push({ text: value, kind })
    offset = match.index + value.length
  }
  if (offset < text.length) tokens.push({ text: text.slice(offset), kind: 'text' })
  return tokens
}
