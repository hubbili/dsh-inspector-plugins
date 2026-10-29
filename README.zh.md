# DSH Inspector Plugins

[English](README.md) | 简体中文

![DSH Inspector Plugins — 看懂执行过程，检查原始请求](docs/assets/banner.svg)

[![MIT](https://img.shields.io/badge/license-MIT-38bdf8)](LICENSE) [![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-22c55e)](#快速开始) [![pnpm](https://img.shields.io/badge/pnpm-11.7.0-fbbf24)](package.json) ![独立社区项目](https://img.shields.io/badge/community-independent-a78bfa)

## 摘要

两个专注的插件，让 DeepSeek Harness Web 成为学习与调试 Agent 的入口。**执行图（Flow Lens）**解释已记录的执行过程、Prompt、工具和源码入口。**模型原始数据（LLM Wire Debug）**展示原始 cURL、HTTP 请求体、SSE 和可读响应。它们在“轨迹”旁新增会话 Tab，不替换宿主，也不修改 Agent loop。这是独立社区项目，并非 DeepSeek 官方发行。

> [!WARNING]
> 模型原始数据会保存**未经脱敏的凭据、提示词和响应**。仅在可信本地环境中使用，请先阅读[安全说明](SECURITY.md)。不要公开真实抓包文件。下方所有截图均使用合成演示数据。

## 目录

- [先看效果](#先看效果)
- [两种互补视角](#两种互补视角)
- [学习路径](#学习路径)
- [快速开始](#快速开始)
- [兼容性与边界](#兼容性与边界)
- [常见问题](#常见问题)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 先看效果

这些截图来自运行在 DeepSeek Harness Web 中的真实插件，不是产品效果图。会话事件、请求内容、Token 数量和响应均为合成记录；制作截图没有调用大模型。产品界面支持中英文；这里展示中文界面。

### 跟着 Agent 走，而不是先读一屏 JSON

![执行图六阶段学习导览](docs/assets/flow-overview.png)

从输入 → Prompt → 请求 → 响应 → 工具 → 继续 / 结束入门。区分 Turn / Step / Attempt，再从已记录事实深入执行图、事件时间轴和相关源码。

### 分区阅读真正生效的 Prompt

![执行图 Prompt 阅读器：带编号的段落与语法高亮](docs/assets/flow-prompt.png)

检查一次尝试中生效的 System 提示词、可用工具和模型配置。标题、代码、变量、标签、路径采用高亮区分；需要核对格式时可切换原文。这个快照不是最终 HTTP 消息历史。

### 把 SSE 碎片读成完整响应

![模型原始数据：从合成 SSE 重建的可读响应](docs/assets/wire-response.png)

把拼接后的正文、拟议工具调用、结束状态、用量与原始文件对照阅读。宿主记录数据时，WebSocket 实时更新抓包视图；阅读视图不改写保存的字节。可选的中文 Prompt 翻译会单独请求服务，不是原始提示词。

## 两种互补视角

根据要排查的问题选择页面。执行图解释 Session 记录；模型原始数据检查整个宿主进程中符合条件的 HTTP 请求。二者互补，但不是精确的 Session 与请求关联系统。

![执行图读取 Session 事件，模型原始数据捕获模型 HTTP 流量](docs/assets/two-views.svg)

| 你的问题 | 执行图 · 执行视角 | 模型原始数据 · 传输视角 |
| --- | --- | --- |
| 这一轮发生了什么？ | 学习导览、执行图、工具分支 | 进程级抓包，尚未精确绑定 Session |
| Agent 收到了什么？ | 生效的 System 提示词、工具和配置 | 原始 HTTP 请求体与请求头 |
| 模型返回了什么？ | 记录中的响应与工具结果 | 原始 SSE / JSON 与重建后的响应 |
| 对应的源码在哪里？ | 源码路径、符号、扩展点参考 | 产物说明与源码参考 |
| 能否实时查看？ | 已加载的会话事件与瞬态事件 | 经身份验证的 WebSocket 刷新与保留的数据块 |
| 能否重放或翻译？ | 检查记录中的证据 | 原始 cURL；可选中文 Prompt 翻译 |

配置与具体行为见：[执行图指南](packages/flow-lens/README.zh.md) · [模型原始数据指南](packages/llm-wire-debug/README.zh.md)。

## 学习路径

从一次简短、只用一个工具的任务开始，保留宿主的“轨迹”页面，从另一视角查看同一次对话。

1. **跟踪一轮执行。** 打开执行图 → 学习导览，沿着六个阶段阅读。
2. **解释一次工具调用。** 在图中选择提示词与响应，把模型提出的调用和记录中的实际工具结果对照起来。
3. **定位实现。** 把源码路径和符号复制到 WebStorm 中的 Harness 源码目录。扩展点地图是静态阅读参考，不是回调追踪。
4. **检查网络数据。** 打开模型原始数据，检查完整请求，再对照可读响应与原始 SSE。不要仅凭时间先后推断请求属于哪个 Session。

## 快速开始

本仓库构建的是**插件**，不是独立聊天应用。需要已有的 DeepSeek Harness Web 安装、Node `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`。构建与合成数据测试不需要服务密钥；真实 Agent 任务使用宿主的模型配置。

### 1. 构建本地安装包

```sh
git clone https://github.com/hubbili/dsh-inspector-plugins.git
cd dsh-inspector-plugins
pnpm install --frozen-lockfile --registry https://registry.npmjs.org/
pnpm build
pnpm --dir packages/flow-lens pack --out ../../artifacts/flow-lens.tgz
pnpm --dir packages/llm-wire-debug pack --out ../../artifacts/llm-wire-debug.tgz
```

### 2. 安装到 Harness 的 Web Profile

在本仓库目录下，使用已有 Harness 安装提供的 `dsh` 命令。这些是本地压缩包，不假定插件已经发布到 npm。

```sh
dsh plugin --profile web add ./artifacts/flow-lens.tgz ./artifacts/llm-wire-debug.tgz
dsh web --patch ./examples/wire-debug.overlay.yml --no-open
```

如果通过 `pnpm dsh` 从源码启动 Harness，请在其源码目录执行等效命令，并使用压缩包与覆盖文件的绝对路径。安装到一个 Profile，不会自动安装到所有 Profile。

### 3. 打开新增页面

打开宿主输出的地址，选择会话，在“轨迹”后找到 **Flow Lens / 执行图** 和 **LLM Wire / 模型原始数据**。运行一次新任务后才有新的抓包记录；安装插件不能恢复过去运行的 HTTP 流量。

[示例覆盖配置](examples/wire-debug.overlay.yml)显式设置 `allowSecrets: true`，将抓包保存到 `DSH_HOME/llm-wire-traces`。没有这项确认时，模型原始数据拒绝启用。`translatePrompt` 默认关闭；启用后会向原服务额外发送一次付费请求。覆盖配置会替换之前的 config 对象，因此编辑示例时请保留 `outputDirectory`。

> [!TIP]
> 只想学习执行过程？单独构建并安装 `flow-lens.tgz`，直接运行 `dsh web --no-open`，不加载模型原始数据的覆盖配置即可。

## 兼容性与边界

插件类型针对已发布的 Harness `0.1.6-alpha.2`。Harness API 尚未稳定，这不是对每个宿主版本的兼容承诺。两个包从公开依赖独立构建，不需要父级 Harness 源码目录。

- **会话证据，不是全量追踪。** Prompt 快照不展示每个贡献插件的回调。扩展点参考是静态的；耗时不等于纯网络延迟。统计范围是已加载的历史。
- **捕获范围是整个进程。** 模型原始数据包装全局 `fetch`，捕获匹配 POST `/messages` 和 `/chat/completions` 的请求。其他传输方式不在此路径内。记录可能包含其他 Session、子 Agent、重试和标题生成请求。
- **可读不代表完整。** 捕获上限、取消或未完成的流可能导致数据不完整，请查看警告。模型提出工具调用，不代表工具已经执行。
- **翻译只是辅助。** 中文 Prompt 翻译可能不准确，会增加一次服务调用费用，不能替代原始请求。
- **本地调试，文件敏感。** 不要将抓包界面公开到公网，也不要在 Issue 中上传真实抓包目录。详见[安全说明](SECURITY.md)。

## 常见问题

这里收集常见的启动问题；包级配置仍以对应包文档为准。

<details>
<summary><strong>为什么看不到新增 Tab？</strong></summary>

检查插件是否安装到了实际启动的 Profile，重启宿主，再打开会话，而不是停留在欢迎页。先解决激活失败；模型原始数据需要显式确认 `allowSecrets`。

</details>

<details>
<summary><strong>为什么 WebStorm 运行时还是旧版本？</strong></summary>

安装后的 Profile 使用已构建压缩包，不会直接读取本仓库中修改过的 TypeScript。重新构建、打包、把变化的插件安装到同一 Profile，再重启宿主并刷新浏览器。Node 版本需要满足要求。端口被占用代表已有其他进程监听，`sudo` 不能解决这个冲突。

</details>

<details>
<summary><strong>能把原始 cURL 发到公开 Issue 吗？</strong></summary>

不能直接发布：其中可能包含可用凭据和私密消息。保留原始文件在本地，另做一份脱敏的最小复现用于公开报告。插件本身有意不对捕获输出脱敏。

</details>

## 参与贡献

欢迎改进学习体验、协议解析、兼容性与文档。改动范围保持在两个插件之内；Harness 应用本身是外部依赖。

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
# 检查并暂存准备公开的文件后运行：
pnpm check:release
```

发布检查读取 Git 索引中的路径、有限的凭据模式，以及允许公开的文档图片；它不是完整的密钥扫描器。请人工检查暂存文件、截图，以及每个包的 `pnpm pack --dry-run` 输出。不要提交真实抓包、Profile、`.env`、凭据、生成的 `lib/`、依赖或安装包。通过 [Issues](https://github.com/hubbili/dsh-inspector-plugins/issues) 提交合成数据复现。

## 许可证

MIT，详见 [LICENSE](LICENSE) 和[第三方声明](THIRD_PARTY_NOTICES.md)。本仓库只包含两个插件包及配套测试、文档和构建工具，不包含 Harness 应用。

### 开发备注

无。
