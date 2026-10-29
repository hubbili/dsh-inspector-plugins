---
description: "Inspect unredacted model HTTP requests, cURL, SSE and optional Chinese prompt translations locally."
kind: "package-bundle"
---
# LLM Wire Debug

English | [中文](README.zh.md)

## Summary

Inspect original request bodies, authentication headers, replayable cURL, and raw response bytes for POST `/messages` and `/chat/completions` calls. Read reconstructed responses and ordered request messages without replacing their original JSON. Watch retained SSE chunks through the authenticated WebSocket view. Optional Chinese prompt translation makes another billed call to the original provider.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Read [Security](../../SECURITY.md), then follow the repository's [local archive installation](../../README.md#build-and-install). The [bundle](cordis.patch.yml) requires an explicit `allowSecrets: true` override, supplied by the [example overlay](../../examples/wire-debug.overlay.yml); without it, startup reports that this plugin refuses activation. The default bundle keeps `translatePrompt` false and stores captures under `DSH_HOME/llm-wire-traces`. Enable translation only when you authorize sending the input to the original provider again.

## Understand the implementation

<details>
<summary>Implementation internals</summary>

The [Host plugin](src/llm-wire-debug.ts) wraps process-wide `fetch`, retains consumed response bytes up to `maxResponseBytes`, and restores its wrapper on disposal. It uses private directories and file permissions on POSIX. The [parser](src/response-parser.ts) reconstructs public response fields; truncation and parse errors remain visible. HTTP artifact reads and [WebSocket updates](src/trace-live-server.ts) use the host's connection authorization. Reading view is derived display only; Copy always copies the complete original file. Translation bypasses capture to avoid recursion.

</details>

## Model Experience

Capture does not alter the original model request or register model tools. With `translatePrompt` enabled, an auxiliary request sends model-visible input to the same endpoint, model, and credentials. Translation can omit or mistranslate content; it is not the original prompt.

## Known Limitations and Deferred Work

Captures include secrets without redaction. Process-wide records can include other Sessions, retries, Agents, and title generation; timestamps do not establish ownership, and the selected Session does not isolate access. Capture ends as the host consumes or cancels the stream; truncated files are not complete responses. WebSocket chunks may be dropped for slow readers, which then reload authoritative files. Tool-call cards show model requests, not proven execution. Replayable cURL can repeat provider charges. Source references are static reading aids, not execution traces. Use fake data in tests and reports.

### Dev Note

None.
