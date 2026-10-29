---
description: "在本地查看未脱敏模型 HTTP 请求、cURL、SSE 和可选中文提示词翻译。"
kind: "package-bundle"
---
# 模型原始数据

[English](README.md) | 中文

## 摘要

查看 POST `/messages` 和 `/chat/completions` 调用的原始请求体、鉴权头、可重放 cURL 和原始响应字节。按顺序阅读请求消息和重建后的响应，同时保留原始 JSON。通过鉴权 WebSocket 视图查看保留的 SSE 片段。可选中文提示词翻译会额外向原服务发起一次付费调用。

## 目录

- [使用此包](#使用此包)
- [理解实现](#理解实现)
- [模型体验](#模型体验)
- [已知限制与待完善事项](#已知限制与待完善事项)

## 使用此包

先阅读[安全说明](../../SECURITY.md)，再按仓库的[本地压缩包安装步骤](../../README.zh.md#构建和安装)操作。[内置补丁](cordis.patch.yml)要求显式覆盖为 `allowSecrets: true`，[示例覆盖文件](../../examples/wire-debug.overlay.yml)提供了该配置；没有它时，启动会报告此插件拒绝启用。内置配置保持 `translatePrompt` 为 false，捕获写入 `DSH_HOME/llm-wire-traces`。只有在你允许再次向原服务发送输入时才开启翻译。

## 理解实现

<details>
<summary>实现细节</summary>

[Host 插件](src/llm-wire-debug.ts)包装进程全局 `fetch`，按 `maxResponseBytes` 上限保留消费的响应字节，并在释放时恢复包装。POSIX 系统上使用私有目录和文件权限。[解析器](src/response-parser.ts)重建服务公开的响应字段；截断与解析错误保持可见。HTTP 文件读取与 [WebSocket 更新](src/trace-live-server.ts)使用宿主的连接鉴权。阅读视图只是派生显示；复制始终读取完整原文件。翻译请求绕过捕获以避免递归。

</details>

## 模型体验

捕获不改变原模型请求，也不注册模型工具。启用 `translatePrompt` 后，辅助请求使用相同端点、模型和凭据发送模型可见输入。翻译可能遗漏或误译，不是原始提示词。

## 已知限制与待完善事项

捕获保留密钥，不做脱敏。进程级记录可能包含其他 Session、重试、Agent 和标题生成；时间戳不能证明归属，选中 Session 也不能隔离访问。捕获随宿主消费或取消流而结束；截断文件不是完整响应。慢速浏览器可能丢失 WebSocket 片段，之后重新读取权威文件。工具调用卡片显示模型提出的请求，不能证明工具执行。重放 cURL 可能再次产生服务费用。源码引用是静态阅读入口，不是执行追踪。测试和问题报告只使用假数据。

### 开发备注

无。
