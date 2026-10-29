import { defineConfig, type UserConfig } from 'tsdown'

const id = 'dsh-plugin-llm-wire-debug'
const externals = new Set(['@deepseek-ai/cordis', 'react', 'react/jsx-runtime'])

const host: UserConfig = {
  name: id,
  entry: { index: 'src/llm-wire-debug.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: true,
  deps: { neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery', 'ws'] },
  outputOptions: { entryFileNames: '[name].js' },
}

const client: UserConfig = {
  name: `${id}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: specifier => externals.has(specifier),
    alwaysBundle: specifier => !externals.has(specifier),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapExcludeSources: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default defineConfig([host, client])
