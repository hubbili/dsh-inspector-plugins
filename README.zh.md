---
description: "构建和安装两个独立的 DeepSeek Harness 学习与调试插件。"
---
# DSH Inspector Plugins

[English](README.md) | 中文

## 摘要

通过执行图学习 Agent 执行过程，通过模型原始数据检查模型请求。本仓库只包含这两个社区插件、测试和构建文档；DeepSeek Harness 本身是外部宿主。模型原始数据会完整保留凭据与私密内容，不做脱敏。启用捕获前请阅读[安全说明](SECURITY.md)。

## 目录

- [选择插件](#选择插件)
- [构建和安装](#构建和安装)
- [开发](#开发)
- [许可证](#许可证)

## 选择插件

两个插件新增独立的会话 Tab，不替换宿主的“轨迹”页面。

| 插件 | 用途 |
| --- | --- |
| [执行图](packages/flow-lens/README.zh.md) | 六阶段学习导览、执行图、提示词高亮、事件时间轴和扩展点参考地图。 |
| [模型原始数据](packages/llm-wire-debug/README.zh.md) | 原始 cURL 与 HTTP JSON、原始 SSE、可读响应、WebSocket 更新和可选中文提示词翻译。 |

## 构建和安装

需要 Node `^22.19.0 || >=24.0.0`、pnpm `11.7.0`，以及已有的 DeepSeek Harness Web 安装。插件类型针对 Harness `0.1.6-alpha.2`，其 API 尚未稳定。构建与合成数据测试不需要模型密钥。克隆仓库后，在仓库根目录执行。

```sh
pnpm install --frozen-lockfile --registry https://registry.npmjs.org/
pnpm typecheck
pnpm test
pnpm lint
pnpm build
pnpm --dir packages/flow-lens pack --out ../../artifacts/flow-lens.tgz
pnpm --dir packages/llm-wire-debug pack --out ../../artifacts/llm-wire-debug.tgz
```

使用已有 Harness 安装提供的 `dsh` 命令安装本地压缩包。这些步骤不要求插件已发布到 npm。

```sh
dsh plugin --profile web add ./artifacts/flow-lens.tgz ./artifacts/llm-wire-debug.tgz
dsh web --patch ./examples/wire-debug.overlay.yml --no-open
```

该覆盖配置显式确认允许保存凭据。没有它时，模型原始数据的内置 `allowSecrets` 为 false，因此拒绝启用。内置配置写入 `DSH_HOME/llm-wire-traces`；翻译默认关闭，在覆盖文件中启用 `translatePrompt` 后，会额外向原服务发起一次付费调用。打开宿主输出的地址，选择一个 Session，再进入“执行图”或“模型原始数据”。安装或重新构建插件后重启正在运行的宿主；不要用 `sudo` 解决端口冲突。

## 开发

两个包从公开依赖安装和构建，不需要父级 Harness 源码目录。学习视图中的源码引用分别指向本插件仓库或另一个 Harness 源码目录；它们是静态阅读入口，不是函数调用追踪。捕获范围是整个进程，尚未精确绑定当前 Session 或步骤。

发布前在本地运行类型检查、合成数据单元快照、lint、构建和 `pnpm check:release`。发布检查读取 Git 索引中的路径并匹配有限的凭据模式，不是完整的密钥扫描器。发布前同时检查 Git 暂存文件清单和每个包的 `pnpm pack --dry-run` 输出。不要包含真实抓包、Profile、`.env` 或凭据。生成的 `lib/`、`artifacts/` 和依赖不进入 Git；构建产物应放入安装压缩包。

## 许可证

MIT，详见 [LICENSE](LICENSE) 和[第三方声明](THIRD_PARTY_NOTICES.md)。这是独立社区项目，并非 DeepSeek 官方发行。

### 开发备注

无。
