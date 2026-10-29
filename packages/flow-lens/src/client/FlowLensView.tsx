/** Interactive execution graph backed by the shared Trajectory snapshot. */

import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEventWindow } from '@deepseek-ai/dsh-api-session-controller/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TrajectorySnapshot } from '@deepseek-ai/dsh-client-ui-trajectory/client'
import {
  deriveFlowMap, findFlowNode, type FlowNode, type FlowStatus, type FlowToolNode,
} from './model.ts'
import { readFlowSelection, writeFlowSelection, type FlowSelection } from './url-state.ts'
import { deriveExecutionEvents, type ExecutionCategory } from './execution-events.ts'
import type { FlowLensKey } from './locales.ts'
import { JsonHighlight, PromptReader } from './PromptReader.tsx'
import { ExtensionMap } from './ExtensionMap.tsx'
import { LearningJourney } from './LearningJourney.tsx'
import { withRecordedLifecycle, type LearningStageId } from './learning-stages.ts'

const EVENT_EXPLANATIONS: Readonly<Record<string, FlowLensKey>> = {
  'turn/start': 'event.turnStart', 'turn/end': 'event.turnEnd',
  'step/start': 'event.stepStart', 'step/end': 'event.stepEnd',
  'system/message': 'event.system', 'user/message': 'event.user',
  'request/header': 'event.header', 'request/context': 'event.context',
  'assistant/message': 'event.assistant', 'assistant/attempt': 'event.attempt',
  'assistant/live-chunk': 'event.chunk', 'tool/call': 'event.toolCall',
  'tool/result': 'event.toolResult',
}

/** Session paging callbacks supplied by the plugin registration. */
export interface FlowLensInjected {
  loadOlder: () => Promise<boolean>
  eventWindow: () => SessionEventWindow
  subscribeEvents: (listener: () => void) => () => void
}

type Props = ConvViewProps & InjectFace<FlowLensInjected> & PropsLocale<'flowLens'>

function formatDuration(value: number | null): string {
  if (value === null) return '—'
  if (value < 1_000) return `${Math.round(value)} ms`
  return `${(value / 1_000).toFixed(value < 10_000 ? 2 : 1)} s`
}

function statusKey(status: FlowStatus):
  | 'node.waiting' | 'node.running' | 'node.complete' | 'node.error' | 'node.interrupted' {
  return `node.${status}`
}

function preview(value: string, limit = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length <= limit ? compact : `${compact.slice(0, limit)}…`
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return JSON.stringify({ serializationError: error instanceof Error ? error.message : String(error) }, null, 2)
  }
}

function recordedMessageText(data: unknown): string {
  const record = data as {
    message?: { content?: readonly { text?: string }[] }
    content?: readonly { text?: string }[]
  }
  return (record.message?.content ?? record.content ?? [])
    .flatMap(block => typeof block.text === 'string' ? [block.text] : []).join('\n')
}

function toolContains(tools: readonly FlowToolNode[], id: string): boolean {
  return tools.some(tool => tool.id === id || toolContains(tool.children, id))
}

function NodeButton({
  node, label, body, selected, critical, onSelect, t,
}: {
  node: FlowNode
  label: string
  body: ReactNode
  selected: boolean
  critical: boolean
  onSelect: (node: FlowNode) => void
  t: Props['t']
}) {
  return <button
    type="button"
    className={`fl-node fl-status-${node.status}${selected ? ' fl-node-selected' : ''}${critical ? ' fl-node-critical' : ''}`}
    onClick={() => { onSelect(node) }}
  >
    <span className="fl-node-head">
      <span className="fl-dot" />
      <span className="fl-node-title">{label}</span>
      <span className="fl-node-state">{t(statusKey(node.status))}</span>
    </span>
    {body}
    {critical && <span className="fl-node-body">{t('node.slowest')}</span>}
  </button>
}

function ToolBranch({
  tool, selectedId, criticalId, onSelect, t,
}: {
  tool: FlowToolNode
  selectedId: string | undefined
  criticalId: string | null
  onSelect: (node: FlowNode) => void
  t: Props['t']
}) {
  return <div className="fl-tool-wrap">
    <NodeButton
      node={tool}
      label={tool.name}
      selected={selectedId === tool.id}
      critical={criticalId === tool.id}
      onSelect={onSelect}
      t={t}
      body={<>
        <span className="fl-node-body">
          <span className="fl-node-kind">{t('node.tool')}</span>
          <span>{t('node.duration', { duration: formatDuration(tool.durationMs) })}</span>
          {tool.children.length > 0 && <span>{t('node.children', { count: tool.children.length })}</span>}
        </span>
        {tool.argsRaw !== '' && <span className="fl-node-copy"><code>{preview(tool.argsRaw)}</code></span>}
        {tool.result !== '' && <span className="fl-node-copy">{preview(tool.result)}</span>}
      </>}
    />
    {tool.children.length > 0 && <div className="fl-tool-children">
      {tool.children.map(child => <ToolBranch
        key={child.id}
        tool={child}
        selectedId={selectedId}
        criticalId={criticalId}
        onSelect={onSelect}
        t={t}
      />)}
    </div>}
  </div>
}

