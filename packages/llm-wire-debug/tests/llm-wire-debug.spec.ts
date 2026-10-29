/** Filesystem index and path-containment tests for the local trace API. */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { listTraces, traceFilePath } from '../src/llm-wire-debug.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'dsh-llm-wire-debug-'))
  temporaryDirectories.push(path)
  return path
}

it('lists newest captures first and exposes only viewer artifacts', async () => {
  const output = await temporaryDirectory()
  const older = join(output, '2026-09-25T01-00-00.000Z-older')
  const newer = join(output, '2026-09-25T02-00-00.000Z-newer')
  await Promise.all([mkdir(older), mkdir(newer)])
  await Promise.all([
    writeFile(join(older, 'curl.sh'), 'curl'),
    writeFile(join(newer, 'response.raw'), 'data'),
    writeFile(join(newer, 'unrelated.txt'), 'hidden'),
  ])

  await expect(listTraces(output, 1)).resolves.toMatchObject([{
    id: '2026-09-25T02-00-00.000Z-newer',
    files: ['response.parsed.json', 'response.raw'],
  }])
})

it('returns an empty list before the capture directory exists', async () => {
  const output = await temporaryDirectory()
  await expect(listTraces(join(output, 'missing'), 100)).resolves.toEqual([])
})

it('allows only named artifacts below a single capture directory', async () => {
  const output = await temporaryDirectory()
  expect(traceFilePath(output, 'capture-1', 'curl.sh')).toBe(join(output, 'capture-1', 'curl.sh'))
  expect(traceFilePath(output, 'capture-1', 'response.parsed.json')).toBe(join(output, 'capture-1', 'response.parsed.json'))
  expect(traceFilePath(output, '../capture-1', 'curl.sh')).toBeUndefined()
  expect(traceFilePath(output, '..', 'curl.sh')).toBeUndefined()
  expect(traceFilePath(output, 'capture-1', '../curl.sh')).toBeUndefined()
  expect(traceFilePath(output, 'capture-1', 'secret.txt')).toBeUndefined()
})
