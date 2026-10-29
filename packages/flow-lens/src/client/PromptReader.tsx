/** Readable prompt blocks and escaped JSON syntax for execution inspection. */
import { useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { highlightTokens, splitPromptBlocks } from './prompt-highlight.ts'

function Tokens({ text, json = false }: { text: string; json?: boolean }) {
  const tokens = useMemo(() => highlightTokens(text, json), [text, json])
  return <>{tokens.map((token, index) => <span key={index} className={`fl-syntax-${token.kind}`}>{token.text}</span>)}</>
}

/**
 * Display JSON as escaped colored text, retaining its complete contents.
 * @param props - Formatted JSON text.
 * @returns A syntax-highlighted preformatted block.
 */
export function JsonHighlight({ text }: { text: string }) {
  return <pre className="fl-highlight-json"><Tokens text={text} json /></pre>
}

/**
 * Inspect a recorded prompt by paragraphs or as its original text.
 * @param props - Original prompt and localized reader labels.
 * @returns A reader with block positions, syntax colors, and original-text mode.
 */
export function PromptReader({ text, t }: { text: string; t: PropsLocale<'flowLens'>['t'] }) {
  const [raw, setRaw] = useState(false)
  const blocks = useMemo(() => splitPromptBlocks(text), [text])
  return <div className="fl-prompt-reader">
    <div className="fl-reader-toolbar">
      <span>{t('highlight.blocks', { count: blocks.length })}</span>
      <button type="button" className="fl-button" aria-pressed={raw} onClick={() => { setRaw(value => !value) }}>
        {t(raw ? 'highlight.readable' : 'highlight.original')}
      </button>
    </div>
    <div className="fl-reader-legend">
      <span className="fl-syntax-code">{t('highlight.code')}</span>
      <span className="fl-syntax-variable">{t('highlight.variable')}</span>
      <span className="fl-syntax-tag">{t('highlight.tag')}</span>
      <span className="fl-syntax-path">{t('highlight.path')}</span>
    </div>
    {text === '' ? <p>{t('prompt.emptySystem')}</p> : raw ? <pre>{text}</pre>
      : <div className="fl-reader-blocks">{blocks.map((block, index) => <section
        className={`fl-reader-block fl-reader-${block.kind} fl-reader-tone-${index % 3}`} key={index}>
        <div className="fl-reader-block-head"><span>{t(`highlight.${block.kind}`)} · {index + 1}</span>
          <span>{t('highlight.line', { line: block.line })}</span></div>
        <pre><Tokens text={block.text} /></pre>
      </section>)}</div>}
  </div>
}
