/** Keyless expectations for learning navigation and selection-bound raw content. */

import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ARTIFACTS, ARTIFACT_GROUPS, availableArtifacts, filterTraces, selectedArtifactContent } from '../src/client/artifacts.ts'
import { en, zh } from '../src/client/locales.ts'

it('starts with the full request and keeps all captured artifacts in three groups', () => {
  const files = [
    'prompt.zh.md', 'prompt.zh.error.txt', 'prompt.original.json', 'request-body.json',
    'response.raw', 'response.parsed.json', 'curl.sh', 'request-headers.json',
    'response-headers.json', 'response-meta.json', 'transport-error.txt',
  ]
  const artifacts = availableArtifacts(files)
  expect(artifacts[0]?.file).toBe('request-body.json')
  expect(artifacts.map(artifact => artifact.file).toSorted()).toEqual(files.toSorted())
  expect(availableArtifacts(['not-allowlisted.txt'])).toEqual([])
  expect(availableArtifacts(['response.raw'])).toEqual([ARTIFACTS.find(artifact => artifact.file === 'response.raw')])
  expect({
    scope: { zh: zh['scope.description'], en: en['scope.description'] },
    learningDetails: { zh: zh['help.learningDetails'], en: en['help.learningDetails'] },
    groups: ARTIFACT_GROUPS.map(group => ({ id: group.id, zh: zh[group.label], en: en[group.label] })),
    artifacts: artifacts.map(artifact => ({
      file: artifact.file,
      group: artifact.group,
      label: zh[artifact.label],
      what: zh[artifact.explanation],
      phase: zh[artifact.phase],
      focus: zh[artifact.focus],
      source: artifact.source,
      symbol: artifact.symbol,
      coreSources: artifact.coreSources?.map(source => ({ path: source.path, symbol: source.symbol, label: zh[source.label] })),
    })),
  }).toMatchSnapshot()
})

it('searches identifiers and exact timestamp strings without reordering traces', () => {
  const traces = [
    { id: '2026-10-12T01-00-00.000Z-Trace-A', createdAt: '2026-10-12T01:00:00.000Z', files: [] },
    { id: '2026-10-11T02-00-00.000Z-Trace-B', createdAt: '2026-10-11T02:00:00.000Z', files: [] },
  ]
  expect(filterTraces(traces, '  trace-a ')).toEqual([traces[0]])
  expect(filterTraces(traces, '02:00:00')).toEqual([traces[1]])
  expect(filterTraces(traces, '2026')).toEqual(traces)
  expect(filterTraces(traces, 'not-found')).toEqual([])
  expect(filterTraces(traces, '')).toBe(traces)
  expect(filterTraces(traces, '10月12日', trace => trace === traces[0] ? '10月12日 09:00' : '10月11日 10:00')).toEqual([traces[0]])
})

it('never exposes a settled raw result under a different trace or file', () => {
  const content = { traceId: 'trace-a', file: 'request-body.json', text: 'original request' }
  expect(selectedArtifactContent(content, 'trace-a', 'request-body.json')).toBe(content)
  expect(selectedArtifactContent(content, 'trace-b', 'request-body.json')).toBeUndefined()
  expect(selectedArtifactContent(content, 'trace-a', 'response.raw')).toBeUndefined()
  expect(selectedArtifactContent(content, undefined, undefined)).toBeUndefined()
  expect(selectedArtifactContent(undefined, 'trace-a', 'request-body.json')).toBeUndefined()
  const failure = { traceId: 'trace-a', file: 'response.raw', error: 'read failed' }
  expect(selectedArtifactContent(failure, 'trace-b', 'response.raw')).toBeUndefined()
  expect(selectedArtifactContent(failure, 'trace-a', 'response.raw')).toBe(failure)
})

it('keeps English and Chinese learning copy complete', () => {
  expect(Object.keys(en).toSorted()).toEqual(Object.keys(zh).toSorted())
  for (const artifact of ARTIFACTS) {
    expect(en[artifact.explanation].length).toBeGreaterThan(0)
    expect(en[artifact.phase].length).toBeGreaterThan(0)
    expect(en[artifact.focus].length).toBeGreaterThan(0)
  }
  expect(zh['scope.description']).toContain('列表摘要没有精确 Session / step 绑定')
  expect(zh['scope.description']).toContain('会话标题等辅助请求')
  expect(zh['scope.description']).toContain('最新记录不一定是当前 Agent 步骤')
  expect(zh['help.translationWarning']).toContain('不是原始 Prompt')
})

it('references local plugin files and relative upstream source symbols', () => {
  for (const artifact of ARTIFACTS) {
    for (const reference of [
      { path: artifact.source, symbol: artifact.symbol },
      ...artifact.coreSources ?? [],
    ]) {
      expect(reference.path.split('/')).not.toContain('..')
      expect(reference.path).toMatch(/^packages\/[a-z0-9/-]+\.ts$/)
      expect(reference.symbol.length).toBeGreaterThan(0)
      if (!reference.path.startsWith('packages/llm-wire-debug/')) continue
      const source = readFileSync(new URL(`../../../${reference.path}`, import.meta.url), 'utf8')
      for (const symbol of reference.symbol.split(' / ')) {
        const member = symbol.split('.').at(-1)
        expect(source, reference.path).toContain(`${member}(`)
      }
    }
  }
})
