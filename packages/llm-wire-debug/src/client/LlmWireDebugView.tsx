/** Full-height viewer for raw model requests, responses, curl, and translated prompts. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { LlmWireDebugKey } from './locales.ts'
import { classes as css } from './styles.ts'
import { parseTraceLiveEvent, TRACE_LIVE_PATH, type TraceUpdatePhase } from '../live-events.ts'
import { ARTIFACT_GROUPS, availableArtifacts, filterTraces, selectedArtifactContent, type ArtifactContent, type TraceSummary } from './artifacts.ts'
import { parseReadableArtifact } from './artifact-reader.ts'
import { ArtifactReader } from './ArtifactReader.tsx'

interface TraceListResponse {
  readonly traces: readonly TraceSummary[]
}

type LiveState = 'connecting' | 'connected' | 'reconnecting'
type VisiblePhase = TraceUpdatePhase | 'streaming'

const PHASE_LABELS: Readonly<Record<VisiblePhase, LlmWireDebugKey>> = {
  'request-ready': 'live.phase.request',
  'response-headers-ready': 'live.phase.headers',
  streaming: 'live.phase.streaming',
  'response-complete': 'live.phase.complete',
  'translation-complete': 'live.phase.translation',
  'transport-error': 'live.phase.error',
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function displayTime(trace: TraceSummary): string {
  const fromId = trace.id.slice(0, 24).replace('T', ' ')
  const date = new Date(trace.createdAt)
  return Number.isNaN(date.valueOf()) ? fromId : date.toLocaleString()
}

/** Render one session-independent trace browser within the Conversation view seat. */
export function LlmWireDebugView({ t }: ConvViewProps & PropsLocale<'llmWireDebug'>) {
  const [traces, setTraces] = useState<readonly TraceSummary[]>([])
  const [selectedTraceId, setSelectedTraceId] = useState<string>()
  const [selectedFile, setSelectedFile] = useState<string>('request-body.json')
  const [artifactContent, setArtifactContent] = useState<ArtifactContent>()
  const [filter, setFilter] = useState('')
  const [readMode, setReadMode] = useState<'reading' | 'raw'>('reading')
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState<string>()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [pathCopyState, setPathCopyState] = useState<{ path: string; state: 'copied' | 'failed' }>()
  const [liveState, setLiveState] = useState<LiveState>('connecting')
  const [phases, setPhases] = useState<ReadonlyMap<string, VisiblePhase>>(new Map())
  const [liveResponses, setLiveResponses] = useState<ReadonlyMap<string, string>>(new Map())
  const [artifactRevision, setArtifactRevision] = useState(0)
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>()
  const decoders = useRef(new Map<string, TextDecoder>())

  const selectedTrace = traces.find(trace => trace.id === selectedTraceId)
  const artifacts = useMemo(() => selectedTrace === undefined
    ? []
    : availableArtifacts(selectedTrace.files), [selectedTrace])
  const selectedArtifact = artifacts.find(artifact => artifact.file === selectedFile) ?? artifacts[0]
  const currentFile = selectedArtifact?.file
  const visibleTraces = useMemo(() => filterTraces(traces, filter, displayTime), [traces, filter])
  const settledContent = selectedArtifactContent(artifactContent, selectedTraceId, currentFile)
  const liveResponse = selectedTraceId !== undefined && currentFile === 'response.raw'
    ? liveResponses.get(selectedTraceId)
    : undefined
  const content = liveResponse ?? settledContent?.text
  const loadingContent = selectedArtifact !== undefined && content === undefined && settledContent?.error === undefined
  const supportsReader = currentFile === 'request-body.json' || currentFile === 'response.parsed.json'
  const readable = useMemo(() => parseReadableArtifact(currentFile, content), [currentFile, content])

  const selectFile = (file: string): void => {
    setSelectedFile(file)
    setReadMode('reading')
    setCopyState('idle')
    setPathCopyState(undefined)
  }

  const refresh = useCallback(async () => {
    setLoadingList(true)
    setListError(undefined)
    try {
      const response = await fetch('/llm-wire-debug/api/traces', { cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
      const value = await response.json() as TraceListResponse
      setTraces(value.traces)
      setSelectedTraceId(current => value.traces.some(trace => trace.id === current)
        ? current
        : value.traces[0]?.id)
    } catch (reason) {
      setListError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    const scheduleRefresh = (): void => {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => { void refresh() }, 40)
    }
    const connect = (): void => {
      if (stopped) return
      setLiveState(failures === 0 ? 'connecting' : 'reconnecting')
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}${TRACE_LIVE_PATH}`)
      socket.addEventListener('open', () => {
        failures = 0
        setLiveState('connected')
        scheduleRefresh()
      })
      socket.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') return
        const event = parseTraceLiveEvent(message.data)
        if (event === undefined) return
        if (event.type === 'response-chunk') {
          const decoder = decoders.current.get(event.traceId) ?? new TextDecoder()
          decoders.current.set(event.traceId, decoder)
          const text = decoder.decode(decodeBase64(event.base64), { stream: true })
          setLiveResponses(current => {
            const next = new Map(current)
            next.set(event.traceId, `${next.get(event.traceId) ?? ''}${text}`)
            return next
          })
          setPhases(current => new Map(current).set(event.traceId, 'streaming'))
          setTraces(current => current.map(trace => trace.id !== event.traceId
            || trace.files.includes('response.raw')
            ? trace
            : { ...trace, files: [...trace.files, 'response.raw'] }))
          return
        }
        setPhases(current => new Map(current).set(event.traceId, event.phase))
        if (event.phase === 'response-complete' || event.phase === 'transport-error') {
          decoders.current.delete(event.traceId)
          setLiveResponses(current => {
            const next = new Map(current)
            next.delete(event.traceId)
            return next
          })
        }
        setArtifactRevision(revision => revision + 1)
        scheduleRefresh()
      })
      socket.addEventListener('close', () => {
        if (stopped) return
        failures += 1
        setLiveState('reconnecting')
        const delay = Math.min(10_000, 500 * 2 ** Math.min(failures - 1, 5))
        reconnectTimer = setTimeout(connect, delay)
      })
      socket.addEventListener('error', () => { setLiveState('reconnecting') })
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(reconnectTimer)
      clearTimeout(refreshTimer.current)
      socket?.close()
      decoders.current.clear()
    }
  }, [refresh])

  useEffect(() => {
    if (selectedTraceId === undefined || currentFile === undefined) {
      setArtifactContent(undefined)
      return
    }
    if (liveResponse !== undefined) {
      return
    }
    const controller = new AbortController()
    setArtifactContent(undefined)
    setCopyState('idle')
    const parameters = new URLSearchParams({ trace: selectedTraceId, file: currentFile })
    void fetch(`/llm-wire-debug/api/file?${parameters.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      const text = await response.text()
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}: ${text}`)
      if (!controller.signal.aborted) setArtifactContent({ traceId: selectedTraceId, file: currentFile, text })
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setArtifactContent({ traceId: selectedTraceId, file: currentFile, error: reason instanceof Error ? reason.message : String(reason) })
    })
    return () => { controller.abort() }
  }, [artifactRevision, liveResponse, currentFile, selectedTraceId])

  const copy = async (): Promise<void> => {
    if (content === undefined || loadingContent) return
    try {
      await navigator.clipboard.writeText(content)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const copyPath = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(path)
      setPathCopyState({ path, state: 'copied' })
    } catch {
      setPathCopyState({ path, state: 'failed' })
    }
  }

  return (
    <div className={css.root} data-llm-wire-debug="" data-conversation-composer-overlay="">
      <div className={css.warning}>{t('warning.raw')}</div>
      <div className={css.guide}>
        <strong>{t('guide.title')}</strong>
        <p>{t('guide.description')}</p>
        <div className={css.guideSteps}>
          {([
            ['request-body.json', 'guide.request'],
            ['response.parsed.json', 'guide.response'],
            ['response.raw', 'guide.raw'],
          ] as const).map(([file, label]) => <button type="button" key={file} className={currentFile === file ? css.guideActive : css.guideStep} disabled={!artifacts.some(artifact => artifact.file === file)} onClick={() => { selectFile(file) }}>{t(label)}</button>)}
        </div>
      </div>
      <div className={css.body}>
        <aside className={css.list} aria-label={t('list.title')}>
          <div className={css.listHeader}>
            <strong>{t('list.title')}</strong>
            <span className={`${css.liveStatus} ${css[`live_${liveState}`]}`}>
              <span className={css.liveDot} />{t(`live.${liveState}`)}
            </span>
            <button type="button" className={css.button} onClick={() => { void refresh() }} disabled={loadingList}>
              {t(loadingList ? 'toolbar.refreshing' : 'toolbar.refresh')}
            </button>
          </div>
          <div className={css.listIntro}>
            <strong>{t('scope.global')}</strong>
            <p>{t('scope.description')}</p>
            <input className={css.filter} value={filter} onChange={event => { setFilter(event.target.value) }} placeholder={t('list.filter')} aria-label={t('list.filter')} type="search" />
            <span className={css.count}>{t('list.count')}: {visibleTraces.length} / {traces.length}</span>
          </div>
          {listError !== undefined && <p className={css.error}>{t('content.failed')}: {listError}</p>}
          {traces.length === 0
            ? <p className={css.empty}>{t(loadingList ? 'list.loading' : 'list.empty')}</p>
            : visibleTraces.length === 0
            ? <p className={css.empty}>{t('list.noMatch')}</p>
            : <div className={css.traceList}>
                {visibleTraces.map(trace => (
                  <button
                    type="button"
                    key={trace.id}
                    className={trace.id === selectedTraceId ? css.traceActive : css.trace}
                    aria-current={trace.id === selectedTraceId ? 'true' : undefined}
                    onClick={() => { setSelectedTraceId(trace.id); selectFile('request-body.json') }}
                  >
                    <span className={css.traceTime}>{displayTime(trace)}</span>
                    <span className={css.traceIdentifier} title={trace.id}>{trace.id}</span>
                    {phases.get(trace.id) !== undefined
                      && <span className={css.traceState}>{t(PHASE_LABELS[phases.get(trace.id) as VisiblePhase])}</span>}
                  </button>
                ))}
              </div>}
        </aside>
        <main className={css.content}>
          {selectedTrace === undefined
            ? <p className={css.empty}>{t('content.empty')}</p>
            : <>
                <div className={css.traceHeader}><span>{t('trace.selected')}</span><code title={selectedTrace.id}>{selectedTrace.id}</code><time dateTime={selectedTrace.createdAt}>{displayTime(selectedTrace)}</time></div>
                <div className={css.groupBar} role="tablist" aria-label={t('view.title')}>
                  {ARTIFACT_GROUPS.map(group => {
                    const groupArtifacts = artifacts.filter(artifact => artifact.group === group.id)
                    return <button type="button" role="tab" key={group.id} aria-selected={selectedArtifact?.group === group.id} disabled={groupArtifacts.length === 0} className={selectedArtifact?.group === group.id ? css.groupActive : css.group} onClick={() => { const first = groupArtifacts[0]; if (first !== undefined) selectFile(first.file) }}>{t(group.label)}<span>{groupArtifacts.length}</span></button>
                  })}
                </div>
                <div className={css.artifactBar}>
                  <div className={css.artifactTabs} role="tablist" aria-label={selectedArtifact === undefined ? t('view.title') : t(ARTIFACT_GROUPS.find(group => group.id === selectedArtifact.group)?.label ?? 'view.title')}>
                    {artifacts.filter(artifact => artifact.group === selectedArtifact?.group).map(artifact => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={artifact.file === currentFile}
                        key={artifact.file}
                        className={artifact.file === currentFile ? css.artifactActive : css.artifact}
                        onClick={() => { selectFile(artifact.file) }}
                      >
                        {t(artifact.label)}
                      </button>
                    ))}
                  </div>
                  {supportsReader && <div className={css.readerModeToggle}><button type="button" aria-pressed={readMode === 'reading'} className={readMode === 'reading' ? css.artifactActive : css.artifact} onClick={() => { setReadMode('reading') }}>{t('reader.reading')}</button><button type="button" aria-pressed={readMode === 'raw'} className={readMode === 'raw' ? css.artifactActive : css.artifact} onClick={() => { setReadMode('raw') }}>{t('reader.raw')}</button></div>}
                  <button type="button" className={css.button} onClick={() => { void copy() }} disabled={content === undefined || content.length === 0 || loadingContent}>
                    {t(copyState === 'copied'
                      ? 'toolbar.copied'
                      : copyState === 'failed' ? 'toolbar.copyFailed' : 'toolbar.copy')}
                  </button>
                </div>
                <div className={css.fileScroller}>
                {supportsReader && <div className={css.readerControls}><p>{t('reader.description')}</p>{!loadingContent && readMode === 'reading' && readable === undefined && settledContent?.error === undefined && <p>{t('reader.fallback')}</p>}</div>}
                {currentFile === 'prompt.zh.md' && <p className={css.translationWarning}>{t('help.translationWarning')}</p>}
                {selectedArtifact === undefined
                    ? <p className={css.empty}>{t('content.noFiles')}</p>
                    : settledContent?.error !== undefined && liveResponse === undefined
                    ? <p className={css.error}>{t('content.failed')}: {settledContent.error}</p>
                    : loadingContent
                    ? <p className={css.empty}>{t('content.loading')}</p>
                    : content?.length === 0
                    ? <p className={css.empty}>{t('content.fileEmpty')}</p>
                    : supportsReader && readMode === 'reading' && readable !== undefined
                    ? <ArtifactReader artifact={readable} t={t} />
                    : <pre className={css.raw}>{content}</pre>}
                {selectedArtifact !== undefined && <section className={css.help}>
                  <div className={css.fileHeading}><code>{selectedArtifact.file}</code><span aria-label={t('help.what')}>{t(selectedArtifact.explanation)}</span></div>
                  <details className={css.source}><summary>{t('help.learningDetails')}</summary><dl><div><dt>{t('help.phase')}</dt><dd>{t(selectedArtifact.phase)}</dd></div><div><dt>{t('help.focus')}</dt><dd>{t(selectedArtifact.focus)}</dd></div></dl><p>{t('help.sourceNote')}</p>{selectedArtifact.coreSources !== undefined && <p>{t('help.sourceProtocol')}</p>}{[
                    ...selectedArtifact.coreSources ?? [],
                    { label: 'help.sourceCapture' as const, path: selectedArtifact.source, symbol: selectedArtifact.symbol },
                  ].map(source => <div className={css.sourceEntry} key={source.path}><strong>{t(source.label)}</strong><div><code>{source.path}</code><button type="button" className={css.button} onClick={() => { void copyPath(source.path) }}>{t(pathCopyState?.path === source.path ? pathCopyState.state === 'copied' ? 'toolbar.copied' : 'toolbar.copyFailed' : 'toolbar.copyPath')}</button></div><code>{source.symbol}</code></div>)}</details>
                </section>}
                </div>
              </>}
        </main>
      </div>
    </div>
  )
}
