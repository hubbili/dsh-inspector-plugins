/** Check indexed publication scope and reject common credential literals without printing their values. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { TextDecoder } from 'node:util'

const rootFiles = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.gitignore',
  'README.md', 'README.zh.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md'])
const prefixes = ['packages/flow-lens/', 'packages/llm-wire-debug/', 'examples/', 'scripts/', '.github/workflows/']
const assets = new Set(['banner.svg', 'two-views.svg', 'flow-overview.png', 'flow-prompt.png', 'wire-response.png']
  .map(file => `docs/assets/${file}`))
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
assert(files.length > 0, 'Stage the reviewed release files before checking publication scope')
const forbiddenPath = /(?:^|\/)(?:node_modules|lib|vendor|traces|llm-wire-traces|logs|dev-profile|\.dsh|\.git|\.idea)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:^|\/)\.npmrc$|\.(?:tgz|tsbuildinfo|pem|key|p12)$/
const secrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bsk-[A-Za-z0-9]{24,}\b/,
]
let failed = false

/** Restrict curated screenshots to pixel data; pixel contents still require human review. */
function checkPng(bytes) {
  assert(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'Invalid PNG signature')
  let offset = 8
  let pixels = false
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset)
    const kind = bytes.toString('ascii', offset + 4, offset + 8)
    assert(offset + size + 12 <= bytes.length, 'Truncated PNG chunk')
    assert(['IHDR', 'IDAT', 'IEND'].includes(kind), 'PNG metadata is not allowed')
    if (offset === 8) {
      assert(kind === 'IHDR' && size === 13, 'Missing PNG header')
      const width = bytes.readUInt32BE(offset + 8)
      const height = bytes.readUInt32BE(offset + 12)
      assert(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'PNG dimensions exceed limit')
    } else assert(kind !== 'IHDR', 'Duplicate PNG header')
    offset += size + 12
    if (kind === 'IDAT') pixels = true
    if (kind === 'IEND') {
      assert(size === 0 && pixels && offset === bytes.length, 'Invalid PNG end or trailing data')
      return
    }
  }
  assert.fail('Missing PNG end')
}

/** Lint this project's static primitive-only artwork, not arbitrary uploaded SVG. */
function checkSvg(content) {
  assert(/<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(content), 'Missing SVG namespace')
  assert(!/<!|<\?|&#|\\|url\s*\(|@import|\s(?:[\w-]+:)?(?:on[\w-]*|href|src|style)\s*=/i.test(content), 'Active SVG or references are not allowed')
  const tags = new Set(['svg', 'g', 'rect', 'path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'text', 'tspan', 'title', 'desc'])
  for (const match of content.matchAll(/<\/?([a-zA-Z][\w:.-]*)\b/g)) assert(tags.has(match[1]), 'Unsupported SVG element')
}

for (const file of files) {
  if ((!rootFiles.has(file) && !assets.has(file) && !prefixes.some(prefix => file.startsWith(prefix))) || forbiddenPath.test(file)) {
    console.error(`Disallowed release path: ${file}`)
    failed = true
    continue
  }
  const size = Number(execFileSync('git', ['cat-file', '-s', `:${file}`], { encoding: 'utf8' }).trim())
  const limit = assets.has(file) ? (file.endsWith('.png') ? 2 * 1024 * 1024 : 256 * 1024) : 4 * 1024 * 1024
  if (size > limit) {
    console.error(`Release file exceeds size limit: ${file}`)
    failed = true
    continue
  }
  const bytes = execFileSync('git', ['show', `:${file}`], { maxBuffer: limit + 1 })
  let content
  try {
    if (assets.has(file) && file.endsWith('.png')) {
      checkPng(bytes)
      continue
    }
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (assets.has(file)) checkSvg(content)
  } catch {
    // Invalid assets are reported by path only; captured content must never reach diagnostics.
    console.error(`Invalid or unsupported release asset: ${file}`)
    failed = true
    continue
  }
  if (secrets.some(pattern => pattern.test(content)) || /\/Users\/[A-Za-z0-9_-]+\//.test(content)) {
    console.error(`Credential-like value or personal absolute path in: ${file}`)
    failed = true
  }
}
assert(!failed, 'Release scope or credential check failed; inspect locally without sharing secret values')
console.log(`Release scope checked: ${files.length} tracked files; no matches for configured credential patterns`)
