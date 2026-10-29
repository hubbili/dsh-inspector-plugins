---
description: "Build and install two independent DeepSeek Harness learning and debugging plugins."
---
# DSH Inspector Plugins

English | [中文](README.zh.md)

## Summary

Explore Agent execution with Flow Lens and inspect model requests with LLM Wire Debug. The repository contains only these two community plugins, their tests, and build documentation; DeepSeek Harness itself is an external host. Wire Debug deliberately preserves credentials and private content without redaction. Read [Security](SECURITY.md) before enabling capture.

## Table of Contents

- [Choose a plugin](#choose-a-plugin)
- [Build and install](#build-and-install)
- [Development](#development)
- [License](#license)

## Choose a plugin

The plugins add separate conversation tabs without replacing the host's Trajectory view.

| Plugin | Purpose |
| --- | --- |
| [Flow Lens](packages/flow-lens/README.md) | Six-stage learning guide, execution graph, highlighted prompts, event timeline, and extension reference map. |
| [LLM Wire Debug](packages/llm-wire-debug/README.md) | Original cURL and HTTP JSON, raw SSE, readable responses, WebSocket updates, and optional Chinese prompt translation. |

## Build and install

Use Node `^22.19.0 || >=24.0.0`, pnpm `11.7.0`, and an existing DeepSeek Harness Web installation. Plugin types target Harness `0.1.6-alpha.2`; its APIs are pre-stable. A provider key is not required to build or run the synthetic tests. Start in this repository after cloning it.

```sh
pnpm install --frozen-lockfile --registry https://registry.npmjs.org/
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm --dir packages/flow-lens pack --out ../../artifacts/flow-lens.tgz
pnpm --dir packages/llm-wire-debug pack --out ../../artifacts/llm-wire-debug.tgz
```

Install the local archives through the `dsh` command from your existing Harness installation. These instructions do not require an npm publication of the plugins.

```sh
dsh plugin --profile web add ./artifacts/flow-lens.tgz ./artifacts/llm-wire-debug.tgz
dsh web --patch ./examples/wire-debug.overlay.yml --no-open
```

The overlay explicitly acknowledges that credentials will be saved. Without it, Wire Debug refuses to activate because its bundled `allowSecrets` is false. The bundle writes to `DSH_HOME/llm-wire-traces`; translation is off until you enable `translatePrompt` in the overlay, which makes an additional billed call to the original provider. Open the URL printed by the host, select a Session, and use the Flow Lens or LLM Wire tab. Restart a running host after installing or rebuilding a plugin; do not use `sudo` to resolve a port conflict.

## Development

Both packages install from public dependencies and build without a parent Harness checkout. Source references in the learning views refer either to this plugin repository or to a separate Harness checkout; they are static reading aids, not traced function calls. Captures are process-wide and are not precisely bound to the selected Session or step.

Run type checks, synthetic unit snapshots, lint, builds, and `pnpm check:release` locally before publishing. The release check reads indexed paths and a limited set of credential patterns; it is not a comprehensive secret scanner. Review both Git's staged file list and each package's `pnpm pack --dry-run` output before publishing. Never include real captures, profiles, `.env`, or credentials. Keep generated `lib/`, `artifacts/`, and dependencies out of Git; built files belong inside the installation archives.

## License

MIT; see [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). This is an independent community project, not an official DeepSeek release.

### Dev Note

None.
