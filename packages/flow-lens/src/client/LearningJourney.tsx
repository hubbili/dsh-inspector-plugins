/** Guided source-reading view; runtime facts come only from the loaded Session projection. */
import { useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { FlowStepModel, FlowTurnModel } from './model.ts'
import type { ExecutionEvent } from './execution-events.ts'
import { deriveLearningEvidence, recordedTurnEndReason, type LearningStageId } from './learning-stages.ts'
import { JsonHighlight } from './PromptReader.tsx'

type Props = PropsLocale<'flowLens'> & {
  turn: FlowTurnModel | undefined
  step: FlowStepModel | undefined
  events: readonly ExecutionEvent[]
  stageId: LearningStageId
  onStage: (stage: LearningStageId) => void
  onStep: (step: number) => void
  onInspect: (mode: 'prompt' | 'graph' | 'events', nodeId: string | undefined) => void
}

/**
 * Follow one step from admitted input to continuation, with source paths and optional raw evidence.
 * @param props - Selected turn/step, loaded records, navigation callbacks, and localized copy.
 * @returns Beginner-oriented explanation, readable facts, and source-reading actions.
 */
export function LearningJourney({ turn, step, events, stageId, onStage, onStep, onInspect, t }: Props) {
  const [copyKey, setCopyKey] = useState('')
  const evidence = useMemo(() => deriveLearningEvidence(turn, step, events), [turn, step, events])
  const selected = evidence.find(row => row.stage.id === stageId)
  const firstPrompt = step?.prompts[0]
  const request = step?.requests[0]
  const response = step?.response
  const endReason = turn === undefined ? undefined : recordedTurnEndReason(turn.turn, events)
  if (selected === undefined) return null

  return <div className="fl-learning">
    <div className="fl-learning-intro"><div><h2>{t('learn.title')}</h2><p>{t('learn.subtitle')}</p></div>
      {step !== undefined && <select aria-label={t('learn.chooseStep')} value={step.step}
        onChange={event => { onStep(Number(event.target.value)) }}>
        {turn?.steps.map(value => <option key={value.step} value={value.step}>{t('step.title', { step: value.step })}</option>)}
      </select>}
    </div>
    <div className="fl-learning-terms"><span>{t('learn.turnTerm')}</span><span>{t('learn.stepTerm')}</span><span>{t('learn.attemptTerm')}</span></div>
    <div className="fl-learning-stages" role="tablist" aria-label={t('learn.stages')}>
      {evidence.map(({ stage }, index) => <button key={stage.id} type="button" role="tab"
        aria-selected={stage.id === stageId} className={stage.id === stageId ? 'fl-learning-stage-active' : ''}
        onClick={() => { onStage(stage.id) }}><span>{index + 1}</span>{t(stage.title)}</button>)}
    </div>
    <section className="fl-learning-facts">
      <div className="fl-learning-section-head"><h3>{t(selected.stage.question)}</h3>
        <button type="button" className="fl-button" onClick={() => { onInspect(selected.stage.inspect, selected.nodeId) }}>
          {t(selected.stage.inspect === 'prompt' ? 'learn.openPrompt' : selected.stage.inspect === 'events' ? 'learn.openEvents' : 'learn.openGraph')}
        </button>
      </div>
      {stageId === 'input' && <><p className="fl-learning-readable">{turn?.prompt ?? t('turn.unknownPrompt')}</p><p>{t('learn.inputScope')}</p></>}
      {stageId === 'prompt' && <>{firstPrompt?.available ? <>
        <div className="fl-learning-metrics"><span>{t('learn.systemCount', { count: firstPrompt.system.length })}</span>
          <span>{t('learn.schemaCount', { count: firstPrompt.tools.length })}</span></div>
        <pre className="fl-learning-readable">{firstPrompt.system.slice(0, 600)}{firstPrompt.system.length > 600 && '…'}</pre>
      </> : <p>{t('prompt.unavailable')}</p>}<p>{t('learn.promptScope')}</p></>}
      {stageId === 'request' && <><div className="fl-learning-metrics"><span>{t('node.model', {
        provider: request?.provider ?? '—', model: request?.model ?? '—',
      })}</span><span>{t('learn.attemptCount', { count: step?.requests.length ?? 0 })}</span></div><p>{t('learn.wireScope')}</p></>}
      {stageId === 'response' && <>{response === null || response === undefined ? <p>{t('learn.noResponse')}</p> : <>
        <p className="fl-learning-readable">{response.text.slice(0, 800) || t('node.noText')}{response.text.length > 800 && '…'}</p>
        <span className="fl-pill">{t('node.toolCalls', { count: response.toolCallCount })}</span>
      </>}<p>{t('learn.responseScope')}</p></>}
      {stageId === 'tools' && <>{step?.tools.length ? <div className="fl-learning-tool-list">{step.tools.map(tool => <button
        type="button" className="fl-button" key={tool.id} onClick={() => { onInspect('graph', tool.id) }}>
        <code>{tool.name}</code><span>{t(`node.${tool.status}`)}</span></button>)}</div> : <p>{t('learn.noTools')}</p>}
        <p>{t('learn.toolScope')}</p></>}
      {stageId === 'continuation' && <><p>{turn === undefined ? t('learn.noTurn') : endReason === undefined ? t('learn.endMissing')
        : t('learn.endReason', { reason: endReason === 'completed' || endReason === 'blocked' || endReason === 'aborted' || endReason === 'error' || endReason === 'max-tokens'
          ? t(`learn.end.${endReason}`) : endReason })}</p>
        <p>{t('learn.continuationScope')}</p></>}
      <details><summary>{t('learn.records', { count: selected.records.length })}</summary>
        {selected.records.length === 0 ? <p>{t('extension.noEvents')}</p> : selected.records.map(event => <details key={event.id}>
          <summary>#{event.seq} · {event.type}{event.transient && ` · ${t('events.transient')}`}</summary>
          <JsonHighlight text={JSON.stringify(event.raw, null, 2)} />
        </details>)}
      </details>
    </section>
    <section className="fl-learning-explanation">
      <h3>{t('learn.how')}</h3><p>{t(selected.stage.explanation)}</p>
      <div className="fl-extension-types">{selected.stage.hooks.map(hook => <code key={hook}>{hook}</code>)}</div>
      <p className="fl-learning-limit">{t('learn.limit')}</p>
    </section>
    <section className="fl-learning-source"><h3>{t('learn.source')}</h3><p>{t('learn.sourceHint')}</p>
      {selected.stage.sources.map(source => {
        const key = `${turn?.turn}:${step?.step}:${stageId}:${source.path}`
        return <div className="fl-learning-source-row" key={source.path}><div><code>{source.path}</code><small>{source.symbol}</small></div>
          <button type="button" className="fl-button" onClick={() => {
            void navigator.clipboard.writeText(source.path).then(() => { setCopyKey(key) }, () => { setCopyKey(`failed:${key}`) })
          }}>{copyKey === key ? t('details.copied') : copyKey === `failed:${key}` ? t('details.copyFailed') : t('learn.copySource')}</button>
        </div>
      })}
    </section>
  </div>
}
