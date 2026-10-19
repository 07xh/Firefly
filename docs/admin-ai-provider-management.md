# Firefly AI 服务商管理中心

本功能在后台新增“AI 服务管理”标签页，支持管理多个 OpenAI Chat Completions 兼容服务商、切换当前服务、保存密钥和测试连接。AI 写作仍只生成待审核草稿，不会绕过现有文章保存/发布流程。

## 一次性 Cloudflare 配置

后台密钥使用 AES-GCM 加密后保存到现有 FIREFLY_SESSIONS KV 命名空间中，使用独立前缀 firefly:ai-provider-config:v1，不会与会话键冲突。请在 Cloudflare Dashboard → Workers & Pages → 对应 Worker → Settings → Variables and Secrets → Secrets 中添加：

- AI_CONFIG_ENCRYPTION_KEY：必须是至少 32 个字符的高强度随机 Secret。建议使用可信密码管理器生成随机值。只需设置一次；不要提交到 GitHub、不要放进 settings.json、不要发给聊天机器人。
- 现有 FIREFLY_SESSIONS KV 绑定必须存在。项目的后台会话认证也依赖此绑定。

AI_API_KEY、AI_MODEL 和 AI_API_BASE_URL 旧版 Worker Secret 仍可作为兼容回退，但推荐迁移到后台管理中心。

**重要：** AI_CONFIG_ENCRYPTION_KEY 是解密现有服务商密钥所必需的。更换或丢失它会导致已保存密钥无法解密；更换前必须先备份/迁移或准备重新录入所有 API Key。密钥的加密存储不等于可恢复备份。

## 使用步骤

1. 部署包含本功能的版本后，登录博客后台。
2. 打开“AI 服务管理”。
3. 点击“新增服务配置”，填写服务名称、英文配置标识、HTTPS API 根地址、模型 ID 和 API Key。
4. 点击“安全保存配置”。API Key 仅在保存请求中发送到本站服务端，服务端加密后写入 KV，成功后浏览器输入框会清空。
5. 点击“保存后测试连接”。测试请求会使用已保存的密钥调用 /chat/completions，只返回成功/失败、模型和耗时，不回传密钥或服务商原始错误正文。
6. 勾选“启用此服务”并保存，即设为当前 AI 写作服务。AI 草稿接口将使用该配置。

## 安全设计

- /api/admin/ai-providers/ 由 src/middleware.ts 的现有会话认证和同源 Origin 检查保护。
- 密钥不写入 GitHub 仓库、公开 settings.json、浏览器本地存储或 GET 响应。
- KV 中只保存 AES-GCM 密文和随机 IV；密钥加密根密钥仅作为 Cloudflare Worker Secret。
- 自定义服务地址必须为 HTTPS；测试请求有 15 秒超时；不把上游原始响应正文返回给浏览器。
- 只支持兼容 OpenAI Chat Completions 的服务；其他协议需要单独适配。
- 这是独立开发分支中的实现；合并和部署前应运行 GitHub Actions，并在预览环境完成保存、掩码、测试、切换与 AI 草稿端到端验证。

## 数据保存说明

服务商元数据和加密后的 API Key 保存在 Cloudflare KV，而不是 GitHub 仓库。这让日常改 Key 不触发博客内容提交或部署。由于当前项目已绑定 FIREFLY_SESSIONS，本功能在该 KV 中使用专属键前缀；后续如需更强的资源隔离，可以迁移到独立的 AI_PROVIDER_CONFIG KV 绑定。