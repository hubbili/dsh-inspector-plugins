/** Beginner-oriented request and response cards derived from unchanged captured JSON. */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReadableArtifact } from './artifact-reader.ts'
import { readableJson } from './artifact-reader.ts'
import { classes as css } from './styles.ts'
import type { LlmWireDebugKey } from './locales.ts'

type Translate = PropsLocale<'llmWireDebug'>['t']

function Value({ value }: { readonly value: unknown }) {
  if (typeof value === 'string') return <pre className={css.readerText}>{value}</pre>
  if (Array.isArray(value)) return <div className={css.readerBlocks}>{value.map((block: unknown, index) => {
    const entry = block !== null && typeof block === 'object' && !Array.isArray(block) ? block as Record<string, unknown> : undefined
    if (entry?.type === 'text' && typeof entry.text === 'string') return <pre className={css.readerText} key={index}>{entry.text}</pre>
    return <pre className={css.readerJson} key={index}>{readableJson(block)}</pre>
  })}</div>
  return <pre className={css.readerJson}>{readableJson(value)}</pre>
}

function Folded({ title, value }: { readonly title: string; readonly value: unknown }) {
  return <details className={css.readerFold}><summary>{title}</summary><Value value={value} /></details>
}

const ROLE_LABELS = new Map<string, LlmWireDebugKey>([
  ['system', 'reader.role.system'], ['developer', 'reader.role.developer'], ['user', 'reader.role.user'], ['assistant', 'reader.role.assistant'], ['tool', 'reader.role.tool'],
])

const ROLE_CLASSES = new Map<string, string>([
  ['system', css.roleSystem], ['developer', css.roleSystem], ['user', css.roleUser], ['assistant', css.roleAssistant], ['tool', css.roleTool],
])

/** Render only captured fields; tool-call cards do not imply execution or success.
 * @param props Derived model and localized labels for this capture view.
 * @returns Reading cards with additional JSON fields available in expandable sections.
 */
export function ArtifactReader({ artifact, t }: { readonly artifact: ReadableArtifact; readonly t: Translate }) {
  if (artifact.kind === 'request') return <div className={css.reader}>
    <section className={css.readerCard}><h3>{t('reader.requestSummary')}</h3><dl className={css.readerSummary}><div><dt>{t('reader.model')}</dt><dd><code>{typeof artifact.model === 'string' ? artifact.model : readableJson(artifact.model)}</code></dd></div><div><dt>{t('reader.messages')}</dt><dd>{artifact.messages.length}</dd></div><div><dt>{t('reader.tools')}</dt><dd>{artifact.tools.length}</dd></div></dl>{Object.keys(artifact.parameters).length > 0 && <Folded title={t('reader.parameters')} value={artifact.parameters} />}</section>
    {artifact.system !== undefined && <section className={css.readerCard}><h3><span className={css.roleSystem}>{t('reader.role.system')}</span> · <code>{t('reader.systemField')}</code></h3><Value value={artifact.system} /></section>}
    <section className={css.readerSection}><h3>{t('reader.messageOrder')}</h3>{artifact.messages.map((message, index) => <article className={css.readerCard} key={index}><h4><span className={ROLE_CLASSES.get(message.role ?? '') ?? css.role}>{t(ROLE_LABELS.get(message.role ?? '') ?? 'reader.role.unknown')}</span><code>{message.role}</code><span className={css.readerIndex}>#{index + 1}</span></h4>{message.content === undefined ? <p className={css.readerHint}>{t('reader.noContent')}</p> : <Value value={message.content} />}{Object.keys(message.fields).length > 0 && <Folded title={t('reader.messageFields')} value={message.fields} />}</article>)}</section>
    {artifact.tools.length > 0 && <section className={css.readerSection}><h3>{t('reader.toolDefinitions')}</h3><p className={css.readerHint}>{t('reader.toolDefinitionsNote')}</p>{artifact.tools.map((tool, index) => <details className={css.readerFold} key={index}><summary><code>{tool.name ?? t('reader.unnamedTool')}</code></summary>{tool.description !== undefined && <p className={css.readerDescription}>{tool.description}</p>}{tool.schema !== undefined && <Folded title={t('reader.schema')} value={tool.schema} />}<Folded title={t('reader.completeDefinition')} value={tool.raw} /></details>)}</section>}
    {Object.keys(artifact.metadata).length > 0 && <Folded title={t('reader.requestMetadata')} value={artifact.metadata} />}
  </div>

  return <div className={css.reader}>
    <section className={css.readerCard}><h3>{t('reader.responseText')}</h3>{artifact.text.length === 0 ? <p className={css.readerHint}>{t('reader.noResponseText')}</p> : <pre className={css.readerText}>{artifact.text}</pre>}</section>
    {artifact.reasoning.length > 0 && <Folded title={t('reader.reasoning')} value={artifact.reasoning} />}
    {artifact.toolCalls.length > 0 && <section className={css.readerSection}><h3>{t('reader.toolCalls')}</h3><p className={css.readerHint}>{t('reader.toolCallsNote')}</p>{artifact.toolCalls.map((tool, index) => <article className={css.readerCard} key={index}><h4><code>{tool.name ?? t('reader.unnamedTool')}</code><span className={css.readerIndex}>#{index + 1}</span></h4>{tool.id !== undefined && <code className={css.readerHint}>{tool.id}</code>}<Value value={tool.arguments} /><Folded title={t('reader.completeToolCall')} value={tool.raw} /></article>)}</section>}
    <section className={css.readerCard}><h3>{t('reader.completion')}</h3><dl className={css.readerSummary}><div><dt>{t('reader.stopReason')}</dt><dd><code>{readableJson(artifact.stopReason)}</code></dd></div></dl>{artifact.usage !== undefined && <Folded title={t('reader.usage')} value={artifact.usage} />}<Value value={artifact.warnings} /><p className={css.readerHint}>{t('reader.warningFields')}</p></section>
    <Folded title={t('reader.additionalMetadata')} value={artifact.metadata} />
    {artifact.blocks !== undefined && <Folded title={t('reader.responseBlocks')} value={artifact.blocks} />}
  </div>
}
