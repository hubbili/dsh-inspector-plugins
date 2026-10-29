/** Read-only extension reference with related loaded Session records. */
import { useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { EXTENSION_PHASES, deriveExtensionEvidence, type ExtensionPhase } from './extension-points.ts'
import type { ExecutionEvent } from './execution-events.ts'
import { JsonHighlight } from './PromptReader.tsx'

type Props = PropsLocale<'flowLens'> & { events: readonly ExecutionEvent[] }

/**
 * Inspect documented extension points without inferring listener execution or activation.
 * @param props - Loaded Session events and localized view copy.
 * @returns Stage map, filters, and an evidence inspector, including for empty event windows.
 */
export function ExtensionMap({ events, t }: Props) {
  const [phase, setPhase] = useState<ExtensionPhase | 'all'>('all')
  const [query, setQuery] = useState('')
  const [turn, setTurn] = useState('all')
  const [relatedOnly, setRelatedOnly] = useState(false)
  const [pointId, setPointId] = useState('agent/pre-step')
  const [eventId, setEventId] = useState<string>()
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')
  const turns = useMemo(() => [...new Set(events.flatMap(event => event.turn === null ? [] : [event.turn]))], [events])
  const evidence = useMemo(() => deriveExtensionEvidence(
    turn === 'all' ? events : events.filter(event => event.turn === Number(turn)),
  ), [events, turn])
  const search = query.trim().toLowerCase()
  const visible = evidence.filter(({ point, events: records }) =>
    (phase === 'all' || point.phase === phase) && (!relatedOnly || records.length > 0)
    && (search === '' || `${point.id} ${t(point.description)}`.toLowerCase().includes(search)))
  const selected = visible.find(row => row.point.id === pointId) ?? visible[0]
  const selectedEvent = selected?.events.find(event => event.id === eventId)
  const copy = async (): Promise<void> => {
    if (selected === undefined) return
    try {
      await navigator.clipboard.writeText(JSON.stringify({
        extension: selected.point,
        evidenceKind: 'related-session-records-not-hook-traces',
        records: selected.events.map(event => event.raw),
      }, null, 2))
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return <div className="fl-extension-layout">
    <nav className="fl-extension-nav" aria-label={t('extension.filter')}>
      {(['all', ...EXTENSION_PHASES] as const).map(value => <button type="button" key={value}
        className={`fl-button${phase === value ? ' fl-extension-selected' : ''}`} aria-pressed={phase === value}
        onClick={() => { setPhase(value); setCopied('idle') }}>
        {value === 'all' ? t('extension.all') : t(`extension.phase.${value}`)}
      </button>)}
    </nav>
    <main className="fl-canvas">
      <p className="fl-notice">{t('extension.notice')}</p>
      <div className="fl-event-filters">
        <input aria-label={t('extension.search')} placeholder={t('extension.search')} value={query}
          onChange={event => { setQuery(event.target.value); setCopied('idle') }} />
        <select aria-label={t('events.allTurns')} value={turn}
          onChange={event => { setTurn(event.target.value); setCopied('idle') }}>
          <option value="all">{t('events.allTurns')}</option>
          {turns.map(value => <option key={value} value={String(value)}>{t('turn.title', { turn: value })}</option>)}
        </select>
        <label><input type="checkbox" checked={relatedOnly}
          onChange={event => { setRelatedOnly(event.target.checked); setCopied('idle') }} />{t('extension.relatedOnly')}</label>
      </div>
      <p>{t('extension.count', { count: visible.length })}</p>
      <div className="fl-extension-map">
        {EXTENSION_PHASES.map((stage, index) => {
          const rows = visible.filter(row => row.point.phase === stage)
          if (rows.length === 0) return null
          return <section key={stage} className={`fl-extension-stage${index < 6 ? ' fl-extension-pipeline' : ''}`}>
            <h2><span className="fl-extension-index">{index + 1}</span>{t(`extension.phase.${stage}`)}</h2>
            <div className="fl-extension-cards">{rows.map(({ point, events: records }) => <button type="button"
              key={point.id} aria-pressed={selected?.point.id === point.id}
              className={`fl-extension-card fl-extension-${point.mode}${selected?.point.id === point.id ? ' fl-extension-selected' : ''}`}
              onClick={() => { setPointId(point.id); setEventId(undefined); setCopied('idle') }}>
              <code>{point.id}</code>
              <span className="fl-extension-mode">{t(`extension.mode.${point.mode}`)}</span>
              <span>{t(point.description)}</span>
              <small className={records.length > 0 ? 'fl-extension-related' : 'fl-extension-muted'}>{records.length > 0
                ? t('extension.related', { count: records.length }) : t('extension.unobserved')}</small>
            </button>)}</div>
          </section>
        })}
      </div>
      {visible.length === 0 && <p>{t('extension.empty')}</p>}
    </main>
    <aside className="fl-inspector fl-extension-inspector">
      <div className="fl-inspector-head"><h3>{t('extension.detail')}</h3>
        {selected !== undefined && <button type="button" className="fl-button" onClick={() => { void copy() }}>{copied === 'done'
          ? t('details.copied') : copied === 'failed' ? t('details.copyFailed') : t('details.copy')}</button>}
      </div>
      {selected === undefined ? <p>{t('extension.help')}</p> : <>
        <code className="fl-extension-api">{selected.point.id}</code>
        <p>{t(selected.point.description)}</p>
        <span className="fl-pill">{t(`extension.mode.${selected.point.mode}`)}</span>
        <p className="fl-notice">{t(`extension.rule.${selected.point.mode}`)}</p>
        {selected.point.evidenceTypes.length === 0 ? <p>{t('extension.noMapping')}</p> : <>
          <h3>{t('extension.records')}</h3>
          <div className="fl-extension-types">{selected.point.evidenceTypes.map(type => <code key={type}>{type}</code>)}</div>
          <p>{t('extension.evidenceNotice')}</p>
        </>}
        <p>{t('extension.related', { count: selected.events.length })}</p>
        {selected.events.length === 0 ? <p>{t('extension.noEvents')}</p> : <>
          <div className="fl-extension-records">{selected.events.map(event => <button type="button" key={event.id}
            className={`fl-button${selectedEvent?.id === event.id ? ' fl-extension-selected' : ''}`}
            onClick={() => { setEventId(event.id) }}>
            <code>#{event.seq} · {event.type}</code>
            <small>{new Date(event.time).toLocaleTimeString()} · {event.turn === null
              ? t('events.unscoped') : t('turn.title', { turn: event.turn })}
              {event.step !== null && ` · ${t('step.title', { step: event.step })}`}
              {event.transient && ` · ${t('events.transient')}`}</small>
          </button>)}</div>
          {selectedEvent !== undefined && <details open><summary>{t('details.raw')}</summary>
            <JsonHighlight text={JSON.stringify(selectedEvent.raw, null, 2)} /></details>}
        </>}
      </>}
    </aside>
  </div>
}
