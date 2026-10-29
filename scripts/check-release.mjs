/** Check indexed publication scope and reject common credential literals without printing their values. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const rootFiles = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.gitignore',
  'README.md', 'README.zh.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md'])
const prefixes = ['packages/flow-lens/', 'packages/llm-wire-debug/', 'examples/', 'scripts/', '.github/workflows/']
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
for (const file of files) {
  if ((!rootFiles.has(file) && !prefixes.some(prefix => file.startsWith(prefix))) || forbiddenPath.test(file)) {
    console.error(`Disallowed release path: ${file}`)
    failed = true
    continue
  }
  const content = execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' })
  if (secrets.some(pattern => pattern.test(content)) || /\/Users\/[A-Za-z0-9_-]+\//.test(content)) {
    console.error(`Credential-like value or personal absolute path in: ${file}`)
    failed = true
  }
}
assert(!failed, 'Release scope or credential check failed; inspect locally without sharing secret values')
console.log(`Release scope checked: ${files.length} tracked files; no matches for configured credential patterns`)
