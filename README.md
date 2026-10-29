# DSH Inspector Plugins

English | [简体中文](README.zh.md)

![DSH Inspector Plugins — understand the loop, inspect the wire](docs/assets/banner.svg)

[![MIT](https://img.shields.io/badge/license-MIT-38bdf8)](LICENSE) [![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-22c55e)](#quickstart) [![pnpm](https://img.shields.io/badge/pnpm-11.7.0-fbbf24)](package.json) ![Independent community project](https://img.shields.io/badge/community-independent-a78bfa)

## Summary

Two focused plugins turn DeepSeek Harness Web into a place to learn and debug an Agent. **Flow Lens** explains recorded execution, prompts, tools, and source entry points. **LLM Wire Debug** exposes original cURL, HTTP bodies, SSE, and readable responses. They add conversation tabs beside Trajectory without replacing the host or modifying its Agent loop. This is an independent community project, not an official DeepSeek release.

> [!WARNING]
> Wire Debug intentionally saves **unredacted credentials, prompts, and responses**. Use it only in a trusted local environment and read [Security](SECURITY.md) first. Never publish real captures. All screenshots below use synthetic demonstration data.

## Table of Contents

- [See it in action](#see-it-in-action)
- [Two complementary views](#two-complementary-views)
- [A learning path](#a-learning-path)
- [Quickstart](#quickstart)
- [Compatibility and limits](#compatibility-and-limits)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## See it in action

These are actual plugin pages running in DeepSeek Harness Web, not product mockups. Session events, request content, token counts, and responses are synthetic fixtures; no model call was made to produce these screenshots. The UI supports Chinese and English; these captures show Chinese.

### Follow the Agent, not a wall of JSON

![Flow Lens six-stage learning guide](docs/assets/flow-overview.png)

Begin with input → prompt → request → response → tools → continue / end. Distinguish Turn / Step / Attempt and move from recorded facts to the execution graph, event timeline, and relevant source files.

### Read the effective Prompt in sections

![Flow Lens prompt reader with numbered sections and syntax highlighting](docs/assets/flow-prompt.png)

Inspect the effective System prompt, available tools, and model configuration for an attempt. Headings, code, variables, tags, and paths have distinct highlighting; switch to raw text for exact formatting. This snapshot is not the final HTTP message history.

### Turn SSE fragments into a readable response

![LLM Wire Debug response reconstructed from synthetic SSE](docs/assets/wire-response.png)

Read assembled text, proposed tool calls, finish status, and usage alongside raw files. WebSocket updates refresh captures as the host records them; the reading view does not rewrite saved bytes. Optional Chinese prompt translation makes a separate provider call and is not the original prompt.

## Two complementary views

Choose a view by the question you are investigating. Flow Lens explains Session records; Wire Debug inspects matching HTTP requests across the host process. They are complementary, not a precise Session-to-request correlation system.

![Flow Lens reads Session events; Wire Debug captures model HTTP traffic](docs/assets/two-views.svg)

| Your question | Flow Lens · execution | LLM Wire Debug · transport |
| --- | --- | --- |
| What happened in this turn? | Learning guide, graph, tool branches | Process-wide captures, not precisely Session-bound |
| What did the Agent receive? | Effective System prompt, tools, and config | Original HTTP body and headers |
| What did the model return? | Recorded response and tool results | Raw SSE / JSON and reconstructed response |
| Where is it implemented? | Source paths, symbols, extension reference | Artifact explanations and source references |
| Can I inspect it live? | Loaded Session and transient events | Authenticated WebSocket refresh and retained chunks |
| Can I replay or translate? | Inspect recorded evidence | Original cURL; optional Chinese prompt translation |

Configuration and behavior: [Flow Lens guide](packages/flow-lens/README.md) · [LLM Wire Debug guide](packages/llm-wire-debug/README.md).

## A learning path

Start with a short task that uses one tool, and keep the host's Trajectory tab available as another view of the same conversation.

1. **Follow a turn.** Open Flow Lens → Learning guide and follow the six stages.
2. **Explain a tool call.** Select the prompt and response in the graph, then compare the proposed call with the recorded tool result.
3. **Find the implementation.** Copy the source path and symbol into your Harness checkout in WebStorm. The extension map is a static reading guide, not callback instrumentation.
4. **Inspect the wire.** Open LLM Wire, read the full request, then compare the parsed response with raw SSE. Timestamp order alone does not establish Session ownership.

## Quickstart

This repository builds **plugins**, not a standalone chat application. You need an existing DeepSeek Harness Web installation, Node `^22.19.0 || >=24.0.0`, and pnpm `11.7.0`. Building and synthetic tests require no provider key; real Agent tasks use your host's provider configuration.

### 1. Build local installation archives

```sh
git clone https://github.com/hubbili/dsh-inspector-plugins.git
cd dsh-inspector-plugins
pnpm install --frozen-lockfile --registry https://registry.npmjs.org/
pnpm build
pnpm --dir packages/flow-lens pack --out ../../artifacts/flow-lens.tgz
pnpm --dir packages/llm-wire-debug pack --out ../../artifacts/llm-wire-debug.tgz
```

### 2. Install into your Harness Web profile

From this repository, use the `dsh` executable supplied by your existing Harness installation. These are local archives; no npm publication of these plugins is assumed.

```sh
dsh plugin --profile web add ./artifacts/flow-lens.tgz ./artifacts/llm-wire-debug.tgz
dsh web --patch ./examples/wire-debug.overlay.yml --no-open
```

If you launch Harness from source with `pnpm dsh`, execute the equivalent commands in that checkout and use absolute paths to the archives and overlay. Installing into one profile does not install into every profile.

### 3. Open the new tabs

Open the URL printed by the host, select a conversation, and look after Trajectory for **Flow Lens / 执行图** and **LLM Wire / 模型原始数据**. Run a new task to populate captures; installing a plugin cannot recover HTTP traffic from past runs.

The [example overlay](examples/wire-debug.overlay.yml) explicitly sets `allowSecrets: true` and saves captures under `DSH_HOME/llm-wire-traces`. Without this acknowledgement, Wire Debug refuses activation. `translatePrompt` is off; enabling it sends an additional billed request to the original provider. Overlay config objects replace earlier config objects, so preserve `outputDirectory` when editing the example.

> [!TIP]
> Only need execution learning? Build and install `flow-lens.tgz` alone, then launch `dsh web --no-open` without the Wire Debug overlay.

## Compatibility and limits

The plugins target published Harness types `0.1.6-alpha.2`. Harness APIs are pre-stable; this is not a compatibility guarantee for every host revision. Both packages build independently from public dependencies without a parent Harness checkout.

- **Session evidence, not exhaustive tracing.** Prompt snapshots do not show each contributing plugin callback. Extension references are static; durations are not isolated network latency. Counts cover loaded history.
- **Process-wide capture.** Wire Debug wraps global `fetch` for matching POST `/messages` and `/chat/completions` requests. Other transports are outside this path. Captures may include other Sessions, subagents, retries, and title-generation calls.
- **Readable does not mean complete.** Capture limits, cancellation, or incomplete streams can leave partial data; inspect warnings. A proposed tool call does not establish that the tool ran.
- **Translation is auxiliary.** Chinese prompt translation can be inaccurate, costs an extra provider call, and cannot replace the original request.
- **Local debugging, sensitive files.** Do not expose the capture UI publicly or upload real trace directories to issues. See [Security](SECURITY.md).

## FAQ

Common setup questions are collected here; package-level settings remain in the package guides.

<details>
<summary><strong>Why are the new tabs missing?</strong></summary>

Install into the profile you actually launch, restart the host, and open a conversation rather than the welcome screen. Resolve activation failures first; Wire Debug requires explicit `allowSecrets` acknowledgement.

</details>

<details>
<summary><strong>Why does WebStorm still run the old version?</strong></summary>

The installed profile uses the built archive, not edits to this repository's TypeScript. Rebuild, repack, reinstall the changed plugin into the same profile, restart the host, and reload the browser. Use a supported Node version. A busy port means another process owns it; `sudo` does not resolve that conflict.

</details>

<details>
<summary><strong>Can I publish original cURL in a bug report?</strong></summary>

No: it may contain working credentials and private messages. Keep original files local and create a separate sanitized reproduction for public reports. The plugin deliberately does not redact capture output.

</details>

## Contributing

Contributions to learning clarity, protocol parsing, compatibility, and documentation are welcome. Keep changes focused on the two plugins; the Harness application remains an external dependency.

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
# After reviewing and staging publication files:
pnpm check:release
```

The release check examines indexed paths, limited credential patterns, and approved documentation assets; it is not a comprehensive secret scanner. Review staged files, screenshots, and each package's `pnpm pack --dry-run` output yourself. Never commit real captures, profiles, `.env`, credentials, generated `lib/`, dependencies, or installation archives. Report bugs with a synthetic reproduction via [Issues](https://github.com/hubbili/dsh-inspector-plugins/issues).

## License

MIT; see [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md). This repository contains the two plugin packages and supporting tests, documentation, and build tooling—not the Harness application.

### Dev Note

None.