export function FlowLensView({ useTrajectory, loadOlder, eventWindow, subscribeEvents, t }: Props) {
  const snapshot = useTrajectory((value: TrajectorySnapshot) => value)
  const windowSnapshot = useSyncExternalStore(subscribeEvents, eventWindow, eventWindow)
  const events = useMemo(() => deriveExecutionEvents(windowSnapshot.entries), [windowSnapshot])
  const [mode, setMode] = useState<'learn' | 'graph' | 'prompt' | 'events' | 'extensions'>(() =>
    typeof window !== 'undefined' && readFlowSelection(window.location.href)?.node !== undefined ? 'graph' : 'learn')
  const [learningStage, setLearningStage] = useState<LearningStageId>('input')
  const [query, setQuery] = useState('')
  const [eventCategory, setEventCategory] = useState<ExecutionCategory | 'all'>('all')
  const [allTurns, setAllTurns] = useState(true)
  const [eventId, setEventId] = useState<string>()
  const model = useMemo(() => withRecordedLifecycle(deriveFlowMap(snapshot), events), [snapshot, events])
  const initial = typeof window === 'undefined' ? null : readFlowSelection(window.location.href)
  const [selection, setSelection] = useState<FlowSelection | null>(initial)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'json' | 'link' | 'failed'>('idle')
  const firstTurn = model.turns[0]
  const selectedTurn = model.turns.find(turn => turn.turn === selection?.turn) ?? firstTurn
  const selectedStep = selectedTurn?.steps.find(step => step.step === selection?.step) ?? selectedTurn?.steps[0]
  const selectedCandidate = findFlowNode(model, selection?.node)
  const selectedNode = selectedCandidate !== null && selectedStep !== undefined && (
    selectedStep.prompts.some(prompt => prompt.id === selectedCandidate.id)
    || selectedStep.requests.some(request => request.id === selectedCandidate.id)
    || selectedStep.response?.id === selectedCandidate.id
    || toolContains(selectedStep.tools, selectedCandidate.id)
  ) ? selectedCandidate : null
  const hasMore = windowSnapshot.hasMore
  const visibleEvents = events.filter(event =>
    (allTurns || event.turn === selectedTurn?.turn)
    && (eventCategory === 'all' || event.category === eventCategory)
    && (query === '' || `${event.type} ${safeJson(event.raw)}`.toLowerCase().includes(query.toLowerCase())))
  const selectedEvent = events.find(event => event.id === eventId)

  useEffect(() => {
    if (selectedTurn === undefined || typeof window === 'undefined') return
    const next: FlowSelection = {
      turn: selectedTurn.turn,
      ...(selectedStep === undefined ? {} : { step: selectedStep.step }),
      ...(selectedNode === null ? {} : { node: selectedNode.id }),
    }
    const href = writeFlowSelection(window.location.href, next)
    if (href !== window.location.href) window.history.replaceState(window.history.state, '', href)
  }, [selectedNode, selectedStep, selectedTurn])

  useEffect(() => {
    const update = (): void => { setSelection(readFlowSelection(window.location.href)) }
    window.addEventListener('popstate', update)
    return () => { window.removeEventListener('popstate', update) }
  }, [])

  const selectTurn = (turn: number): void => {
    const target = model.turns.find(candidate => candidate.turn === turn)
    setSelection({ turn, ...(target?.steps[0] === undefined ? {} : { step: target.steps[0].step }) })
  }
  const selectNode = (node: FlowNode, turn: number, step: number): void => {
    setSelection({ turn, step, node: node.id })
    setCopyState('idle')
  }
  const copy = async (kind: 'json' | 'link'): Promise<void> => {
    try {
      const text = kind === 'json'
        ? safeJson(mode === 'events' ? selectedEvent?.raw : selectedNode?.data)
        : window.location.href
      await navigator.clipboard.writeText(text)
      setCopyState(kind)
    } catch {
      setCopyState('failed')
    }
  }

  return <div className="fl-root" data-conversation-composer-overlay="">
    <header className="fl-summary">
      <div className="fl-modes" role="tablist" aria-label={t('mode.label')}>
        {(['learn', 'graph', 'prompt', 'events', 'extensions'] as const).map(value => <button type="button" role="tab"
          aria-selected={mode === value} key={value} className={`fl-button${mode === value ? ' fl-mode-active' : ''}`}
          onClick={() => { setMode(value); setCopyState('idle') }}>{t(`mode.${value}`)}</button>)}
      </div>
      <span className="fl-summary-label">{t('summary.loaded')}</span>
      <span className="fl-pill">{t('summary.turns', { count: model.turns.length })}</span>
      <span className="fl-pill">{t('summary.requests', { count: model.requestCount })}</span>
      <span className="fl-pill">{t('summary.tools', { count: model.toolCount })}</span>
      {model.errorCount > 0 && <span className="fl-pill fl-pill-error">{t('summary.errors', { count: model.errorCount })}</span>}
      <span className="fl-history">
        <span>{hasMore ? t('history.partial') : t('history.complete')}</span>
        {hasMore && <button className="fl-button" type="button" disabled={loadingOlder} onClick={() => {
          setLoadingOlder(true)
          void loadOlder().finally(() => { setLoadingOlder(false) })
        }}>{loadingOlder ? t('history.loading') : t('history.load')}</button>}
      </span>
    </header>
    {mode === 'extensions' ? <ExtensionMap events={events} t={t} />
      : model.turns.length === 0 && events.length === 0 ? <div className="fl-empty">
        <h2>{t('empty.title')}</h2><p>{t('empty.body')}</p>
      </div> : <div className={`fl-layout${mode === 'learn' ? ' fl-layout-learning' : ''}`}>
      <nav className="fl-turns">
        {model.turns.map(turn => <button
          type="button"
          key={turn.turn}
          className={`fl-turn fl-status-${turn.status}${turn.turn === selectedTurn?.turn ? ' fl-turn-active' : ''}`}
          onClick={() => { selectTurn(turn.turn) }}
        >
          <span className="fl-turn-top"><span className="fl-dot" />{t('turn.title', { turn: turn.turn })}
            <span className="fl-turn-meta">{t('turn.steps', { count: turn.steps.length })}</span>
          </span>
          <span className="fl-turn-prompt">{turn.prompt ?? t('turn.unknownPrompt')}</span>
          {!events.some(event => event.turn === turn.turn && event.type === 'turn/end')
            && <span className="fl-turn-prompt">{t('turn.noEnd')}</span>}
        </button>)}
      </nav>
      <main className="fl-canvas">
        {mode === 'learn' && <LearningJourney turn={selectedTurn} step={selectedStep} events={events} t={t}
          stageId={learningStage} onStage={setLearningStage}
          onStep={step => { if (selectedTurn !== undefined) setSelection({ turn: selectedTurn.turn, step }) }}
          onInspect={(targetMode, node) => {
            setMode(targetMode)
            if (targetMode === 'events') { setAllTurns(false); setQuery(''); setEventCategory('all') }
            if (selectedTurn !== undefined) setSelection({ turn: selectedTurn.turn,
              ...(selectedStep === undefined ? {} : { step: selectedStep.step }), ...(node === undefined ? {} : { node }) })
            setCopyState('idle')
          }} />}
        {mode === 'events' && <>
          <p className="fl-notice">{t('events.notice')}</p>
          <div className="fl-event-filters">
            <input aria-label={t('events.search')} placeholder={t('events.search')} value={query}
              onChange={event => { setQuery(event.target.value) }} />
            <select aria-label={t('events.category')} value={eventCategory}
              onChange={event => { setEventCategory(event.target.value as ExecutionCategory | 'all') }}>
              {(['all', 'loop', 'prompt', 'model', 'tool', 'other'] as const).map(value =>
                <option key={value} value={value}>{t(`events.${value}`)}</option>)}
            </select>
            <label><input type="checkbox" checked={allTurns} onChange={event => { setAllTurns(event.target.checked) }} />{t('events.allTurns')}</label>
          </div>
          <p>{t('events.count', { count: visibleEvents.length })}</p>
          <div className="fl-event-list">
            {visibleEvents.map(event => <button type="button" key={event.id}
              className={`fl-event-row fl-category-${event.category}${eventId === event.id ? ' fl-node-selected' : ''}`}
              onClick={() => { setEventId(event.id); setCopyState('idle') }}>
              <span className="fl-event-time">{new Date(event.time).toLocaleTimeString()}<small>#{event.seq}</small></span>
              <span><strong>{t(`events.${event.category}`)}</strong><code>{event.type}</code>
                {EVENT_EXPLANATIONS[event.type] !== undefined && <span className="fl-event-explanation">
                  {t(EVENT_EXPLANATIONS[event.type] as FlowLensKey)}</span>}
                <small>{event.turn === null ? t('events.unscoped') : t('turn.title', { turn: event.turn })}
                  {event.step !== null && ` · ${t('step.title', { step: event.step })}`}
                  {event.transient && ` · ${t('events.transient')}`}</small>
                <span className="fl-event-preview">{preview(safeJson(event.data), 220)}</span>
              </span>
            </button>)}
          </div>
          {visibleEvents.length === 0 && <p>{t('events.empty')}</p>}
        </>}
        {(mode === 'graph' || mode === 'prompt') && selectedTurn !== undefined && <>
          <div className="fl-turn-heading">
            <div><h2>{t('turn.title', { turn: selectedTurn.turn })}</h2>
              <p>{selectedTurn.prompt ?? t('turn.unknownPrompt')}</p></div>
            <span className="fl-turn-duration">{formatDuration(selectedTurn.durationMs)}</span>
          </div>
          {mode === 'prompt' && <p className="fl-notice">{t('prompt.notice')}</p>}
          {selectedTurn.steps.map(step => <section className="fl-step" key={step.step}>
            <div className={`fl-step-head fl-status-${step.status}`}><span className="fl-dot" />
              {t('step.title', { step: step.step })}
              {step.tools.length > 0 && <span className="fl-step-note">{step.hasOverlap
                ? t('step.parallel', { count: step.tools.length })
                : t('step.branches', { count: step.tools.length })}</span>}
            </div>
            <div className="fl-flow">
              {mode === 'prompt' && <details className="fl-prompt-expanded fl-source-context">
                <summary>{t('prompt.messages')}</summary>
                <p>{t('prompt.messagesNotice')}</p>
                {events.filter(event => event.turn === selectedTurn.turn && event.step === step.step
                  && (event.type === 'user/message' || event.type === 'system/message')).map(event =>
                  <details key={event.id}><summary>#{event.seq} · {event.type}</summary>
                    <PromptReader text={recordedMessageText(event.data)} t={t} />
                    <details><summary>{t('details.raw')}</summary><JsonHighlight text={safeJson(event.raw)} /></details></details>)}
              </details>}
              {step.prompts.map((prompt, index) => <div key={prompt.id} className="fl-prompt-stage">
                <NodeButton node={prompt} label={t('prompt.title', { attempt: index + 1 })}
                  selected={selectedNode?.id === prompt.id} critical={false}
                  onSelect={node => { selectNode(node, selectedTurn.turn, step.step) }} t={t}
                  body={<><span className="fl-node-body">{prompt.available
                    ? t('node.prompt', { system: prompt.system.length, tools: prompt.tools.length })
                    : t('prompt.unavailable')}</span>
                    <span className="fl-node-copy">{preview(prompt.system) || t('prompt.emptySystem')}</span></>} />
                {mode === 'prompt' && prompt.available && <div className="fl-prompt-expanded">
                  <details className="fl-source-system" open><summary>{t('prompt.system')}</summary><PromptReader text={prompt.system} t={t} /></details>
                  <details className="fl-source-config"><summary>{t('prompt.config')}</summary><JsonHighlight text={safeJson(prompt.config)} /></details>
                  <details className="fl-source-tools"><summary>{t('prompt.tools', { count: prompt.tools.length })}</summary>
                    {prompt.tools.map((tool, toolIndex) => <details key={toolIndex}><summary>
                      {String((tool as { name?: string }).name ?? toolIndex + 1)}</summary><JsonHighlight text={safeJson(tool)} /></details>)}
                  </details>
                  <details><summary>{t('prompt.changes')}</summary><JsonHighlight text={safeJson(prompt.data)} /></details>
                </div>}
                <div className="fl-arrow" />
              </div>)}
              {mode === 'graph' && step.requests.length > 0 && <div className="fl-attempts">{step.requests.map(request => <NodeButton
                key={request.id}
                node={request}
                label={step.requests.length > 1 ? t('node.attempt', { attempt: request.attempt }) : t('node.request')}
                selected={selectedNode?.id === request.id}
                critical={model.criticalNodeId === request.id}
                onSelect={node => { selectNode(node, selectedTurn.turn, step.step) }}
                t={t}
                body={<span className="fl-node-body">
                  {(request.provider !== undefined || request.model !== undefined) && <span>{t('node.model', {
                    provider: request.provider ?? '—', model: request.model ?? '—',
                  })}</span>}
                  <span>{t('node.duration', { duration: formatDuration(request.durationMs) })}</span>
                  <span>{t('node.prompt', { system: request.systemLength, tools: request.toolSchemaCount })}</span>
                  {request.usage !== undefined && <span>{t('node.tokens', {
                    input: request.usage.input ?? 0, output: request.usage.output ?? 0,
                    reasoning: request.usage.reasoning ?? 0,
                  })}</span>}
                </span>}
              />)}</div>}
              {mode === 'graph' && step.response !== null && <><div className="fl-arrow" /><NodeButton
                node={step.response}
                label={t('node.response')}
                selected={selectedNode?.id === step.response.id}
                critical={model.criticalNodeId === step.response.id}
                onSelect={node => { selectNode(node, selectedTurn.turn, step.step) }}
                t={t}
                body={<>
                  <span className="fl-node-body">
                    <span>{t('node.responseSpan', { duration: formatDuration(step.response.durationMs) })}</span>
                    {step.response.reasoning !== '' && <span>{t('node.thinking')}</span>}
                    {step.response.toolCallCount > 0 && <span>{t('node.toolCalls', { count: step.response.toolCallCount })}</span>}
                  </span>
                  <span className="fl-node-copy">{preview(step.response.text || step.response.reasoning) || t('node.noText')}</span>
                </>}
              /></>}
              {mode === 'graph' && step.tools.length > 0 && <><div className="fl-arrow" /><div className="fl-branches">
                {step.tools.map(tool => <ToolBranch key={tool.id} tool={tool} selectedId={selectedNode?.id}
                  criticalId={model.criticalNodeId}
                  onSelect={node => { selectNode(node, selectedTurn.turn, step.step) }} t={t} />)}
              </div></>}
            </div>
          </section>)}
        </>}
      </main>
      {mode !== 'learn' && <aside className="fl-inspector">
        <div className="fl-inspector-head"><h3>{t('details.title')}</h3>
          {(mode === 'events' ? selectedEvent !== undefined : selectedNode !== null) && <span className="fl-inspector-actions">
            {mode !== 'events' && <button className="fl-button" type="button" onClick={() => { void copy('link') }}>
              {copyState === 'link' ? t('details.linkCopied') : t('details.link')}
            </button>}
            <button className="fl-button" type="button" onClick={() => { void copy('json') }}>
              {copyState === 'json' ? t('details.copied') : copyState === 'failed' ? t('details.copyFailed') : t('details.copy')}
            </button>
          </span>}
        </div>
        {mode === 'events' ? selectedEvent === undefined
          ? <p>{t('events.hint')}</p>
          : <><h3>{selectedEvent.type}</h3><p>{t('events.elapsed', { duration: formatDuration(
            selectedEvent.time - (events.find(event => event.turn === selectedEvent.turn)?.time ?? selectedEvent.time)) })}</p>
            <pre>{safeJson(selectedEvent.raw)}</pre></>
          : selectedNode === null
          ? <div className="fl-inspector-empty">{t('details.hint')}</div>
          : <>
            <p>{t(`inspect.${selectedNode.kind}`)}</p>
            {selectedNode.kind === 'prompt' && <><details className="fl-source-system" open><summary>{t('prompt.system')}</summary>
              <PromptReader text={selectedNode.system} t={t} /></details>
              <details className="fl-source-tools"><summary>{t('prompt.tools', { count: selectedNode.tools.length })}</summary><JsonHighlight text={safeJson(selectedNode.tools)} /></details></>}
            {selectedNode.kind === 'response' && <><details open><summary>{t('node.content')}</summary><pre>{selectedNode.text}</pre></details>
              <details><summary>{t('node.thinking')}</summary><pre>{selectedNode.reasoning}</pre></details></>}
            {selectedNode.kind === 'tool' && <><details open><summary>{t('node.arguments')}</summary><pre>{selectedNode.argsRaw}</pre></details>
              <details open><summary>{t('node.result')}</summary><pre>{selectedNode.result || t('node.waiting')}</pre></details></>}
            <details><summary>{t('details.raw')}</summary><pre>{safeJson(selectedNode.data)}</pre></details>
          </>}
      </aside>}
    </div>}
  </div>
}
