# Firefly 后台 AI 自然语言写作

后台的“AI 自然语言写作助手”可以按中文要求生成新文章草稿，也可以按指令改写当前文章正文。生成结果必须先填入编辑器、检查预览，再通过原有保存/发布按钮写入 GitHub。此功能不会自动发布文章。

## Cloudflare Worker 配置

打开 Cloudflare Dashboard → Workers & Pages → Firefly 对应 Worker → Settings → Variables and Secrets，添加：

- `AI_API_KEY`：使用 Secret 保存服务商 API 密钥，不要放到公开仓库、前端代码或普通文本变量中。
- `AI_MODEL`：填写服务商提供的模型 ID。
- `AI_API_BASE_URL`：可选，填写 OpenAI Chat Completions 兼容接口的 API 根地址；默认使用 `https://api.openai.com/v1`。通常不要在末尾重复添加 `/chat/completions`。

接口必须通过 HTTPS，并兼容 `POST /chat/completions`、Bearer API key、`messages` 请求及 `choices[0].message.content` 响应。若服务商使用不同 API 协议，此实现不能直接兼容。

配置变更后，需要确认 Cloudflare Worker 已使用包含本功能的代码部署。AI API 密钥只由服务端读取，不会发送给浏览器。

## 使用方法

1. 登录后台并打开“AI 自然语言写作助手”。
2. 用中文描述需要生成的文章，或者选择一篇现有文章后输入修改要求。
3. 检查 AI 返回的草稿，点击“填入编辑器并预览”。
4. 在可视化编辑器或预览中自行检查内容；需要调整时继续修改或再次请求 AI。
5. 使用已有的“保存草稿”或“发布文章”按钮完成 GitHub 写入和后续部署。

## 安全与内容保留

- AI 只生成待审核草稿；不会自动保存、发布、删除文章或更改全局配置。
- 改写现有文章时会检查代码围栏、行内代码、公式、Markdown 链接/图片和常见特殊组件是否被完整保留；如果检测到丢失或改动，将拒绝返回修改稿，不会覆盖原文。
- API 路由位于 `/api/admin/ai-draft/`，由现有后台会话中间件保护。
- 新文章优先生成标准 Markdown，降低自定义 MDX/HTML 语法导致可视化编辑风险的机会。AI 改写现有正文仍可能改变原文，务必检查重要内容、代码、链接和特殊组件。
- 不要把密码、私密资料或其他敏感信息发送给外部 AI 服务。输入内容会按照所配置服务商的隐私政策处理。
- 如果页面提示“AI 写作尚未配置”，请检查 `AI_API_KEY` 与 `AI_MODEL` 是否已经配置，并确认配置已应用于当前 Worker。
