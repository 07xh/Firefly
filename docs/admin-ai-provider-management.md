# Firefly AI 服务商管理中心

后台新增“AI 服务管理”标签页，支持管理 OpenAI Chat Completions 兼容服务商、保存非敏感配置、启用当前服务和测试连接。AI 写作依旧只生成待审核草稿，不会绕过现有文章保存/发布流程。

## 首次配置 Cloudflare Secret

API Key 只保存在 Cloudflare Worker Secrets 中；后台页面不会接收或提交 Key，也不会将它写入 GitHub、KV、浏览器本地存储或聊天。

1. 打开 Cloudflare Dashboard → Workers & Pages → 选择 Firefly Worker → Settings → Variables and Secrets → Secrets。
2. 根据后台配置标识创建 Secret。命名规则是 `AI_API_KEY_` + 配置标识转大写并将连字符替换为下划线。
3. 默认标识 `other-openai-compatible` 对应 Secret 名称 `AI_API_KEY_OTHER_OPENAI_COMPATIBLE`。
4. 旧版 `AI_API_KEY` 仅在没有选定服务商配置时作为旧版写作流程的兼容回退；一旦选定服务商，必须配置该服务商对应的专属 Secret，后台不会把通用旧 Key 误报为该服务商的专属 Key。
5. 现有 `FIREFLY_SESSIONS` KV 绑定必须存在，用于后台会话认证和保存非敏感 AI 服务配置。

## 在后台使用

1. 登录后台并打开“AI 服务管理”。
2. 服务商类型为“其他 OpenAI 兼容服务商”。
3. 填写服务商名称、HTTPS API 根地址和模型 ID；启用开关默认开启。
4. 点击“保存服务配置”。此操作只保存非敏感的服务配置，不保存 API Key。
5. 查看 API Key 状态：密码框只显示掩码状态，并标记“Cloudflare 已配置/未配置”，不会读取或返回密钥原文。
6. 点击“保存后测试连接”。测试使用 Worker Secret 调用 `/chat/completions`，只回报成功/失败、模型和耗时，不回传 Secret 或服务商原始错误正文。

## 配置和安全说明

- `/api/admin/ai-providers/` 受到 `src/middleware.ts` 的现有会话认证、同源 Origin 检查和请求体大小限制保护。
- 非敏感服务配置存放在现有 `FIREFLY_SESSIONS` KV 的专用键前缀下；它不会写入公开的 `src/data/settings.json` 或 GitHub 内容仓库。
- 每个配置使用自己的 Secret 名称。配置标识固定后，若要使用不同 Key，请在 Cloudflare 中更新对应 Secret。
- API 地址必须是 HTTPS 公网域名；不允许 URL 凭据、查询参数、片段、IP 地址、本地域名或常见内网主机后缀。
- 测试请求有 15 秒超时，且不会将服务商原始响应正文发送回后台。
- 仅支持兼容 OpenAI Chat Completions 的服务。其他协议需要单独适配。
- 此功能仍在独立开发分支和草稿 PR 中；合并前应在预览环境测试保存配置、Secret 状态、连接测试、服务切换及 AI 草稿生成。
